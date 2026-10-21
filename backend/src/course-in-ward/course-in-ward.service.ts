import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OrderStatus, Prisma, SummaryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, dayLabel, detailItems, fullName } from '../audit-log/audit-log.service';
import { OrdersService } from '../orders/orders.service';
import { OllamaClient, OllamaReference } from './ollama-client';

/** Vector dimension produced by the ai-service embedding model (Qwen3-Embedding-0.6B). */
const EMBEDDING_DIM = 1024;

/** Earlier texts kept per summary; the oldest is dropped when a new one is saved. */
export const MAX_SUMMARY_VERSIONS = 3;

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

/**
 * ISO 8601 timestamp in the server's LOCAL time with its UTC offset, e.g.
 * `2026-09-29T07:30:00.000+08:00`. The AI service groups orders by the first
 * ten characters, so this keeps its day boundaries identical to `dayKeyOf`;
 * a UTC string would move early-morning orders onto the previous day.
 */
function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : null;
  const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${dayKeyOf(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

/**
 * Says why a call to the AI service failed: not running, timed out, or the
 * service's own error (`detail`), so the physician sees the actual cause.
 */
function describeAiError(err: unknown, aiServiceUrl: string): string {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
      const text = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : err.message;
      return `The AI service returned an error (HTTP ${err.response.status}): ${text}`;
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return 'The AI service took too long to respond. Try again, or summarize fewer days at once.';
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return `Cannot reach the AI service at ${aiServiceUrl}. Make sure it is running.`;
    }
  }
  return `AI summarization failed: ${(err as Error)?.message ?? String(err)}`;
}

@Injectable()
export class CourseInWardService implements OnModuleInit, OnModuleDestroy {
  private readonly aiServiceUrl: string;
  private readonly ollamaClient: OllamaClient;
  private readonly logger = new Logger(CourseInWardService.name);
  private batchTimer?: NodeJS.Timeout;

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
  private async callAiSummarizer(
    orders: any[],
    instructions?: string,
  ): Promise<DaySummaryGroup[]> {
    if (!orders || orders.length === 0) {
      this.logger.warn('[ai] callAiSummarizer received no orders');
      throw new BadRequestException('No orders found to summarize');
    }

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

    let response;
    try {
      response = await this.ollamaClient.summarizeBatch(admissions, {
        temperature: 0.1,
        references,
        instructions,
      });
    } catch (err) {
      this.logger.warn(`[ai] summarize request failed: ${(err as Error).message}`);
      throw new BadRequestException(describeAiError(err, this.aiServiceUrl));
    }

    const failed = response.results.filter((result) => !result.success);
    if (response.failed > 0 || failed.length > 0) {
      const reasons = [
        ...new Set(failed.map((result) => result.error?.replace(/\.+$/, '')).filter(Boolean)),
      ];
      throw new BadRequestException(
        `The AI could not summarize ${failed.length || response.failed} of ${response.total_groups} day(s): ` +
          (reasons.join('; ') || 'no reason given by the AI service') +
          '.',
      );
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
  async generateSummary(patientId: string, requestedById: string | null, day?: string | null) {
    const targetDay = day ?? dayKeyOf(new Date())!;
    const [patient, targetOrders] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: patientId } }),
      this.ordersService.findOrdersForDay(patientId, day ?? null),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (targetOrders.length === 0) {
      throw new BadRequestException(
        `No finished orders recorded for this patient on ${targetDay}`,
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

    // The nightly batch has no requester when the admission has no attending physician.
    if (requestedById) {
      await this.auditLog.record({
        userId: requestedById,
        action: 'SUMMARY_GENERATED_AI',
        details: {
          summary: `Generated the Course in the Ward summary for ${fullName(patient)} (${targetDay})`,
          items: detailItems([
            ['Patient', fullName(patient)],
            ['Day', targetDay],
            ['Orders summarized', targetOrders.length],
            ['Summaries saved', summaries.length],
          ]),
        },
      });
    }

    return summaries;
  }

  onModuleInit() {
    this.scheduleNightlyBatch();
  }

  onModuleDestroy() {
    clearTimeout(this.batchTimer);
  }

  /**
   * Arms a timer for the next `SUMMARY_BATCH_TIME` (server-local `HH:mm`,
   * default `23:59`; `off` disables it). Re-arms itself after every run.
   */
  private scheduleNightlyBatch() {
    const raw = (this.config.get<string>('SUMMARY_BATCH_TIME') ?? '23:59').trim();
    if (raw.toLowerCase() === 'off') {
      this.logger.log('[batch] nightly summarization disabled (SUMMARY_BATCH_TIME=off)');
      return;
    }
    let match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw);
    if (!match) {
      this.logger.warn(`[batch] invalid SUMMARY_BATCH_TIME "${raw}", using 23:59`);
      match = /^(\d+):(\d+)$/.exec('23:59')!;
    }

    const now = new Date();
    const next = new Date(now);
    next.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    this.logger.log(`[batch] next nightly summarization at ${next.toString()}`);
    this.batchTimer = setTimeout(() => {
      this.runBatchSummaries()
        .catch((err) => this.logger.error(`[batch] run failed: ${(err as Error).message}`))
        .finally(() => this.scheduleNightlyBatch());
    }, next.getTime() - now.getTime());
  }

  /**
   * Generates the AI draft of `day` (today by default) for every patient who
   * still has FINISHED orders that day not linked to a summary. Patients are processed
   * one at a time so the local LLM is never flooded; one failure doesn't stop
   * the rest. Audit entries are attributed to the attending physician.
   */
  async runBatchSummaries(day: string = dayKeyOf(new Date())!) {
    const start = dayStart(day);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const admissions = await this.prisma.patientAdmission.findMany({
      where: {
        orders: {
          some: {
            dateCreated: { gte: start, lt: end },
            status: OrderStatus.FINISHED,
            summarizationId: null,
          },
        },
      },
      select: { patientId: true, physicianId: true },
    });
    const patients = new Map(admissions.map((a) => [a.patientId, a.physicianId]));

    let done = 0;
    for (const [patientId, physicianId] of patients) {
      try {
        await this.generateSummary(patientId, physicianId, day);
        done++;
      } catch (err) {
        this.logger.warn(`[batch] patient ${patientId}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`[batch] ${day}: summarized ${done}/${patients.size} patient(s)`);
    return { day, patients: patients.size, summarized: done };
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
      await this.saveVersion(existingDraft, content);
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
    await this.saveVersion(existing, editedText);
    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: editedText,
        status: SummaryStatus.DRAFT_EDITED,
      },
    });

    const patientName = await this.auditLog.patientName({ patientId: existing.patientId });
    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_EDITED_MANUAL',
      details: {
        summary: `Edited ${patientName}'s summary for ${dayLabel(existing.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayLabel(existing.summaryDate)],
        ]),
        changes: [{ field: 'Summary text', from: existing.summaryContent, to: editedText }],
      },
    });

    return updated;
  }

  // "Resummarized Physician's Orders" -- option 2: regenerate via AI, optionally
  // steered by the physician's extra prompt instructions.
  async regenerateSummary(id: string, physicianId: string, instructions?: string) {
    const existing = await this.findOne(id);

    const sourceOrders = await this.findSummarySourceOrders(existing);
    if (sourceOrders.length === 0) {
      throw new BadRequestException('No orders found to regenerate this summary');
    }

    // Keep the summary filed under the day it already covers: when the source
    // orders span more than one day, take that day's group.
    const summaryDay = dayKeyOf(existing.summaryDate);
    const groups = await this.callAiSummarizer(sourceOrders, instructions);
    const group = groups.find((candidate) => candidate.day === summaryDay) ?? groups[0];
    if (!group?.summary) {
      throw new BadRequestException('No orders found to regenerate this summary');
    }

    await this.saveVersion(existing, group.summary);
    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: group.summary,
        status: SummaryStatus.DRAFT_AI,
        ...(group.day ? { summaryDate: dayStart(group.day) } : {}),
      },
    });

    await this.linkOrdersToSummary(updated.id, group.orderIds);

    const patientName = await this.auditLog.patientName({ patientId: existing.patientId });
    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_REGENERATED_AI',
      details: {
        summary: `Regenerated ${patientName}'s summary for ${dayLabel(updated.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayLabel(updated.summaryDate)],
          ['Extra instructions', instructions?.trim()],
        ]),
        changes: [{ field: 'Summary text', from: existing.summaryContent, to: group.summary }],
      },
    });

    return updated;
  }

  /**
   * The orders a summary should be rebuilt from. Every order written on the day
   * it covers comes first, so orders added after the last generation are
   * included. Older summaries whose day holds no orders fall back to the orders
   * they are linked to, and finally to anything the patient has -- so there is
   * always content instead of an empty batch for the AI service.
   */
  private async findSummarySourceOrders(summary: { id: string; patientId: string; summaryDate: Date }) {
    const day = dayKeyOf(summary.summaryDate);
    if (day) {
      const sameDay = await this.ordersService.findOrdersForDay(summary.patientId, day);
      if (sameDay.length) return sameDay;
    }

    const linked = await this.prisma.physicianOrder.findMany({
      where: { summarizationId: summary.id, status: OrderStatus.FINISHED },
      orderBy: { dateCreated: 'asc' },
      include: { admission: { select: { id: true, admissionDate: true } } },
    });
    if (linked.length) return linked;

    return this.prisma.physicianOrder.findMany({
      where: { admission: { patientId: summary.patientId }, status: OrderStatus.FINISHED },
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

    // Approving from the workspace also answers any claim that was waiting on
    // this summary, so the claims processor can move on to CF4.
    await this.prisma.summaryApprovalRequest.updateMany({
      where: { summaryId: id, status: { in: ['PENDING', 'PHYSICIAN_VALIDATION_REQUESTED'] } },
      data: { status: 'VALIDATED' },
    });

    // The approved text is final, so the drafts before it are no longer needed.
    await this.prisma.summaryVersion.deleteMany({ where: { summaryId: id } });

    const patientName = await this.auditLog.patientName({ patientId: approved.patientId });
    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_APPROVED',
      details: {
        summary: `Approved ${patientName}'s summary for ${dayLabel(approved.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayLabel(approved.summaryDate)],
        ]),
      },
    });

    return approved;
  }

  /** Earlier texts of a summary, newest first (at most `MAX_SUMMARY_VERSIONS`). */
  async listVersions(id: string) {
    await this.findOne(id);
    return this.prisma.summaryVersion.findMany({
      where: { summaryId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Bring an earlier text back as the current summary. The text it replaces
   * becomes a version itself, so a restore can be undone the same way.
   */
  async restoreVersion(id: string, versionId: string, physicianId: string) {
    const existing = await this.findOne(id);
    const version = await this.prisma.summaryVersion.findFirst({
      where: { id: versionId, summaryId: id },
    });
    if (!version) throw new NotFoundException('Summary version not found');

    // Drop it before saving the current text, or the cap could prune it first.
    await this.prisma.summaryVersion.delete({ where: { id: versionId } });
    await this.saveVersion(existing, version.content);
    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: version.content,
        // A restored text needs approving again, even if it once was.
        status:
          version.source === SummaryStatus.DRAFT_AI
            ? SummaryStatus.DRAFT_AI
            : SummaryStatus.DRAFT_EDITED,
      },
    });

    const patientName = await this.auditLog.patientName({ patientId: existing.patientId });
    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_VERSION_RESTORED',
      details: {
        summary: `Restored an earlier version of ${patientName}'s summary for ${dayLabel(existing.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayLabel(existing.summaryDate)],
          ['Version saved on', dayLabel(version.createdAt)],
        ]),
        changes: [{ field: 'Summary text', from: existing.summaryContent, to: version.content }],
      },
    });

    return updated;
  }

  /**
   * Keep the text a summary is about to lose as a version, then trim its
   * history to the newest `MAX_SUMMARY_VERSIONS`. Unchanged or empty text
   * is not kept.
   */
  private async saveVersion(
    summary: { id: string; summaryContent: string; status: SummaryStatus },
    nextContent: string,
  ) {
    if (!summary.summaryContent || summary.summaryContent === nextContent) return;
    await this.prisma.summaryVersion.create({
      data: { summaryId: summary.id, content: summary.summaryContent, source: summary.status },
    });
    const stale = await this.prisma.summaryVersion.findMany({
      where: { summaryId: summary.id },
      orderBy: { createdAt: 'desc' },
      skip: MAX_SUMMARY_VERSIONS,
      select: { id: true },
    });
    if (stale.length) {
      await this.prisma.summaryVersion.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
    }
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
