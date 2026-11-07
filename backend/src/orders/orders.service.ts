import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderEnteredBy, OrderStatus, OrderType, PatientClass, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, detailItems, fullName, humanize } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OllamaClient } from '../course-in-ward/ollama-client';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';

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
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly ollama: OllamaClient;

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

  async create(dto: CreateOrderDto, enteredById: string, enteredByRole: Role) {
    const enteredByFlag =
      enteredByRole === Role.NURSE ? OrderEnteredBy.NURSE_ON_BEHALF : OrderEnteredBy.PHYSICIAN;

    const admission = await this.prisma.patientAdmission.findUnique({
      where: { id: dto.admissionId },
      select: {
        patientId: true,
        dischargeDate: true,
        patientClass: true,
        physicianId: true,
        additionalPhysicians: { select: { physicianId: true } },
        room: { select: { wardId: true } },
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

    const type = dto.type ?? OrderType.DEFAULT;
    if (type !== OrderType.DEFAULT) {
      await this.assertOrderTypeAllowed(dto.admissionId, type, admission.patientClass);
    }

    // Writing an admission/discharge order does not change the admission: the
    // nurse carries it out with PATCH /patients/admissions/:id/admit|discharge.
    const order = await this.prisma.physicianOrder.create({
      data: {
        admissionId: dto.admissionId,
        orderedById,
        encodedById: enteredById,
        enteredByRole: enteredByFlag,
        orderContent: dto.orderContent,
        type,
      },
      include: orderInclude,
    });

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
   * Observation, admission and discharge orders are one-off decisions, each
   * carried out by the nurse (observe / admit / discharge):
   * - OBSERVATION only for an emergency patient or outpatient.
   * - ADMISSION for anyone not yet an inpatient.
   * - Neither while another of these decisions is still pending or once a
   *   discharge has been ordered, and none of the three twice.
   * Only active orders count, so a discontinued one can be written again.
   */
  private async assertOrderTypeAllowed(
    admissionId: string,
    type: OrderType,
    patientClass: PatientClass,
  ) {
    const existing = await this.prisma.physicianOrder.findMany({
      where: {
        admissionId,
        active: true,
        type: { in: [OrderType.OBSERVATION, OrderType.ADMISSION, OrderType.DISCHARGE] },
      },
      select: { type: true },
    });
    const has = (candidate: OrderType) => existing.some((order) => order.type === candidate);

    if (type === OrderType.DISCHARGE) {
      if (has(OrderType.DISCHARGE)) {
        throw new ConflictException('This patient already has a discharge order');
      }
      return;
    }

    if (type === OrderType.ADMISSION && patientClass === PatientClass.INPATIENT) {
      throw new ConflictException('This patient is already admitted');
    }
    if (type === OrderType.OBSERVATION) {
      if (patientClass === PatientClass.OBSERVATION) {
        throw new ConflictException('This patient is already under observation');
      }
      if (patientClass === PatientClass.INPATIENT) {
        throw new ConflictException('An admitted patient cannot be placed under observation');
      }
    }
    if (has(OrderType.DISCHARGE)) {
      throw new ConflictException('This patient already has a discharge order');
    }
    if (has(OrderType.ADMISSION)) {
      throw new ConflictException('This patient already has an admission order');
    }
    // A carried-out observation order is history once the patient is under
    // observation; only one still waiting for the nurse blocks.
    if (has(OrderType.OBSERVATION) && patientClass !== PatientClass.OBSERVATION) {
      throw new ConflictException('This patient already has an observation order');
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
      const { embeddings } = await this.ollama.embedTexts([content]);
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
    const updated = await this.prisma.physicianOrder.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.nurseComment !== undefined && { nurseComment: dto.nurseComment.trim() || null }),
        ...(changed && { executedById: nurseId, executedAt: new Date() }),
      },
      include: orderInclude,
    });

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

    const noteChanged = (order.nurseComment ?? null) !== (updated.nurseComment ?? null);
    if (changed && dto.status === OrderStatus.FINISHED) {
      await this.notifyFinishedAfterSummary(order, nurseName, patientName);
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
      action: 'REGISTER_PATIENT',
      details: {
        summary: `Discharged ${patientName}`,
        items: detailItems([
          ['Patient', patientName],
          ['Discharged', dischargeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
        ]),
      },
    });
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
      await this.notifications.notifyUsers(physicianIds, {
        title: summary ? 'Order finished after summary' : 'Order accomplished',
        message: summary
          ? `**${nurseName}** accomplished an order for **${patientName}** on ${day} ` +
            `after that day's Course in the Ward was written. Regenerate the summary to include it.`
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
      include: { admission: { select: { id: true, admissionDate: true } } },
    });
  }

  // Orders placed "today" for a patient -- input to the AI summarization step
  findTodaysOrders(patientId: string) {
    return this.findOrdersForDay(patientId);
  }
}