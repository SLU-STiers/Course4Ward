import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActionType,
  OrderStatus,
  OrderType,
  PhilHealthCF4Status,
  Prisma,
  ResetStatus,
  Role,
  SummaryStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { expireStaleResetRequests } from '../auth/reset-expiry';

/** Trend granularity exposed to the reporting UI. */
export const TREND_BUCKETS = ['day', 'week', 'month'] as const;
export type TrendBucket = (typeof TREND_BUCKETS)[number];

/**
 * Guard rail: a 2-year daily range is 730 points, which is not a chart. The
 * cap is generous enough for a monthly "all time" series while still refusing
 * a request that would return thousands of buckets.
 */
const MAX_TREND_POINTS = 400;

/** Number of days covered by the default (no `from`/`to`) range. */
const DEFAULT_RANGE_DAYS = 30;

export interface ReportRangeInput {
  from?: Date;
  to?: Date;
}

export interface TrendPoint {
  /** Bucket start as a UTC calendar date (`YYYY-MM-DD`) — render as-is. */
  period: string;
  activity: number;
  orders: number;
}

/** A `{ key, count }` aggregate row. */
export interface BucketCount {
  key: string;
  count: number;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Everything the admin dashboard's reporting section needs, in one round
   * trip: current state distributions ("now") plus flow counts inside the
   * selected range ("last N days").
   *
   * Bucketing is UTC-based on purpose: `date_trunc` follows the Postgres
   * session timezone while the browser follows its own, and mixing the two
   * silently shifts day boundaries. Every period key returned here is a UTC
   * calendar date, and the frontend labels it verbatim.
   */
  async summary(range: ReportRangeInput = {}) {
    const { from, to } = this.resolveRange(range);
    await expireStaleResetRequests(this.prisma);
    const within = { gte: from, lte: to };
    const logWhere: Prisma.AuditLogWhereInput = { timeStamp: within };
    const startOfToday = startOfUtcDay(new Date());

    const [
      patients,
      admittedInRange,
      admissions,
      activeAdmissions,
      totalUsers,
      activeUsers,
      usersByRoleRows,
      ordersInRange,
      ordersToday,
      ordersByStatusRows,
      ordersByTypeRows,
      summariesInRange,
      summariesByStatusRows,
      claimsInRange,
      claimsByStatusRows,
      cf4ByStatusRows,
      resetsByStatusRows,
      activityTotal,
      activityActors,
      activityByActionRows,
      activityByRoleRows,
      topActorRows,
    ] = await Promise.all([
      this.prisma.patient.count(),
      this.prisma.patientAdmission.count({ where: { admissionDate: within } }),
      this.prisma.patientAdmission.count(),
      this.prisma.patientAdmission.count({ where: { dischargeDate: null } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.physicianOrder.count({ where: { dateCreated: within } }),
      this.prisma.physicianOrder.count({ where: { dateCreated: { gte: startOfToday } } }),
      this.prisma.physicianOrder.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.physicianOrder.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.courseInWard.count({ where: { summaryDate: within } }),
      this.prisma.courseInWard.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.summaryApprovalRequest.count({ where: { requestedAt: within } }),
      this.prisma.summaryApprovalRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.courseInWard.groupBy({ by: ['philhealthCf4Status'], _count: { _all: true } }),
      this.prisma.passwordResetRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.auditLog.count({ where: logWhere }),
      this.prisma.auditLog.findMany({
        where: logWhere,
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: logWhere,
        _count: { _all: true },
      }),
      // Role breakdown needs a join, which groupBy cannot express.
      this.prisma.$queryRaw<{ role: Role; count: number }[]>(Prisma.sql`
        SELECT u."role" AS role, COUNT(*)::int AS count
        FROM audit_logs a
        JOIN users u ON u.id = a."userId"
        WHERE a."timeStamp" >= ${from} AND a."timeStamp" <= ${to}
        GROUP BY u."role"
      `),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: logWhere,
        _count: { _all: true },
      }),
    ]);

    const activityByAction = activityByActionRows
      .map((row) => ({ key: row.action, count: row._count._all }))
      .sort((a, b) => b.count - a.count);

    const actionCount = (action: ActionType) =>
      activityByAction.find((row) => row.key === action)?.count ?? 0;

    const topActors = await this.loadTopActors(topActorRows);

    return {
      range: { from, to },
      census: {
        patients,
        admissions,
        activeAdmissions,
        dischargedAdmissions: admissions - activeAdmissions,
        admittedInRange,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: zeroFilled(
          Object.values(Role),
          usersByRoleRows.map((row) => ({ key: row.role, count: row._count._all })),
        ),
      },
      orders: {
        inRange: ordersInRange,
        today: ordersToday,
        byStatus: zeroFilled(
          Object.values(OrderStatus),
          ordersByStatusRows.map((row) => ({ key: row.status, count: row._count._all })),
        ),
        byType: zeroFilled(
          Object.values(OrderType),
          ordersByTypeRows.map((row) => ({ key: row.type, count: row._count._all })),
        ),
      },
      summaries: {
        inRange: summariesInRange,
        byStatus: zeroFilled(
          Object.values(SummaryStatus),
          summariesByStatusRows.map((row) => ({ key: row.status, count: row._count._all })),
        ),
      },
      claims: {
        inRange: claimsInRange,
        byStatus: toCountList(claimsByStatusRows.map((row) => ({ key: row.status, count: row._count._all }))),
      },
      philhealthCf4: {
        byStatus: zeroFilled(
          Object.values(PhilHealthCF4Status),
          cf4ByStatusRows.map((row) => ({ key: row.philhealthCf4Status, count: row._count._all })),
        ),
      },
      passwordResets: {
        byStatus: zeroFilled(
          Object.values(ResetStatus),
          resetsByStatusRows.map((row) => ({ key: row.status, count: row._count._all })),
        ),
      },
      activity: {
        total: activityTotal,
        distinctActors: activityActors.length,
        byAction: activityByAction,
        byRole: toCountList(
          activityByRoleRows.map((row) => ({ key: row.role, count: Number(row.count) })),
        ),
      },
      /* Clinical workflow funnel: each stage counts the actions recorded in the
         range, so the stages are directly comparable (and the drop-off between
         them is meaningful rather than a mix of state and events). */
      pipeline: [
        { key: 'orders', label: 'Orders written', count: actionCount(ActionType.CREATE_ORDER) },
        {
          key: 'summaries',
          label: 'AI summaries generated',
          count: actionCount(ActionType.REQUEST_SUMMARY),
        },
        {
          key: 'approved',
          label: 'Summaries approved',
          count: actionCount(ActionType.APPROVE_SUMMARY),
        },
        { key: 'claims', label: 'Claims filed', count: actionCount(ActionType.CLAIM_CREATED) },
        { key: 'cf4', label: 'CF4 generated', count: actionCount(ActionType.CF4_GENERATED) },
      ],
      topActors,
    };
  }

  /**
   * Activity volume over time, zero-filled so the chart shows quiet days as
   * gaps in the data rather than collapsing the axis.
   */
  async activityTrend(query: ReportRangeInput & { bucket?: TrendBucket } = {}) {
    const bucket = query.bucket ?? 'day';
    if (!TREND_BUCKETS.includes(bucket)) {
      throw new BadRequestException(`bucket must be one of: ${TREND_BUCKETS.join(', ')}`);
    }

    const { from, to } = this.resolveRange(query);
    const periods = bucketStarts(from, to, bucket);
    if (periods.length > MAX_TREND_POINTS) {
      throw new BadRequestException(
        `Range covers ${periods.length} ${bucket} buckets (max ${MAX_TREND_POINTS}); use a coarser bucket or a shorter range`,
      );
    }

    const [activityRows, orderRows] = await Promise.all([
      this.prisma.$queryRaw<{ period: string; count: number }[]>(Prisma.sql`
        SELECT to_char(date_trunc(${bucket}, "timeStamp" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS period,
               COUNT(*)::int AS count
        FROM audit_logs
        WHERE "timeStamp" >= ${from} AND "timeStamp" <= ${to}
        GROUP BY period
        ORDER BY period ASC
      `),
      this.prisma.$queryRaw<{ period: string; count: number }[]>(Prisma.sql`
        SELECT to_char(date_trunc(${bucket}, "dateCreated" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS period,
               COUNT(*)::int AS count
        FROM physician_orders
        WHERE "dateCreated" >= ${from} AND "dateCreated" <= ${to}
        GROUP BY period
        ORDER BY period ASC
      `),
    ]);

    const activityByPeriod = new Map(activityRows.map((row) => [row.period, Number(row.count)]));
    const ordersByPeriod = new Map(orderRows.map((row) => [row.period, Number(row.count)]));

    const points: TrendPoint[] = periods.map((period) => ({
      period,
      activity: activityByPeriod.get(period) ?? 0,
      orders: ordersByPeriod.get(period) ?? 0,
    }));

    return { range: { from, to }, bucket, points };
  }

  /**
   * AI performance for the admin "AI" tab: summarization and embedding call
   * timings (from `ai_call_metrics`, in range), RAG usage, plus the current
   * state of the embedding corpus. Percentiles and averages cover successful
   * calls only, so a timed-out call does not pose as a slow summary.
   */
  async aiStats(range: ReportRangeInput = {}) {
    const { from, to } = this.resolveRange(range);
    const bucket = aiTrendBucket(from, to);
    const periods = bucketStarts(from, to, bucket);

    const [groupRows, trendRows, failureRows, corpusRows] = await Promise.all([
      this.prisma.$queryRaw<AiGroupRow[]>(Prisma.sql`
        SELECT kind::text AS kind,
               CASE WHEN GROUPING(model) = 1 THEN NULL ELSE model END AS model,
               CASE WHEN GROUPING("trigger") = 1 THEN NULL ELSE "trigger" END AS "trigger",
               COUNT(*)::int AS calls,
               (COUNT(*) FILTER (WHERE NOT success))::int AS failures,
               COALESCE(SUM("itemCount") FILTER (WHERE success), 0)::int AS items,
               (AVG("durationMs") FILTER (WHERE success))::float AS "avgMs",
               (percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs") FILTER (WHERE success))::float AS "p50Ms",
               (percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") FILTER (WHERE success))::float AS "p95Ms",
               (MAX("durationMs") FILTER (WHERE success))::int AS "maxMs",
               (AVG("outputChars") FILTER (WHERE success))::float AS "avgOutputChars",
               (AVG("referenceCount") FILTER (WHERE success))::float AS "avgReferences",
               (AVG("topSimilarity") FILTER (WHERE success))::float AS "avgTopSimilarity"
        FROM ai_call_metrics
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY GROUPING SETS ((kind), (kind, model), (kind, "trigger"))
      `),
      this.prisma.$queryRaw<{ period: string; kind: string; calls: number; avgMs: number | null }[]>(
        Prisma.sql`
          SELECT to_char(date_trunc(${bucket}, "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS period,
                 kind::text AS kind,
                 COUNT(*)::int AS calls,
                 (AVG("durationMs") FILTER (WHERE success))::float AS "avgMs"
          FROM ai_call_metrics
          WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          GROUP BY period, kind
        `,
      ),
      this.prisma.aiCallMetric.findMany({
        where: { success: false, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { createdAt: true, kind: true, model: true, trigger: true, error: true },
      }),
      this.prisma.$queryRaw<AiCorpusRow[]>(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM physician_orders WHERE active = true)::int AS "ordersTotal",
          (SELECT COUNT(*) FROM physician_orders
             WHERE active = true AND "orderEmbedding" IS NOT NULL)::int AS "ordersEmbedded",
          (SELECT COUNT(*) FROM physician_orders o
             JOIN courses_in_ward c ON c.id = o."summarizationId"
             WHERE o.active = true AND o."orderEmbedding" IS NOT NULL
               AND c.status = 'APPROVED')::int AS "ragOrders",
          (SELECT COUNT(*) FROM courses_in_ward WHERE status = 'APPROVED')::int AS "approvedSummaries",
          (SELECT vector_dims("orderEmbedding") FROM physician_orders
             WHERE "orderEmbedding" IS NOT NULL LIMIT 1)::int AS dimension
      `),
    ]);

    const stats = (row?: AiGroupRow) => ({
      calls: row?.calls ?? 0,
      failures: row?.failures ?? 0,
      items: row?.items ?? 0,
      avgMs: roundOrNull(row?.avgMs),
      p50Ms: roundOrNull(row?.p50Ms),
      p95Ms: roundOrNull(row?.p95Ms),
      maxMs: row?.maxMs ?? null,
      avgOutputChars: roundOrNull(row?.avgOutputChars),
      avgReferences: row?.avgReferences == null ? null : Number(row.avgReferences.toFixed(2)),
      avgTopSimilarity:
        row?.avgTopSimilarity == null ? null : Number(row.avgTopSimilarity.toFixed(3)),
    });
    const section = (kind: 'SUMMARY' | 'EMBEDDING') => {
      const rows = groupRows.filter((row) => row.kind === kind);
      return {
        ...stats(rows.find((row) => row.model === null && row.trigger === null)),
        byModel: rows
          .filter((row) => row.model !== null)
          .map((row) => ({ key: row.model as string, ...stats(row) }))
          .sort((a, b) => b.calls - a.calls),
        byTrigger: rows
          .filter((row) => row.trigger !== null)
          .map((row) => ({ key: row.trigger as string, ...stats(row) }))
          .sort((a, b) => b.calls - a.calls),
      };
    };

    const trendKey = (period: string, kind: string) => `${period}|${kind}`;
    const trendByKey = new Map(trendRows.map((row) => [trendKey(row.period, row.kind), row]));
    const corpus = corpusRows[0];

    return {
      range: { from, to },
      bucket,
      summarization: section('SUMMARY'),
      embedding: section('EMBEDDING'),
      corpus: {
        ordersTotal: corpus?.ordersTotal ?? 0,
        ordersEmbedded: corpus?.ordersEmbedded ?? 0,
        ragOrders: corpus?.ragOrders ?? 0,
        approvedSummaries: corpus?.approvedSummaries ?? 0,
        dimension: corpus?.dimension ?? null,
      },
      trend: periods.map((period) => {
        const summary = trendByKey.get(trendKey(period, 'SUMMARY'));
        const embedding = trendByKey.get(trendKey(period, 'EMBEDDING'));
        return {
          period,
          summaries: summary?.calls ?? 0,
          avgSummaryMs: roundOrNull(summary?.avgMs),
          embeddings: embedding?.calls ?? 0,
          avgEmbeddingMs: roundOrNull(embedding?.avgMs),
        };
      }),
      recentFailures: failureRows,
    };
  }

  /** Most active accounts in the range, with names resolved for display. */
  private async loadTopActors(rows: Array<{ userId: string; _count: { _all: number } }>, take = 5) {
    const top = [...rows].sort((a, b) => b._count._all - a._count._all).slice(0, take);
    if (!top.length) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: top.map((row) => row.userId) } },
      select: { id: true, userId: true, firstName: true, lastName: true, role: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return top.map((row) => {
      const user = byId.get(row.userId);
      return {
        userId: user?.userId ?? 'unknown',
        name: user ? `${user.firstName} ${user.lastName}` : 'Unknown user',
        role: user?.role ?? null,
        count: row._count._all,
      };
    });
  }

  /**
   * Normalises the requested window. A date-only bound (`2026-09-16`) means the
   * whole UTC day, so the UI can send plain date-picker values; a full ISO
   * instant is used as-is.
   */
  private resolveRange(range: ReportRangeInput): { from: Date; to: Date } {
    const to = range.to ? endOfBound(range.to) : new Date();
    const defaultFrom = startOfUtcDay(
      new Date(to.getTime() - (DEFAULT_RANGE_DAYS - 1) * MS_PER_DAY),
    );
    const from = range.from ? startOfBound(range.from) : defaultFrom;

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('`from` must not be later than `to`');
    }
    return { from, to };
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC of the day containing `date`. */
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

/** `YYYY-MM-DD` in UTC — the same key format the SQL `to_char` produces. */
function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfBound(value: Date): Date {
  const isDateOnly = value.getTime() === Date.parse(toUtcDateKey(value));
  return isDateOnly ? new Date(`${toUtcDateKey(value)}T00:00:00.000Z`) : value;
}

function endOfBound(value: Date): Date {
  const isDateOnly = value.getTime() === Date.parse(toUtcDateKey(value));
  return isDateOnly ? new Date(`${toUtcDateKey(value)}T23:59:59.999Z`) : value;
}

/**
 * Bucket start dates between `from` and `to`, UTC, Monday-aligned for weeks —
 * i.e. exactly what Postgres `date_trunc` returns for the same range, so the
 * zero-fill keys line up with the query rows.
 */
function bucketStarts(from: Date, to: Date, bucket: TrendBucket): string[] {
  const periods: string[] = [];
  let cursor = startOfUtcDay(from);

  if (bucket === 'week') {
    // date_trunc('week') starts on Monday; getUTCDay() is 0 for Sunday.
    const mondayOffset = (cursor.getUTCDay() + 6) % 7;
    cursor = new Date(cursor.getTime() - mondayOffset * MS_PER_DAY);
  } else if (bucket === 'month') {
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  }

  while (cursor.getTime() <= to.getTime()) {
    periods.push(toUtcDateKey(cursor));
    if (bucket === 'day') {
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
    } else if (bucket === 'week') {
      cursor = new Date(cursor.getTime() + 7 * MS_PER_DAY);
    } else {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
  }

  return periods;
}

/** One GROUPING SETS row of `aiStats`: `model`/`trigger` null on the kind's total. */
interface AiGroupRow {
  kind: string;
  model: string | null;
  trigger: string | null;
  calls: number;
  failures: number;
  items: number;
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  avgOutputChars: number | null;
  avgReferences: number | null;
  avgTopSimilarity: number | null;
}

interface AiCorpusRow {
  ordersTotal: number;
  ordersEmbedded: number;
  ragOrders: number;
  approvedSummaries: number;
  dimension: number | null;
}

function roundOrNull(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value);
}

/** Finest trend bucket that keeps the AI chart under `MAX_TREND_POINTS`. */
export function aiTrendBucket(from: Date, to: Date): TrendBucket {
  const days = Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
  if (days <= 90) return 'day';
  if (days / 7 <= MAX_TREND_POINTS) return 'week';
  return 'month';
}

/** `{ key, count }` rows -> a record that always contains every enum member. */
function zeroFilled<K extends string>(
  keys: K[],
  rows: BucketCount[],
): Record<K, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const row of rows) {
    if (row.key in result) result[row.key as K] = row.count;
  }
  return result;
}

/** `{ key, count }` rows -> a descending list, for free-form string statuses. */
function toCountList(rows: BucketCount[]): BucketCount[] {
  return [...rows].sort((a, b) => b.count - a.count);
}
