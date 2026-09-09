import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderEnteredBy, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OllamaClient } from '../course-in-ward/ollama-client';
import { CreateOrderDto } from './dto/create-order.dto';

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

    const order = await this.prisma.physicianOrder.create({
      data: {
        admissionId: dto.admissionId,
        orderedById: dto.orderedById,
        encodedById: enteredById,
        enteredByRole: enteredByFlag,
        orderContent: dto.orderContent,
      },
    });

    await this.auditLog.record({
      userId: enteredById,
      action: 'ORDER_CREATED',
    });

    // Best-effort: persist the pgvector embedding so this order can serve as a
    // RAG reference later. Never blocks or fails order creation if the AI
    // service is unavailable.
    void this.persistOrderEmbedding(order.id, order.orderContent);

    return order;
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
      include: {
        orderedBy: { select: { firstName: true, lastName: true } },
        encodedBy: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  // Orders placed "today" for a patient -- input to the AI summarization step
  findTodaysOrders(patientId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.physicianOrder.findMany({
      where: { admission: { patientId }, dateCreated: { gte: startOfDay } },
      orderBy: { dateCreated: 'asc' },
    });
  }
}
