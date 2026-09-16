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

/** The AI's output for ONE admission-day group. */
interface DaySummaryGroup {
  /** Local `YYYY-MM-DD` of the group's orders; `null` when the date was unusable. */
  day: string | null;
  summary: string;
  /** Ids of the orders this group was built from. */
  orderIds: string[];
}

/** Local `YYYY-MM-DD` key of a timestamp, matching how the UI buckets order days. */
function dayKeyOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Midnight (local) of a `YYYY-MM-DD` key: the `summaryDate` of that day's Course in the Ward. */
function dayStart(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month || 1) - 1, date || 1);
}

/** ISO string for either a `Date` or an already-serialized timestamp. */
function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
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
  //
  // The AI summarizes per admission PER DAY, so a batch spanning several days
  // comes back as one group per (admission, calendar day). Each group keeps the
  // orders it was built from, which is how the caller files it under a day.
  private async callAiSummarizer(orders: any[]): Promise<DaySummaryGroup[]> {
    if (!orders || orders.length === 0) {
      this.logger.warn('[ai] callAiSummarizer received no orders');
      throw new BadRequestException('No orders found to summarize');
    }

    try {
      // Group the incoming orders by admission so the AI service can label each
      // admission-day group correctly.
      interface AdmissionBucket {
        admissionDate: Date | null;
        orders: any[];
      }
      const byAdmission = new Map<string, AdmissionBucket>();
      for (const order of orders) {
        const key: string = order.admissionId ?? 'no-admission';
        let bucket = byAdmission.get(key);
        if (!bucket) {
          bucket = {
            admissionDate: order.admission?.admissionDate ?? null,
            orders: [] as any[],
          };
          byAdmission.set(key, bucket);
        }
        bucket.orders.push(order);
      }

      const admissions = Array.from(byAdmission.entries()).map(([admissionId, bucket]) => ({
        admissionId,
        admissionDate: toIso(bucket.admissionDate),
        orders: bucket.orders.map((order) => ({
          id: String(order.id),
          text: order.orderContent,
          dateCreated: toIso(order.dateCreated),
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

      return response.results
        .filter((result) => Boolean(result.summary))
        .map((result) => {
          const memberOrders = result.orders ?? [];
          // Every member order of a group shares the group's calendar day, so
          // the earliest one names the day the summary belongs to.
          const groupDays = memberOrders
            .map((order) => dayKeyOf(order.dateCreated))
            .filter((day): day is string => Boolean(day))
            .sort();
          return {
            day: groupDays[0] ?? null,
            summary: result.summary as string,
            orderIds: memberOrders.map((order) => String(order.id)),
          };
        });
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

  // "Summarized Physician's Orders" -- generate the Course in the Ward of ONE
  // order day (today by default). The AI groups its output per admission-day,
  // so a day spent under two admissions still files as one summary per
  // admission, each stored against the day it summarizes.
  async generateSummary(patientId: string, requestedById: string, day?: string | null) {
    const targetDay = day ?? dayKeyOf(new Date())!;
    const [patient, targetOrders] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: patientId } }),
      this.ordersService.findOrdersForDay(patientId, day ?? null),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (targetOrders.length === 0) {
      throw new BadRequestException(
        `No orders recorded for this patient on ${targetDay}`,
      );
    }

    const groups = await this.callAiSummarizer(targetOrders);

    const summaries = [];
    for (const [index, group] of groups.entries()) {
      const summaryDay = group.day ?? targetDay;
      const orderIds = group.orderIds.length
        ? group.orderIds
        : targetOrders.map((order) => String(order.id));

      const summary = await this.upsertDaySummary(
        patientId,
        summaryDay,
        group.summary,
        index,
      );
      await this.linkOrdersToSummary(summary.id, orderIds);
      summaries.push(summary);
    }

    await this.auditLog.record({
      userId: requestedById,
      action: 'SUMMARY_GENERATED_AI',
    });

    return summaries;
  }

  /**
   * One Course in the Ward per patient per day: re-submitting a day refreshes
   * that day's *working draft* in place instead of piling up duplicate rows.
   * An APPROVED summary is never overwritten -- a claim may already reference
   * it -- so a fresh draft is filed alongside it.
   *
   * `groupIndex` pairs the Nth group of a day with the Nth draft of that day,
   * which keeps day-by-day regeneration stable when a day holds more than one
   * admission.
   */
  private async upsertDaySummary(
    patientId: string,
    day: string,
    content: string,
    groupIndex = 0,
  ) {
    const summaryDate = dayStart(day);
    const existingDraft = await this.prisma.courseInWard.findFirst({
      where: { patientId, summaryDate, status: { not: SummaryStatus.APPROVED } },
      orderBy: { id: 'asc' },
      skip: groupIndex,
    });

    if (existingDraft) {
      return this.prisma.courseInWard.update({
        where: { id: existingDraft.id },
        data: { summaryContent: content, status: SummaryStatus.DRAFT_AI },
      });
    }

    return this.prisma.courseInWard.create({
      data: {
        patientId,
        summaryContent: content,
        summaryDate,
        status: SummaryStatus.DRAFT_AI,
      },
    });
  }

  /**
   * Point a summary's source orders at it (`summarizationId`). Best effort: the
   * summary itself is already saved and a failed link only costs the RAG corpus
   * one exemplar.
   */
  private async linkOrdersToSummary(summaryId: string, orderIds: string[]) {
    if (orderIds.length === 0) return;
    try {
      await this.prisma.physicianOrder.updateMany({
        where: { id: { in: orderIds } },
        data: { summarizationId: summaryId },
      });
    } catch (err) {
      this.logger.warn(
        `[summary] could not link orders to summary ${summaryId}: ${(err as Error).message}`,
      );
    }
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

    const sourceOrders = await this.findSummarySourceOrders(existing);
    if (sourceOrders.length === 0) {
      throw new BadRequestException('No orders found to regenerate this summary');
    }

    // Keep the summary filed under the day it already covers: when the source
    // orders span more than one day, take that day's group.
    const summaryDay = dayKeyOf(existing.summaryDate);
    const groups = await this.callAiSummarizer(sourceOrders);
    const group = groups.find((candidate) => candidate.day === summaryDay) ?? groups[0];
    if (!group?.summary) {
      throw new BadRequestException('No orders found to regenerate this summary');
    }

    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: group.summary,
        status: SummaryStatus.DRAFT_AI,
        ...(group.day ? { summaryDate: dayStart(group.day) } : {}),
      },
    });

    await this.linkOrdersToSummary(updated.id, group.orderIds);

    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_REGENERATED_AI',
    });

    return updated;
  }

  /**
   * The orders a summary should be rebuilt from, most specific first: the
   * orders it is linked to, then the orders of the day it covers, and finally
   * anything the patient has -- so regenerating an older summary still has
   * content instead of sending an empty batch to the AI service.
   */
  private async findSummarySourceOrders(summary: { id: string; patientId: string; summaryDate: Date }) {
    const linked = await this.prisma.physicianOrder.findMany({
      where: { summarizationId: summary.id },
      orderBy: { dateCreated: 'asc' },
      include: { admission: { select: { id: true, admissionDate: true } } },
    });
    if (linked.length) return linked;

    const day = dayKeyOf(summary.summaryDate);
    if (day) {
      const sameDay = await this.ordersService.findOrdersForDay(summary.patientId, day);
      if (sameDay.length) return sameDay;
    }

    return this.prisma.physicianOrder.findMany({
      where: { admission: { patientId: summary.patientId } },
      orderBy: { dateCreated: 'asc' },
      include: { admission: { select: { id: true, admissionDate: true } } },
    });
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
      // The orders a summary was built from carry the day it covers.
      include: { orders: { select: { id: true, dateCreated: true } } },
    });
  }
}
