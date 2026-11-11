import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiCallKind, OrderEnteredBy, OrderStatus, OrderType, PatientClass, Prisma, Role } from '@prisma/client';
import { timeAiCall } from '../course-in-ward/ai-metrics';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, detailItems, fullName, humanize } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OllamaClient } from '../course-in-ward/ollama-client';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { freeRoom, inRoomTransaction } from '../patients/rooms';

/**
 * Half-open local-day window `[start, end)` for a `YYYY-MM-DD` key. A missing
 * key means "today", which keeps the legacy `findTodaysOrders` semantics.
 */
function localDayRange(day?: string | null) {
  const [year, month, date] = day ? day.split('-').map(Number) : [];
  const start =
    day && !Number.isNaN(year)
      ? new Date(year, (month || 1) - 1, date || 1)
      : new Date();
  if (!day) start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Workflow position of each order status; nurses may only move forward. */
const ORDER_STATUS_RANK: Record<OrderStatus, number> = {
  [OrderStatus.TO_ACCOMPLISH]: 0,
  [OrderStatus.ONGOING]: 1,
  [OrderStatus.FINISHED]: 2,
};

const orderInclude = {
  orderedBy: { select: { firstName: true, lastName: true } },
  encodedBy: { select: { firstName: true, lastName: true, role: true } },
  executedBy: { select: { firstName: true, lastName: true } },
  transferRoom: { select: { number: true, ward: { select: { name: true } } } },
};

type RoomLabel = { number: string; ward?: { name: string } | null } | null;

/** "room 305 (Surgery)"; an inpatient with no room yet reads "no room". */
function roomLabel(room: RoomLabel) {
  if (!room) return 'no room';
  return room.ward ? `room ${room.number} (${room.ward.name})` : `room ${room.number}`;
}

/** Transfer orders still waiting for the nurse on one admission. */
const pendingTransfers = (admissionId: string): Prisma.PhysicianOrderWhereInput => ({
  admissionId,
  type: OrderType.TRANSFER,
  active: true,
  status: { not: OrderStatus.FINISHED },
});

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly ollama: OllamaClient;
  /** Registered by CourseInWardService, which already depends on this service. */
  private dischargeListeners: Array<(admissionId: string, nurseId: string) => void> = [];

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {
    this.ollama = new OllamaClient(
      this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000',
    );
  }

  /** Runs after a discharge order ends an admission. */
  onDischarge(listener: (admissionId: string, nurseId: string) => void) {
    this.dischargeListeners.push(listener);
  }

  async create(dto: CreateOrderDto, enteredById: string, enteredByRole: Role) {
    const enteredByFlag =
      enteredByRole === Role.NURSE ? OrderEnteredBy.NURSE_ON_BEHALF : OrderEnteredBy.PHYSICIAN;

    const admission = await this.prisma.patientAdmission.findUnique({
      where: { id: dto.admissionId },
      select: {
        patientId: true,
        dischargeDate: true,
        // Only an inpatient can be transferred.
        patientClass: true,
        physicianId: true,
        additionalPhysicians: { select: { physicianId: true } },
        room: { select: { wardId: true, number: true } },
      },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.dischargeDate) {
      throw new BadRequestException('Cannot add orders to a discharged admission');
    }

    const careTeam = new Set(
      [admission.physicianId, ...admission.additionalPhysicians.map((entry) => entry.physicianId)].filter(
        (id): id is string => Boolean(id),
      ),
    );

    if (enteredByRole === Role.PHYSICIAN && !careTeam.has(enteredById)) {
      throw new ForbiddenException('You are not on the care team for this admission');
    }

    const orderedById = dto.orderedById ?? (enteredByRole === Role.PHYSICIAN ? enteredById : undefined);
    if (!orderedById) {
      throw new BadRequestException('orderedById is required when entering an order on a physician’s behalf');
    }
    if (!careTeam.has(orderedById)) {
      throw new BadRequestException('The ordering physician is not on the care team for this admission');
    }
    if (enteredByRole === Role.PHYSICIAN && dto.communicationChannel) {
      throw new BadRequestException('Only an order entered on a physician’s behalf has a "received via"');
    }
    const orderingPhysician = await this.prisma.user.findUnique({
      where: { id: orderedById },
      select: { isActive: true },
    });
    if (!orderingPhysician?.isActive) {
      throw new BadRequestException(
        'The ordering physician’s account is deactivated, so orders can no longer be entered for them',
      );
    }

    const type = dto.type ?? OrderType.DEFAULT;
    // Only the attending physician sends the patient home; consultants advise.
    // A physician writing it themselves must be the attending too, whatever
    // orderedById says.
    if (
      type === OrderType.DISCHARGE &&
      (orderedById !== admission.physicianId ||
        (enteredByRole === Role.PHYSICIAN && enteredById !== admission.physicianId))
    ) {
      throw new ForbiddenException('Only the attending physician can write a discharge order');
    }
    const transferRoomNumber = dto.transferRoomNumber;
    if (type !== OrderType.TRANSFER && transferRoomNumber) {
      throw new BadRequestException('A room can only be given with a transfer order');
    }
    if (type === OrderType.TRANSFER) {
      // Same rule as discharge: a nurse may enter it, but only on the attending's behalf.
      if (
        orderedById !== admission.physicianId ||
        (enteredByRole === Role.PHYSICIAN && enteredById !== admission.physicianId)
      ) {
        throw new ForbiddenException('Only the attending physician can order a transfer');
      }
      if (!transferRoomNumber) {
        throw new BadRequestException('Choose the room to transfer the patient to');
      }
      if (admission.patientClass !== PatientClass.INPATIENT) {
        throw new BadRequestException('Only an admitted patient can be transferred');
      }
      if (admission.room?.number === transferRoomNumber) {
        throw new BadRequestException(`The patient is already in room ${transferRoomNumber}`);
      }
    }
    // A discharge is ordered once; a transfer makes no sense after one.
    if (type === OrderType.DISCHARGE || type === OrderType.TRANSFER) {
      await this.assertNoDischargeOrder(dto.admissionId);
    }

    const data = {
      admissionId: dto.admissionId,
      orderedById,
      encodedById: enteredById,
      enteredByRole: enteredByFlag,
      orderContent: dto.orderContent,
      type,
      communicationChannel: dto.communicationChannel ?? null,
    };
    // Writing a discharge/transfer order does not change the admission: the
    // nurse carries it out (PATCH /patients/admissions/:id/discharge, or
    // finishing the transfer order). A transfer reserves its room until then.
    const order = transferRoomNumber
      ? await inRoomTransaction(this.prisma, async (tx) => {
          const room = await freeRoom(tx, transferRoomNumber, dto.admissionId);
          // A newer transfer replaces one still waiting for the nurse (and frees its room).
          await tx.physicianOrder.updateMany({
            where: pendingTransfers(dto.admissionId),
            data: { active: false },
          });
          return tx.physicianOrder.create({
            data: {
              ...data,
              // The destination leads the text so the record (and its summary) reads on its own.
              orderContent: `Transfer to ${roomLabel(room)}. ${dto.orderContent}`,
              transferRoomId: room.id,
            },
            include: orderInclude,
          });
        })
      : await this.prisma.physicianOrder.create({ data, include: orderInclude });

    // A discharge supersedes a transfer that has not happened yet.
    if (type === OrderType.DISCHARGE) {
      await this.prisma.physicianOrder.updateMany({
        where: pendingTransfers(dto.admissionId),
        data: { active: false },
      });
    }

    const patientName = await this.auditLog.patientName({ admissionId: dto.admissionId });
    const physicianName = fullName(order.orderedBy);
    await this.auditLog.record({
      userId: enteredById,
      action: 'ORDER_CREATED',
      details: {
        summary:
          enteredByRole === Role.NURSE
            ? `Entered Dr. ${physicianName}'s ${humanize(type).toLowerCase()} order for ${patientName}`
            : `Wrote a ${humanize(type).toLowerCase()} order for ${patientName}`,
        items: detailItems([
          ['Patient', patientName],
          ['Ordering physician', `Dr. ${physicianName}`],
          ['Order type', humanize(type)],
          ['Order', dto.orderContent],
          ['Received via', enteredByRole === Role.NURSE ? dto.communicationChannel ?? 'Written order' : null],
        ]),
      },
    });

    const notification = {
      title: 'New physician order',
      message: `An order for **${patientName}** for nursing review.`,
      patientId: admission.patientId,
    };
    if (enteredByRole === Role.PHYSICIAN) {
      await Promise.all([
        this.notifications.notifyUsers([...careTeam].filter((id) => id !== enteredById), {
          title: 'New care-team order',
          message: `Dr. ${physicianName} entered an order for **${patientName}**.`,
          patientId: admission.patientId,
        }),
        this.notifyWardNurses(admission.room, notification),
      ]);
    } else {
      await this.notifications.notifyUsers([...careTeam], {
        ...notification,
        title: 'Order entered on your behalf',
        message: `A ${humanize(type).toLowerCase()} order for **${patientName}** was entered on your behalf.`,
      });
    }

    // Best-effort: persist the pgvector embedding so this order can serve as a
    // RAG reference later. Never blocks or fails order creation if the AI
    // service is unavailable.
    void this.persistOrderEmbedding(order.id, order.orderContent);

    return order;
  }

  /** Nurses on the patient's ward, or the unroomed ward when the patient has no room. */
  private async notifyWardNurses(
    room: { wardId: string | null } | null,
    input: { title: string; message: string; patientId: string },
  ) {
    const wardId =
      room?.wardId ??
      (
        await this.prisma.ward.findFirst({
          where: { holdsUnroomed: true },
          select: { id: true },
        })
      )?.id;
    if (!wardId) return [];
    return this.notifications.notifyNursesInWard(wardId, input);
  }

  /**
   * A discharge order is a one-off decision the nurse carries out, so an
   * admission holds at most one. Only active orders count, so a discontinued
   * one can be written again.
   */
  private async assertNoDischargeOrder(admissionId: string) {
    const existing = await this.prisma.physicianOrder.count({
      where: { admissionId, active: true, type: OrderType.DISCHARGE },
    });
    if (existing > 0) {
      throw new ConflictException('This patient already has a discharge order');
    }
  }

  /**
   * Embed `orderContent` with the AI service and write the vector into
   * `physician_orders."orderEmbedding"` (Unsupported type -> raw SQL only).
   * Errors are swallowed and logged.
   */
  private async persistOrderEmbedding(orderId: string, content: string): Promise<void> {
    try {
      if (!content) return;
      const { embeddings } = await timeAiCall(
        this.prisma,
        { kind: AiCallKind.EMBEDDING, model: 'embedding', trigger: 'order' },
        () => this.ollama.embedTexts([content]),
        (result) => ({ model: result.model }),
      );
      const vector = embeddings[0];
      if (!vector || vector.length === 0) return;

      const literal = vector.map((v) => v.toFixed(8)).join(',');
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "physician_orders"
        SET "orderEmbedding" = ${`[${literal}]`}::vector
        WHERE "id" = ${orderId}
      `);
    } catch (err) {
      this.logger.warn(
        `[embeddings] could not embed order ${orderId}: ${(err as Error).message}`,
      );
    }
  }

  findForPatient(patientId: string) {
    return this.prisma.physicianOrder.findMany({
      where: { admission: { patientId } },
      orderBy: { dateCreated: 'desc' },
      include: orderInclude,
    });
  }

  /**
   * Nurse execution tracking. Status only moves forward
   * (`TO_ACCOMPLISH` -> `ONGOING` -> `FINISHED`); re-sending the current
   * status is allowed so the nurse can still edit the note. Each status change
   * stamps the acting nurse and time; a note-only edit leaves the stamp alone.
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto, nurseId: string) {
    const order = await this.prisma.physicianOrder.findFirst({ where: { id, active: true } });
    if (!order) throw new NotFoundException('Order not found');

    // A finished order with a submitted note is the nurse's final record of
    // it; neither the status nor the note can change after that.
    if (order.status === OrderStatus.FINISHED && order.nurseComment) {
      throw new BadRequestException('This order is finished and its note has already been submitted');
    }

    if (ORDER_STATUS_RANK[dto.status] < ORDER_STATUS_RANK[order.status]) {
      throw new BadRequestException('An order’s status cannot be moved back once it has progressed');
    }

    const nextComment =
      dto.nurseComment !== undefined ? dto.nurseComment.trim() || null : order.nurseComment;
    if (order.type === OrderType.DISCHARGE && dto.status === OrderStatus.FINISHED) {
      if (!nextComment) {
        throw new BadRequestException('Add a note before marking the discharge order done');
      }
      const unfinished = await this.prisma.physicianOrder.count({
        where: {
          admissionId: order.admissionId,
          active: true,
          id: { not: order.id },
          dateCreated: { lte: order.dateCreated },
          status: { not: OrderStatus.FINISHED },
        },
      });
      if (unfinished > 0) {
        throw new BadRequestException(
          'Finish every order written before the discharge order before this patient can be discharged',
        );
      }
    }

    const changed = dto.status !== order.status;
    const data = {
      status: dto.status,
      ...(dto.nurseComment !== undefined && { nurseComment: dto.nurseComment.trim() || null }),
      ...(changed && { executedById: nurseId, executedAt: new Date() }),
    };
    // Finishing a transfer order moves the patient in the same transaction, so
    // the order is never marked done without the move (or the other way round).
    const finishingTransfer =
      changed && order.type === OrderType.TRANSFER && dto.status === OrderStatus.FINISHED;
    const [updated, move] = finishingTransfer
      ? await inRoomTransaction(this.prisma, async (tx) => {
          const moved = await this.moveForTransfer(tx, order);
          return [await tx.physicianOrder.update({ where: { id }, data, include: orderInclude }), moved] as const;
        })
      : ([await this.prisma.physicianOrder.update({ where: { id }, data, include: orderInclude }), null] as const);

    const patientName = await this.auditLog.patientName({ admissionId: order.admissionId });
    const nurse = await this.prisma.user.findUnique({
      where: { id: nurseId },
      select: { firstName: true, lastName: true },
    });
    const nurseName = fullName(nurse, 'A nurse');
    const changes = [
      { field: 'Status', from: humanize(order.status), to: humanize(updated.status) },
      { field: 'Nurse note', from: order.nurseComment ?? '—', to: updated.nurseComment ?? '—' },
    ].filter((change) => change.from !== change.to);
    await this.auditLog.record({
      userId: nurseId,
      action: 'ORDER_STATUS_UPDATED',
      details: {
        summary: changed
          ? `Marked an order for ${patientName} as ${humanize(updated.status).toLowerCase()}`
          : `Updated the note on an order for ${patientName}`,
        items: detailItems([
          ['Patient', patientName],
          ['Ordering physician', `Dr. ${fullName(updated.orderedBy)}`],
          ['Order', order.orderContent],
        ]),
        changes,
      },
    });

    const movedText = move
      ? `**${patientName}** was moved from ${roomLabel(move.from)} to ${roomLabel(move.to)} by **${nurseName}**.`
      : undefined;
    if (move) {
      await this.auditLog.record({
        userId: nurseId,
        action: 'PATIENT_TRANSFERRED',
        details: {
          summary: `Transferred ${patientName} to ${roomLabel(move.to)}`,
          items: detailItems([
            ['Patient', patientName],
            ['Ordering physician', `Dr. ${fullName(updated.orderedBy)}`],
          ]),
          changes: [
            { field: 'Room', from: move.from?.number ?? 'None', to: move.to.number },
            { field: 'Ward', from: move.from?.ward?.name ?? '—', to: move.to.ward?.name ?? '—' },
          ].filter((change) => change.from !== change.to),
        },
      });
      await this.notifyTransferWards(move, patientName, nurseName);
    }

    const noteChanged = (order.nurseComment ?? null) !== (updated.nurseComment ?? null);
    if (changed && dto.status === OrderStatus.FINISHED) {
      await this.notifyFinishedAfterSummary(order, nurseName, patientName, movedText);
    } else if (changed || noteChanged) {
      const admission = await this.prisma.patientAdmission.findUnique({
        where: { id: order.admissionId },
        select: {
          patientId: true,
          physicianId: true,
          additionalPhysicians: { select: { physicianId: true } },
        },
      });
      const physicianIds = [
        admission?.physicianId,
        ...(admission?.additionalPhysicians.map(({ physicianId }) => physicianId) ?? []),
      ].filter((id): id is string => Boolean(id));
      await this.notifications.notifyUsers(physicianIds, {
        title: changed ? 'Order started' : 'Order note added',
        message: changed
          ? `**${nurseName}** started an order for **${patientName}**.`
          : `**${nurseName}** added a note on an order for **${patientName}**.`,
        patientId: admission?.patientId,
      });
    }

    if (order.type === OrderType.DISCHARGE && updated.status === OrderStatus.FINISHED && updated.nurseComment) {
      await this.dischargeAfterOrder(order.admissionId, nurseId);
    }

    return updated;
  }

  /**
   * Moves the patient into the transfer order's room, inside the caller's room
   * transaction. The room is reserved for this admission, so it is only lost if
   * something bypassed the reservation; then the move fails with 409.
   */
  private async moveForTransfer(
    tx: Prisma.TransactionClient,
    order: { id: string; admissionId: string; transferRoomId: string | null },
  ) {
    // Re-checked inside the transaction so two nurses cannot both carry it out.
    const pending = await tx.physicianOrder.count({
      where: { id: order.id, active: true, status: { not: OrderStatus.FINISHED } },
    });
    if (!pending) throw new ConflictException('This transfer order was already carried out or replaced');
    if (!order.transferRoomId) throw new BadRequestException('This transfer order has no destination room');

    const admission = await tx.patientAdmission.findUnique({
      where: { id: order.admissionId },
      select: {
        dischargeDate: true,
        patientClass: true,
        patientId: true,
        room: { select: { number: true, ward: { select: { id: true, name: true } } } },
      },
    });
    if (!admission || admission.dischargeDate) {
      throw new BadRequestException('Cannot transfer a discharged patient');
    }
    if (admission.patientClass !== PatientClass.INPATIENT) {
      throw new BadRequestException('Only an admitted patient can be transferred');
    }
    const target = await tx.room.findUnique({
      where: { id: order.transferRoomId },
      select: { number: true },
    });
    if (!target) throw new NotFoundException('The transfer room no longer exists');

    const to = await freeRoom(tx, target.number, order.admissionId);
    await tx.patientAdmission.update({
      where: { id: order.admissionId },
      data: {
        roomId: to.id,
        roomNumber: to.number,
        wardName: to.ward?.name ?? null,
      },
    });
    return { patientId: admission.patientId, from: admission.room, to };
  }

  /**
   * Tells the nurses of the ward the patient left and of the ward they arrived
   * in (one message when it is the same ward). Only the arriving ward gets a
   * link to the chart: the old ward no longer has access. Best effort.
   */
  private async notifyTransferWards(
    move: {
      patientId: string;
      from: { number: string; ward: { id: string; name: string } | null } | null;
      to: { number: string; ward: { id: string; name: string } | null };
    },
    patientName: string,
    nurseName: string,
  ) {
    try {
      // No room = the ward that holds unroomed patients (Emergency).
      const fromWardId = move.from
        ? move.from.ward?.id ?? null
        : (await this.prisma.ward.findFirst({ where: { holdsUnroomed: true }, select: { id: true } }))?.id ?? null;
      const toWardId = move.to.ward?.id ?? null;
      const from = roomLabel(move.from);

      if (fromWardId && fromWardId === toWardId) {
        await this.notifications.notifyNursesInWard(toWardId, {
          title: 'Patient moved rooms',
          message: `**${patientName}** was moved from ${from} to ${roomLabel(move.to)} by **${nurseName}**.`,
          patientId: move.patientId,
        });
        return;
      }
      await Promise.all([
        fromWardId &&
          this.notifications.notifyNursesInWard(fromWardId, {
            title: 'Patient transferred out',
            message: `**${patientName}** was transferred out of your ward to ${roomLabel(move.to)} by **${nurseName}**.`,
          }),
        toWardId &&
          this.notifications.notifyNursesInWard(toWardId, {
            title: 'Patient transferred in',
            message: `**${patientName}** was transferred into your ward, room ${move.to.number}, from ${from} by **${nurseName}**.`,
            patientId: move.patientId,
          }),
      ]);
    } catch (err) {
      this.logger.warn(`[notify] could not notify wards of a transfer: ${(err as Error).message}`);
    }
  }

  /** Carrying out a discharge order ends the admission. A second nurse finds it already discharged. */
  private async dischargeAfterOrder(admissionId: string, nurseId: string) {
    const admission = await this.prisma.patientAdmission.findUnique({ where: { id: admissionId } });
    if (!admission || admission.dischargeDate) return;

    const dischargeDate = new Date();
    const { count } = await this.prisma.patientAdmission.updateMany({
      where: { id: admissionId, dischargeDate: null },
      data: { dischargeDate },
    });
    if (count === 0) return;

    const patientName = await this.auditLog.patientName({ patientId: admission.patientId });
    await this.auditLog.record({
      userId: nurseId,
      action: 'PATIENT_DISCHARGED',
      details: {
        summary: `Discharged ${patientName}`,
        items: detailItems([
          ['Patient', patientName],
          ['Discharged', dischargeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
        ]),
      },
    });
    for (const listener of this.dischargeListeners) listener(admissionId, nurseId);
  }

  /**
   * Tell the care team when a nurse finishes an order. If a summary already
   * exists for that day, highlight that it needs regeneration. Best effort --
   * never fails the nurse's status update.
   */
  private async notifyFinishedAfterSummary(
    order: {
      id: string;
      admissionId: string;
      orderedById: string;
      dateCreated: Date;
    },
    nurseName: string,
    patientName: string,
    /** Set for a carried-out transfer: replaces the generic "accomplished" message. */
    movedText?: string,
  ) {
    try {
      const created = new Date(order.dateCreated);
      const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const admission = await this.prisma.patientAdmission.findUnique({
        where: { id: order.admissionId },
        select: {
          patientId: true,
          physicianId: true,
          additionalPhysicians: { select: { physicianId: true } },
          patient: { select: { firstName: true, lastName: true } },
        },
      });
      if (!admission) return;

      const summary = await this.prisma.courseInWard.findFirst({
        where: { patientId: admission.patientId, summaryDate: { gte: start, lt: end } },
        select: { id: true },
      });
      const day = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const physicianIds = [
        admission.physicianId,
        ...admission.additionalPhysicians.map(({ physicianId }) => physicianId),
        order.orderedById,
      ].filter((id): id is string => Boolean(id));
      const regenerate =
        "after that day's Course in the Ward was written. Regenerate the summary to include it.";
      await this.notifications.notifyUsers(physicianIds, {
        title: movedText ? 'Patient transferred' : summary ? 'Order finished after summary' : 'Order accomplished',
        message: movedText
          ? summary
            ? `${movedText} The transfer order is from ${day} and was carried out ${regenerate}`
            : movedText
          : summary
            ? `**${nurseName}** accomplished an order for **${patientName}** on ${day} ${regenerate}`
            : `**${nurseName}** accomplished an order for **${patientName}**.`,
        patientId: admission.patientId,
      });
    } catch (err) {
      this.logger.warn(
        `[notify] could not check summary for finished order ${order.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * FINISHED orders written on ONE calendar day for a patient, oldest first --
   * the input to a per-day AI summarization (only carried-out orders belong in
   * the Course in the Ward). `day` is a local `YYYY-MM-DD` key; omitting
   * it means today. The owning admission rides along so the AI service can
   * label the group ("Day N of Admission").
   */
  findOrdersForDay(patientId: string, day?: string | null) {
    const { start, end } = localDayRange(day);

    return this.prisma.physicianOrder.findMany({
      where: {
        admission: { patientId },
        dateCreated: { gte: start, lt: end },
        status: OrderStatus.FINISHED,
      },
      orderBy: { dateCreated: 'asc' },
      include: {
        admission: { select: { id: true, admissionDate: true } },
        summary: { select: { status: true } },
      },
    });
  }

  // Orders placed "today" for a patient -- input to the AI summarization step
  findTodaysOrders(patientId: string) {
    return this.findOrdersForDay(patientId);
  }
}