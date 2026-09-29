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
import { AuditLogService } from '../audit-log/audit-log.service';
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
        dischargeDate: true,
        patientClass: true,
        physicianId: true,
        additionalPhysicians: { select: { physicianId: true } },
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
        // Only a relayed order has a channel; a physician's own order never
        // shows "Sent via" even if a client sends the field.
        communicationChannel:
          enteredByFlag === OrderEnteredBy.NURSE_ON_BEHALF ? (dto.communicationChannel ?? null) : null,
      },
      include: orderInclude,
    });

    // A relayed order is its own audit action so the Activity Logs can tell
    // "nurse entered on behalf" apart from "physician wrote it".
    await this.auditLog.record({
      userId: enteredById,
      action: enteredByFlag === OrderEnteredBy.NURSE_ON_BEHALF ? 'ORDER_CREATED_NURSE' : 'ORDER_CREATED',
    });

    // Best-effort: persist the pgvector embedding so this order can serve as a
    // RAG reference later. Never blocks or fails order creation if the AI
    // service is unavailable.
    void this.persistOrderEmbedding(order.id, order.orderContent);

    return order;
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

    if (ORDER_STATUS_RANK[dto.status] < ORDER_STATUS_RANK[order.status]) {
      throw new BadRequestException('An order’s status cannot be moved back once it has progressed');
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

    await this.auditLog.record({
      userId: nurseId,
      action: 'ORDER_STATUS_UPDATED',
    });

    return updated;
  }

  /**
   * Orders written on ONE calendar day for a patient, oldest first -- the input
   * to a per-day AI summarization. `day` is a local `YYYY-MM-DD` key; omitting
   * it means today. The owning admission rides along so the AI service can
   * label the group ("Day N of Admission").
   */
  findOrdersForDay(patientId: string, day?: string | null) {
    const { start, end } = localDayRange(day);

    return this.prisma.physicianOrder.findMany({
      where: { admission: { patientId }, dateCreated: { gte: start, lt: end } },
      orderBy: { dateCreated: 'asc' },
      include: { admission: { select: { id: true, admissionDate: true } } },
    });
  }

  // Orders placed "today" for a patient -- input to the AI summarization step
  findTodaysOrders(patientId: string) {
    return this.findOrdersForDay(patientId);
  }
}