import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiCallKind, NotificationType, OrderStatus, Prisma, Role, SummaryStatus } from '@prisma/client';
import { AiTrigger, timeAiCall } from './ai-metrics';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, detailItems, fullName } from '../audit-log/audit-log.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OllamaClient, OllamaReference, SummaryModel } from './ollama-client';
import { assertFormattingOnlyInstructions } from './summary-instructions';
import {
  CARE_TEAM_ADMISSION_SELECT,
  assertAttending,
  assertConsultingCanNotifyAttending,
  isConsultingOnly,
  loadSummaryAdmission,
  manilaDayKey,
  summaryAdmission,
} from './summary-access';

/**
 * The source orders every summary the API returns carries: they give its day,
 * and their text, timeline and people back the "Composed from" view.
 */
const SUMMARY_ORDERS = {
  orders: {
    orderBy: { dateCreated: 'asc' },
    select: {
      id: true,
      admissionId: true,
      dateCreated: true,
      orderContent: true,
      status: true,
      type: true,
      executedAt: true,
      orderedBy: { select: { firstName: true, lastName: true } },
      executedBy: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.CourseInWardInclude;

/** Vector dimension produced by the ai-service embedding model (Qwen3-Embedding-0.6B). */
const EMBEDDING_DIM = 1024;

/** How each AI model is named in the audit log. */
const MODEL_LABEL: Record<SummaryModel, string> = {
  standard: 'Base Model',
  fine_tuned: 'Fine-tuned',
  fine_tuned_rag: 'Fine-tuned + RAG',
};

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
export function dayKeyOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * `YYYY-MM-DD` of a summary day for messages and logs. `summaryDate` is local
 * midnight, so a UTC rendering would name the previous day.
 */
function dayText(value: Date | string | null | undefined): string {
  return dayKeyOf(value) ?? '—';
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
    private notifications: NotificationsService,
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
  //
  // `model` picks the writer: `standard` is the base model guided by RAG
  // references; `fine_tuned` already learned the style, and was trained without
  // references, so it gets none; `fine_tuned_rag` is the fine-tuned model given them anyway.
  private async callAiSummarizer(
    orders: any[],
    instructions?: string,
    model: SummaryModel = 'standard',
    trigger: AiTrigger = 'manual',
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
    const references =
      model !== 'fine_tuned' && queryText ? await this.retrieveReferences(queryText) : [];

    this.logger.log(
      `[ai] summarizing ${orders.length} order(s) across ${admissions.length} admission(s) with the ${model} model and ${references.length} RAG reference(s)`,
    );

    let response;
    try {
      response = await timeAiCall(
        this.prisma,
        { kind: AiCallKind.SUMMARY, model, trigger, itemCount: orders.length },
        () =>
          this.ollamaClient.summarizeBatch(admissions, {
            temperature: 0.1,
            references,
            instructions,
            model,
          }),
        (result) => {
          const failures = result.results.filter((group) => !group.success);
          return {
            success: result.failed === 0 && failures.length === 0,
            outputChars: result.results.reduce((sum, group) => sum + (group.summary?.length ?? 0), 0),
            referenceCount: references.length,
            topSimilarity: references[0]?.similarity ?? null,
            error: failures.map((group) => group.error).filter(Boolean).join('; ') || null,
          };
        },
      );
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
      const { embeddings } = await timeAiCall(
        this.prisma,
        { kind: AiCallKind.EMBEDDING, model: 'embedding', trigger: 'rag-query' },
        () => this.ollamaClient.embedTexts([queryText]),
        (result) => ({ model: result.model }),
      );
      const queryVector = embeddings[0];
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
  async generateSummary(
    patientId: string,
    requestedById: string | null,
    day?: string | null,
    model: SummaryModel = 'standard',
    instructions?: string,
    trigger: AiTrigger = 'manual',
    notifyClaims = true,
  ) {
    const targetDay = day ?? dayKeyOf(new Date())!;
    const [patient, dayOrders] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: patientId } }),
      this.ordersService.findOrdersForDay(patientId, day ?? null),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (dayOrders.length === 0) {
      throw new BadRequestException(
        `No accomplished orders recorded for this patient on ${targetDay}`,
      );
    }

    // An admission-day that is already APPROVED is never re-drafted here: a new
    // draft would re-link its orders away from the approved summary (and its
    // claim). Late orders on such a day go through Regenerate on that summary.
    const approvedAdmissions = new Set(
      dayOrders
        .filter((order) => order.summary?.status === SummaryStatus.APPROVED)
        .map((order) => order.admissionId),
    );
    const targetOrders = dayOrders.filter((order) => !approvedAdmissions.has(order.admissionId));
    if (targetOrders.length === 0) {
      throw new ConflictException(
        `The Course in the Ward for ${targetDay} is already approved; regenerate it to include new orders`,
      );
    }

    // Generate takes the same FORMATTING-only instructions as Regenerate: they
    // steer how the orders are worded, never what they say.
    const extraInstructions = instructions?.trim() || undefined;
    assertFormattingOnlyInstructions(
      extraInstructions,
      targetOrders.map((order) => order.orderContent),
    );

    const groups = await this.callAiSummarizer(targetOrders, extraInstructions, model, trigger);

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
      summaries.push(await this.withOrders(summary.id));
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
            ['AI model', MODEL_LABEL[model]],
            ['Orders summarized', targetOrders.length],
            ['Summaries saved', summaries.length],
            ['Extra instructions', extraInstructions],
          ]),
        },
      });
    }

    if (notifyClaims) {
      await Promise.all(
        summaries.map((summary) =>
          this.notifications.notifyRole(Role.CLAIMS_PROCESSOR, {
            title: 'Course in the Ward summary ready',
            message: `**${fullName(patient)}** has a new Course in the Ward summary for ${dayText(summary.summaryDate)} ready for claims review.`,
          }),
        ),
      );
    }

    return summaries;
  }

  onModuleInit() {
    this.ordersService.onDischarge((admissionId, nurseId) => {
      void this.prepareClaimForDischargedAdmission(admissionId, nurseId);
    });
    this.scheduleNightlyBatch();
    // Stays discharged before this handoff existed still need a summary, or the
    // claims processor never sees them.
    void this.catchUpDischargedClaims();
  }

  /**
   * A claim is opened only when Claims requests one, so discharge must leave
   * one Course in the Ward per day of finished orders. The AI writes it when
   * available; otherwise the finished orders are filed as the draft. Claims
   * then sees the stay under Discharged patients and can request the physician.
   */
  async prepareClaimForDischargedAdmission(admissionId: string, dischargedById?: string) {
    try {
      await this.fileDischargedStay(admissionId, dischargedById);
    } catch (err) {
      this.logger.warn(
        `[discharge] could not prepare summaries for admission ${admissionId}: ${(err as Error).message}`,
      );
    }
  }

  private async fileDischargedStay(admissionId: string, dischargedById?: string) {
    const admission = await this.prisma.patientAdmission.findUnique({
      where: { id: admissionId },
      select: {
        id: true,
        patientId: true,
        physicianId: true,
        dischargeDate: true,
        patient: { select: { firstName: true, lastName: true } },
        orders: {
          where: { status: OrderStatus.FINISHED, active: true, summarizationId: null },
          orderBy: { dateCreated: 'asc' },
          select: { id: true, dateCreated: true, orderContent: true },
        },
      },
    });
    if (!admission?.dischargeDate) return;

    const byDay = new Map<string, typeof admission.orders>();
    for (const order of admission.orders) {
      const day = dayKeyOf(order.dateCreated);
      if (!day) continue;
      const group = byDay.get(day) ?? [];
      group.push(order);
      byDay.set(day, group);
    }

    for (const [day, orders] of byDay) {
      try {
        await this.generateSummary(
          admission.patientId,
          admission.physicianId,
          day,
          'standard',
          undefined,
          'discharge',
          false,
        );
      } catch (err) {
        this.logger.warn(
          `[discharge] AI summary failed for admission ${admissionId} on ${day}: ${(err as Error).message}`,
        );
        // Approved day: the physician regenerates it; a fallback draft would steal its orders.
        if (err instanceof ConflictException) continue;
        const summary = await this.upsertDaySummary(
          admission.patientId,
          day,
          `Finished orders for ${day}:\n${orders
            .map((order) => `• ${order.orderContent}`)
            .join('\n')}`,
        );
        await this.linkOrdersToSummary(summary.id, orders.map((order) => order.id));
      }
    }

    await this.notifyClaimsStayReady(admission, dischargedById);
  }

  /**
   * Tell Claims a discharged stay is ready under Discharged patients — do not
   * open a claim. Claims opens the request and notifies the attending.
   */
  private async notifyClaimsStayReady(
    admission: {
      id: string;
      patientId: string;
      physicianId: string | null;
      patient: { firstName: string; lastName: string };
    },
    dischargedById?: string,
  ) {
    const summaries = await this.prisma.courseInWard.findMany({
      where: { requests: { none: {} }, orders: { some: { admissionId: admission.id } } },
      orderBy: { summaryDate: 'asc' },
      select: { id: true, summaryDate: true },
    });
    if (!summaries.length) return;

    const name = fullName(admission.patient);
    const daysLabel = `${summaries.length} Course in the Ward ${summaries.length === 1 ? 'day' : 'days'}`;

    if (dischargedById) {
      await this.auditLog.record({
        userId: dischargedById,
        action: 'PATIENT_DISCHARGED',
        details: {
          summary: `Discharged ${name}; ${daysLabel} ready for a Claims request`,
          items: detailItems([
            ['Patient', name],
            ['Days', summaries.map((entry) => dayText(entry.summaryDate)).join(', ')],
          ]),
        },
      });
    }

    await this.notifications.notifyRole(Role.CLAIMS_PROCESSOR, {
      title: 'Discharged patient ready for claim',
      message: `**${name}** was discharged. ${daysLabel} ${summaries.length === 1 ? 'is' : 'are'} waiting under Discharged patients for a claim request.`,
      patientId: admission.patientId,
    });
  }

  /** Discharged stays that still need Course in the Ward drafts before Claims can request. */
  private async catchUpDischargedClaims() {
    const admissions = await this.prisma.patientAdmission.findMany({
      where: {
        dischargeDate: { not: null },
        orders: {
          some: { status: OrderStatus.FINISHED, active: true, summarizationId: null },
        },
      },
      select: { id: true },
    });
    for (const admission of admissions) {
      await this.prepareClaimForDischargedAdmission(admission.id);
    }
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
   * `patientId` limits the run to one patient (the admin's catch-up button).
   */
  async runBatchSummaries(day: string = dayKeyOf(new Date())!, patientId?: string) {
    const start = dayStart(day);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const admissions = await this.prisma.patientAdmission.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
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
        await this.generateSummary(patientId, physicianId, day, 'standard', undefined, 'batch');
        done++;
      } catch (err) {
        this.logger.warn(`[batch] patient ${patientId}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`[batch] ${day}: summarized ${done}/${patients.size} patient(s)`);
    return { day, patients: patients.size, summarized: done };
  }

  /**
   * Patient-days before today that the nightly batch should have drafted but
   * didn't (server off at `SUMMARY_BATCH_TIME`, AI down, ...): FINISHED orders
   * not linked to a summary, on a day with no Course in the Ward at all. Days
   * that already have one are left out: an order finished after the summary
   * is the physician's to handle (see `notifyFinishedAfterSummary`).
   */
  async missedNightlyDays() {
    const orders = await this.prisma.physicianOrder.findMany({
      where: {
        status: OrderStatus.FINISHED,
        summarizationId: null,
        dateCreated: { lt: dayStart(dayKeyOf(new Date())!) },
      },
      select: {
        dateCreated: true,
        admission: {
          select: {
            patientId: true,
            dischargeDate: true,
            patient: { select: { firstName: true, lastName: true } },
            physician: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!orders.length) return [];

    const patientIds = [...new Set(orders.map((order) => order.admission.patientId))];
    const summaries = await this.prisma.courseInWard.findMany({
      where: { patientId: { in: patientIds } },
      select: { patientId: true, summaryDate: true },
    });
    const summarized = new Set(summaries.map((s) => `${s.patientId}:${dayKeyOf(s.summaryDate)}`));

    const rows = new Map<
      string,
      {
        day: string;
        patientId: string;
        patientName: string;
        physicianName: string | null;
        discharged: boolean;
        orders: number;
      }
    >();
    for (const order of orders) {
      const day = dayKeyOf(order.dateCreated);
      const key = `${order.admission.patientId}:${day}`;
      if (!day || summarized.has(key)) continue;
      const row = rows.get(key);
      if (row) {
        row.orders++;
        continue;
      }
      const { patient, physician } = order.admission;
      rows.set(key, {
        day,
        patientId: order.admission.patientId,
        patientName: fullName(patient),
        physicianName: physician ? fullName(physician) : null,
        discharged: order.admission.dischargeDate != null,
        orders: 1,
      });
    }
    return [...rows.values()].sort(
      (a, b) => b.day.localeCompare(a.day) || a.patientName.localeCompare(b.patientName),
    );
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

  private async notifyClaimProcessors(summaryId: string, message: string) {
    const claims = await this.prisma.summaryApprovalRequest.findMany({
      where: { summaryId },
      select: { processorId: true },
    });
    await this.notifications.notifyUsers(
      claims.map(({ processorId }) => processorId),
      { title: 'Course in the Ward summary updated', message },
    );
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
        summary: `Edited ${patientName}'s summary for ${dayText(existing.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayText(existing.summaryDate)],
        ]),
        changes: [{ field: 'Summary text', from: existing.summaryContent, to: editedText }],
      },
    });

    await this.notifyClaimProcessors(
      id,
      `${patientName}'s summary for ${dayText(existing.summaryDate)} was edited and needs physician approval again.`,
    );

    // Consulting physicians (discharged stays only) tell the attending once per
    // Manila day that they reviewed / edited this draft; attending still approves.
    await this.maybeNotifyAttendingAfterConsultWork(
      id,
      physicianId,
      `Edited the Course in the Ward draft for ${dayText(existing.summaryDate)}.`,
    );

    return this.withOrders(updated.id, physicianId);
  }

  /**
   * Consulting physician → attending: endorse / flag a day's draft for final
   * approval. Allowed once per Manila calendar day per summary, and only after
   * discharge. Does not approve the summary or the claim.
   */
  async notifyAttending(summaryId: string, physicianId: string, message?: string) {
    const admission = await assertConsultingCanNotifyAttending(
      this.prisma,
      summaryId,
      physicianId,
    );
    const summary = await this.findOne(summaryId);
    const dayKey = manilaDayKey();
    const note = message?.trim() || null;

    try {
      await this.prisma.summaryConsultantNotice.create({
        data: {
          summaryId,
          physicianId,
          dayKey,
          message: note,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          "You already notified the attending about this day's summary today.",
        );
      }
      throw error;
    }

    const [patientName, consultantName] = await Promise.all([
      this.auditLog.patientName({ patientId: summary.patientId }),
      this.auditLog.userLabel(physicianId),
    ]);
    const day = dayText(summary.summaryDate);
    await this.auditLog.record({
      userId: physicianId,
      action: 'CLAIM_PHYSICIAN_NOTIFIED',
      details: {
        summary: `Notified attending about ${patientName}'s summary for ${day}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', day],
          ['Attending', await this.auditLog.userLabel(admission.physicianId!)],
          ['Note', note],
        ]),
      },
    });

    await this.notifications.notifyUsers([admission.physicianId!], {
      type: NotificationType.REVIEW_REQUESTED,
      title: 'Consulting physician approved a summary',
      message:
        `**${consultantName}** approved **${patientName}**'s Course in the Ward for ${day}` +
        (note ? `: ${note}` : '.') +
        ' Open the patient chart to give the final approval.',
      patientId: summary.patientId,
    });

    return this.withOrders(summaryId, physicianId);
  }

  /** Best-effort consulting→attending notice after an edit (ignores rate-limit / role). */
  private async maybeNotifyAttendingAfterConsultWork(
    summaryId: string,
    physicianId: string,
    message: string,
  ) {
    const admission = await loadSummaryAdmission(this.prisma, summaryId);
    if (!isConsultingOnly(admission, physicianId) || !admission?.dischargeDate) return;
    try {
      await this.notifyAttending(summaryId, physicianId, message);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) return;
      throw error;
    }
  }

  // "Resummarized Physician's Orders" -- option 2: regenerate via AI, optionally
  // steered by the physician's extra prompt instructions.
  async regenerateSummary(
    id: string,
    physicianId: string,
    instructions?: string,
    model: SummaryModel = 'standard',
  ) {
    const existing = await this.findOne(id);

    const sourceOrders = await this.findSummarySourceOrders(existing);
    if (sourceOrders.length === 0) {
      throw new BadRequestException('No orders found to regenerate this summary');
    }

    // The extra instructions are FORMATTING instructions: they steer how the
    // orders are worded, never what they say. A request to add clinical content
    // is rejected here instead of reaching the AI (see summary-instructions.ts).
    const extraInstructions = instructions?.trim() || undefined;
    assertFormattingOnlyInstructions(
      extraInstructions,
      sourceOrders.map((order) => order.orderContent),
    );

    // Keep the summary filed under the day it already covers: when the source
    // orders span more than one day, take that day's group.
    const summaryDay = dayKeyOf(existing.summaryDate);
    const groups = await this.callAiSummarizer(sourceOrders, extraInstructions, model, 'regenerate');
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
        summary: `Regenerated ${patientName}'s summary for ${dayText(updated.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayText(updated.summaryDate)],
          ['AI model', MODEL_LABEL[model]],
          ['Extra instructions', extraInstructions],
        ]),
        changes: [{ field: 'Summary text', from: existing.summaryContent, to: group.summary }],
      },
    });

    await this.notifyClaimProcessors(
      id,
      `${patientName}'s summary for ${dayText(updated.summaryDate)} was regenerated and needs physician approval again.`,
    );

    return this.withOrders(updated.id);
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

  /**
   * Physician approves the summary they deem accurate.
   * `completeClaim` (default true) also answers a PHYSICIAN_VALIDATION_REQUESTED
   * claim — set false for per-day approve in the Requests review so
   * "Approve request" remains the whole-stay sign-off.
   */
  async approve(id: string, physicianId: string, completeClaim = true) {
    await this.findOne(id);
    await assertAttending(this.prisma, id, physicianId);
    const approved = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        status: SummaryStatus.APPROVED,
        approvedStatus: true,
        validatorId: physicianId,
        validatedAt: new Date(),
      },
    });

    // Approving from the workspace only answers claims claims has already asked
    // the physician to validate — bare PENDING (filed/auto-opened) stays open.
    const waitingClaims = completeClaim
      ? await this.prisma.summaryApprovalRequest.findMany({
          where: { summaryId: id, status: 'PHYSICIAN_VALIDATION_REQUESTED' },
          select: { id: true, processorId: true },
        })
      : [];
    if (waitingClaims.length) {
      await this.prisma.summaryApprovalRequest.updateMany({
        where: { summaryId: id, status: 'PHYSICIAN_VALIDATION_REQUESTED' },
        data: { status: 'VALIDATED' },
      });
    }

    // The approved text is final, so the drafts before it are no longer needed.
    await this.prisma.summaryVersion.deleteMany({ where: { summaryId: id } });

    const patientName = await this.auditLog.patientName({ patientId: approved.patientId });
    const physicianName = await this.auditLog.userLabel(physicianId);
    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_APPROVED',
      details: {
        summary: `Approved ${patientName}'s summary for ${dayText(approved.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayText(approved.summaryDate)],
        ]),
      },
    });

    if (waitingClaims.length) {
      await Promise.all(
        waitingClaims.map((claim) =>
          this.notifications.create({
            userId: claim.processorId,
            type: NotificationType.REVIEW_REQUESTED,
            title: 'Course in the Ward summary approved',
            message: `**${physicianName}** approved **${patientName}**'s Course in the Ward for ${dayText(approved.summaryDate)}. It is ready for CF4 processing.`,
            requestId: claim.id,
          }),
        ),
      );
    } else if (completeClaim) {
      await this.notifications.notifyRole(Role.CLAIMS_PROCESSOR, {
        title: 'Course in the Ward summary approved',
        message: `**${physicianName}** approved **${patientName}**'s Course in the Ward for ${dayText(approved.summaryDate)}. It is ready for a claim request.`,
      });
    }

    return this.withOrders(approved.id);
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
        summary: `Restored an earlier version of ${patientName}'s summary for ${dayText(existing.summaryDate)}`,
        items: detailItems([
          ['Patient', patientName],
          ['Summary day', dayText(existing.summaryDate)],
          ['Version saved on', dayText(version.createdAt)],
        ]),
        changes: [{ field: 'Summary text', from: existing.summaryContent, to: version.content }],
      },
    });

    await this.notifyClaimProcessors(
      id,
      `${patientName}'s summary for ${dayText(updated.summaryDate)} was restored to an earlier version and needs physician approval again.`,
    );

    return this.withOrders(updated.id);
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

  /**
   * A summary as the API returns it, with its source orders. Every write
   * returns this, or the client's copy would lose its orders (and its day)
   * until the next full reload.
   */
  private async withOrders(id: string, viewerId?: string) {
    const summary = await this.prisma.courseInWard.findUniqueOrThrow({
      where: { id },
      include: SUMMARY_ORDERS,
    });
    return (await this.withAttending([summary], viewerId))[0];
  }

  /**
   * Adds attending / discharge / consulting-approval fields so the UI can offer
   * Approve only to the attending, and "Approve summary" (notify) to consultants.
   */
  private async withAttending<
    T extends { id?: string; patientId: string; summaryDate: Date; orders?: { admissionId?: string | null }[] },
  >(
    summaries: T[],
    viewerId?: string,
  ): Promise<
    (T & {
      attendingPhysicianId: string | null;
      admissionDischarged: boolean;
      viewerIsConsulting: boolean;
      myConsultantNoticeAt: string | null;
      consultantApprovals: Array<{
        physicianId: string;
        name: string;
        notifiedAt: string;
      }>;
    })[]
  > {
    if (!summaries.length) return [];
    const admissions = await this.prisma.patientAdmission.findMany({
      where: { patientId: { in: [...new Set(summaries.map((s) => s.patientId))] } },
      select: { ...CARE_TEAM_ADMISSION_SELECT, patientId: true },
    });
    const summaryIds = summaries
      .map((summary) => summary.id)
      .filter((id): id is string => Boolean(id));
    const today = manilaDayKey();
    const notices = summaryIds.length
      ? await this.prisma.summaryConsultantNotice.findMany({
          where: { summaryId: { in: summaryIds } },
          orderBy: { notifiedAt: 'desc' },
          select: {
            summaryId: true,
            physicianId: true,
            notifiedAt: true,
            dayKey: true,
            physician: { select: { firstName: true, lastName: true } },
          },
        })
      : [];

    const approvalsBySummary = new Map<
      string,
      Array<{ physicianId: string; name: string; notifiedAt: string }>
    >();
    const seenPair = new Set<string>();
    for (const notice of notices) {
      const key = `${notice.summaryId}:${notice.physicianId}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      const name = `Dr. ${notice.physician.firstName} ${notice.physician.lastName}`.trim();
      const list = approvalsBySummary.get(notice.summaryId) ?? [];
      list.push({
        physicianId: notice.physicianId,
        name,
        notifiedAt: notice.notifiedAt.toISOString(),
      });
      approvalsBySummary.set(notice.summaryId, list);
    }

    return summaries.map((summary) => {
      const admission = summaryAdmission(
        summary,
        admissions.filter((a) => a.patientId === summary.patientId),
      );
      const approvals = summary.id ? approvalsBySummary.get(summary.id) ?? [] : [];
      const myToday = notices.find(
        (notice) =>
          notice.summaryId === summary.id &&
          notice.physicianId === viewerId &&
          notice.dayKey === today,
      );
      return {
        ...summary,
        attendingPhysicianId: admission?.physicianId ?? null,
        admissionDischarged: Boolean(admission?.dischargeDate),
        viewerIsConsulting: Boolean(
          viewerId && isConsultingOnly(admission, viewerId),
        ),
        myConsultantNoticeAt: myToday?.notifiedAt.toISOString() ?? null,
        consultantApprovals: approvals,
      };
    });
  }

  async findForPatient(patientId: string, viewerId?: string) {
    return this.withAttending(
      await this.prisma.courseInWard.findMany({
        where: { patientId },
        orderBy: { summaryDate: 'desc' },
        include: SUMMARY_ORDERS,
      }),
      viewerId,
    );
  }

  /**
   * Every summary still waiting for this physician's approval: the unapproved
   * summaries of admissions they attend (only the attending physician can
   * approve). A discharged patient stays in this list until the last day's
   * Course in the Ward is approved, so nothing is lost when the ward list
   * moves on to active patients.
   */
  async findPendingForPhysician(physicianId: string) {
    const candidates = await this.prisma.courseInWard.findMany({
      where: {
        status: { not: SummaryStatus.APPROVED },
        patient: { admissions: { some: { physicianId } } },
      },
      orderBy: { summaryDate: 'desc' },
      select: {
        id: true,
        patientId: true,
        summaryDate: true,
        status: true,
        orders: { select: { admissionId: true }, take: 1 },
      },
    });
    const drafts = (await this.withAttending(candidates))
      .filter((summary) => summary.attendingPhysicianId === physicianId)
      .map(({ id, patientId, summaryDate, status }) => ({
        id,
        patientId,
        summaryDate,
        status: status as SummaryStatus | 'NO_SUMMARY' | 'MISSING_ORDER',
      }));
    return [...drafts, ...(await this.findUnsummarizedDays(physicianId))];
  }

  /**
   * Days of this physician's admissions (discharged ones included) that block
   * the stay's CF4 the same way Claims' `stayCoverage` counts them, one row per
   * patient-day:
   * - finished orders but no Course in the Ward dated that day → `NO_SUMMARY`,
   *   `id` synthetic -- even when those orders are linked to a summary of
   *   another day (one summary spanning several days covers only its own);
   * - only an APPROVED one, plus an order in no summary (finished after
   *   approval) → `MISSING_ORDER`, `id` = that summary, to regenerate.
   * A day with a draft is already listed as that draft.
   */
  private async findUnsummarizedDays(physicianId: string) {
    const orders = await this.prisma.physicianOrder.findMany({
      where: {
        status: OrderStatus.FINISHED,
        active: true,
        admission: { physicianId },
      },
      select: { dateCreated: true, summarizationId: true, admission: { select: { patientId: true } } },
    });
    if (!orders.length) return [];
    const patientIds = [...new Set(orders.map((order) => order.admission.patientId))];
    const summaries = await this.prisma.courseInWard.findMany({
      where: { patientId: { in: patientIds } },
      select: { id: true, patientId: true, summaryDate: true, status: true },
    });
    // Per patient-day: the approved summary's id, or null when any draft exists.
    const summarized = new Map<string, string | null>();
    for (const s of summaries) {
      const key = `${s.patientId}:${dayKeyOf(s.summaryDate)}`;
      const approved = s.status === SummaryStatus.APPROVED;
      summarized.set(key, approved && summarized.get(key) !== null ? s.id : null);
    }
    const rows = new Map<
      string,
      { id: string; patientId: string; summaryDate: Date; status: 'NO_SUMMARY' | 'MISSING_ORDER' }
    >();
    for (const order of orders) {
      const day = dayKeyOf(order.dateCreated);
      const key = `${order.admission.patientId}:${day}`;
      if (!day || rows.has(key)) continue;
      const approvedId = summarized.get(key);
      // A draft that day is listed already; an approved one covers its linked orders.
      if (approvedId === null || (approvedId && order.summarizationId)) continue;
      rows.set(key, {
        id: approvedId ?? `no-summary:${key}`,
        patientId: order.admission.patientId,
        summaryDate: dayStart(day),
        status: approvedId ? 'MISSING_ORDER' : 'NO_SUMMARY',
      });
    }
    return [...rows.values()];
  }
}
