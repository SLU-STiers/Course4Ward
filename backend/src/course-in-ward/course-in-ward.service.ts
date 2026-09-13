import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SummaryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrdersService } from '../orders/orders.service';
import { OllamaClient, OllamaReference } from './ollama-client';

/** Vector dimension produced by the ai-service embedding model (Qwen3-Embedding-0.6B). */
const EMBEDDING_DIM = 1024;

interface SimilarReferenceRow {
  summaryId: string;
  orderContent: string;
  approvedSummary: string;
  similarity: number;
}

@Injectable()
export class CourseInWardService {
  private readonly aiServiceUrl: string;
  private readonly ollamaClient: OllamaClient;
  private readonly logger = new Logger(CourseInWardService.name);

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private ordersService: OrdersService,
    private config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000';
    this.ollamaClient = new OllamaClient(this.aiServiceUrl);
  }

  // Calls the Python/FastAPI + Ollama microservice. This service is the ONLY
  // caller of ai-service -- the frontend never talks to it directly.
  private async callAiSummarizer(orders: any[]): Promise<string> {
    try {
      if (!orders || orders.length === 0) {
        this.logger.warn('[ai] callAiSummarizer received no orders');
        throw new BadRequestException('No orders found to summarize');
      }

      // Group the incoming orders by admission so the AI service can label each
      // admission-day group correctly.
      const byAdmission = new Map<string, any[]>();
      for (const order of orders) {
        const key = order.admissionId ?? 'no-admission';
        const bucket = byAdmission.get(key) ?? [];
        bucket.push(order);
        byAdmission.set(key, bucket);
      }

      const admissions = Array.from(byAdmission.entries()).map(([admissionId, bucket]) => ({
        admissionId,
        admissionDate: null,
        orders: bucket.map((order) => ({
          id: String(order.id),
          text: order.orderContent,
          dateCreated:
            order.dateCreated instanceof Date
              ? order.dateCreated.toISOString()
              : (order.dateCreated ?? null),
        })),
      }));

      // RAG: embed the combined orders and retrieve similar APPROVED summaries
      // to use as style exemplars during generation.
      const queryText = orders
        .map((order) => order.orderContent)
        .filter(Boolean)
        .join('\n');
      const references = queryText ? await this.retrieveReferences(queryText) : [];

      this.logger.log(
        `[ai] summarizing ${orders.length} order(s) across ${admissions.length} admission(s) with ${references.length} RAG reference(s)`,
      );

      const response = await this.ollamaClient.summarizeBatch(admissions, {
        temperature: 0.1,
        references,
      });

      if (response.failed > 0 || response.results.some((result) => !result.success)) {
        throw new Error('One or more order summaries failed');
      }

      return response.results.map((result) => result.summary ?? '').filter(Boolean).join(' ');
    } catch (err) {
      throw new BadRequestException(
        'AI summarization service is unavailable. Try again or write the summary manually.',
      );
    }
  }

  /**
   * Retrieve up to `limit` DISTINCT APPROVED "Course in the Ward" summaries whose
   * source orders are semantically similar to `queryText`, using pgvector cosine
   * similarity over `physician_orders."orderEmbedding"`. Each returned reference
   * carries its approved summary text plus a few matching source orders.
   *
   * Best-effort: any failure (AI service down, empty corpus, dimension mismatch)
   * returns [] so summarization can still proceed without references.
   */
  private async retrieveReferences(
    queryText: string,
    limit = 3,
  ): Promise<OllamaReference[]> {
    try {
      const queryVector = await this.ollamaClient.embed(queryText);
      if (!queryVector || queryVector.length !== EMBEDDING_DIM) {
        this.logger.warn(
          `[rag] unexpected query embedding dimension: ${queryVector?.length ?? 0}`,
        );
        return [];
      }
      const literal = queryVector.map((v) => v.toFixed(8)).join(',');

      // Orders linked to an APPROVED summary, ranked by cosine similarity.
      const rows = await this.prisma.$queryRaw<SimilarReferenceRow[]>(Prisma.sql`
        SELECT
          o."summarizationId"  AS "summaryId",
          o."orderContent"     AS "orderContent",
          c."summaryContent"   AS "approvedSummary",
          1 - (o."orderEmbedding" <=> ${`[${literal}]`}::vector) AS "similarity"
        FROM "physician_orders" o
        JOIN "courses_in_ward" c ON c."id" = o."summarizationId"
        WHERE o.active = true
          AND o."orderEmbedding" IS NOT NULL
          AND c.status = 'APPROVED'
        ORDER BY o."orderEmbedding" <=> ${`[${literal}]`}::vector
        LIMIT ${limit * 8}
      `);

      // Keep the best-matching row per summary; retain up to 3 source orders.
      const best = new Map<
        string,
        { summary: string; orders: string[]; sim: number }
      >();
      for (const row of rows) {
        const key = String(row.summaryId);
        const entry =
          best.get(key) ??
          ({ summary: row.approvedSummary, orders: [], sim: row.similarity } as {
            summary: string;
            orders: string[];
            sim: number;
          });
        if (entry.orders.length < 3) entry.orders.push(row.orderContent);
        entry.sim = Math.max(entry.sim, row.similarity);
        best.set(key, entry);
      }

      return Array.from(best.values())
        .sort((a, b) => b.sim - a.sim)
        .slice(0, limit)
        .map((entry) => ({
          approvedSummary: entry.summary,
          sourceOrders: entry.orders,
          similarity: Number(entry.sim.toFixed(4)),
        }));
    } catch (err) {
      this.logger.warn(`[rag] reference retrieval failed: ${(err as Error).message}`);
      return [];
    }
  }

  // "Summarized Physician's Orders" -- generate today's Course in the Ward
  async generateSummary(patientId: string, requestedById: string) {
    const [patient, todaysOrders] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: patientId } }),
      this.ordersService.findTodaysOrders(patientId),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (todaysOrders.length === 0) {
      throw new BadRequestException('No orders recorded for this patient today');
    }

    const aiText = await this.callAiSummarizer(todaysOrders);

    const summary = await this.prisma.courseInWard.create({
      data: {
        patientId,
        summaryContent: aiText,
        status: SummaryStatus.DRAFT_AI,
      },
    });

    await this.auditLog.record({
      userId: requestedById,
      action: 'SUMMARY_GENERATED_AI',
    });

    return summary;
  }

  // "Resummarized Physician's Orders" -- option 1: physician manually edits
  async editSummary(id: string, editedText: string, physicianId: string) {
    const existing = await this.findOne(id);
    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: editedText,
        status: SummaryStatus.DRAFT_EDITED,
      },
    });

    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_EDITED_MANUAL',
    });

    return updated;
  }

  // "Resummarized Physician's Orders" -- option 2: regenerate via AI
  async regenerateSummary(id: string, physicianId: string) {
    const existing = await this.findOne(id);

    // Prefer orders written today; otherwise fall back to the orders this
    // summary was originally created from (or any of the patient's orders) so
    // regenerating an older summary still has content instead of sending an
    // empty batch to the AI service.
    let sourceOrders = await this.ordersService.findTodaysOrders(existing.patientId);
    if (sourceOrders.length === 0) {
      sourceOrders = await this.prisma.physicianOrder.findMany({
        where: {
          OR: [
            { summarizationId: existing.id },
            { admission: { patientId: existing.patientId } },
          ],
        },
        orderBy: { dateCreated: 'asc' },
      });
    }
    if (sourceOrders.length === 0) {
      throw new BadRequestException('No orders found to regenerate this summary');
    }

    const aiText = await this.callAiSummarizer(sourceOrders);

    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: aiText,
        status: SummaryStatus.DRAFT_AI,
      },
    });

    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_REGENERATED_AI',
    });

    return updated;
  }

  // Physician approves the summary they deem accurate
  async approve(id: string, physicianId: string) {
    await this.findOne(id);
    const approved = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        status: SummaryStatus.APPROVED,
        approvedStatus: true,
        validatorId: physicianId,
        validatedAt: new Date(),
      },
    });

    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_APPROVED',
    });

    return approved;
  }

  async findOne(id: string) {
    const summary = await this.prisma.courseInWard.findUnique({ where: { id } });
    if (!summary) throw new NotFoundException('Course in the Ward summary not found');
    return summary;
  }

  findForPatient(patientId: string) {
    return this.prisma.courseInWard.findMany({
      where: { patientId },
      orderBy: { summaryDate: 'desc' },
    });
  }
}
