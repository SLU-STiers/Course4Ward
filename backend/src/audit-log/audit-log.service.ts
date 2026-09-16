import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ActionType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Every action name a domain service passes to `record()`.
 *
 * This is a closed union on purpose. `ACTION_MAP` is a complete
 * `Record<AuditAction, ActionType>`, so a new call site that forgets to teach
 * the map about its action fails to compile instead of being logged under a
 * neighbouring action. The admin Activity Logs screen is the only place these
 * values surface, and a row that reads "Edited account" when the user actually
 * generated a CF4 makes the whole log untrustworthy.
 */
export type AuditAction =
  | 'LOGIN'
  | 'PASSWORD_RESET'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'PATIENT_CREATED'
  | 'PATIENT_UPDATED'
  | 'REGISTER_PATIENT'
  | 'ORDER_CREATED'
  | 'SUMMARY_GENERATED_AI'
  | 'SUMMARY_EDITED_MANUAL'
  | 'SUMMARY_REGENERATED_AI'
  | 'SUMMARY_APPROVED'
  | 'CLAIM_CREATED'
  | 'CLAIM_PHYSICIAN_NOTIFIED'
  | 'CF4_GENERATED';

/**
 * Action name -> persisted `ActionType`. One-to-one wherever the enum can
 * express the action; only the account/patient lifecycle still collapses
 * several granular names onto a shared CRUD verb.
 */
export const ACTION_MAP: Record<AuditAction, ActionType> = {
  LOGIN: ActionType.LOGIN,
  PASSWORD_RESET: ActionType.PASSWORD_RESET,
  USER_CREATED: ActionType.ADD_ACCOUNT,
  USER_UPDATED: ActionType.EDIT_ACCOUNT,
  USER_DEACTIVATED: ActionType.DELETE_ACCOUNT,
  PATIENT_CREATED: ActionType.REGISTER_PATIENT,
  PATIENT_UPDATED: ActionType.PATIENT_UPDATED,
  REGISTER_PATIENT: ActionType.REGISTER_PATIENT,
  ORDER_CREATED: ActionType.CREATE_ORDER,
  SUMMARY_GENERATED_AI: ActionType.REQUEST_SUMMARY,
  SUMMARY_EDITED_MANUAL: ActionType.EDIT_SUMMARY,
  SUMMARY_REGENERATED_AI: ActionType.REGENERATE_SUMMARY,
  SUMMARY_APPROVED: ActionType.APPROVE_SUMMARY,
  CLAIM_CREATED: ActionType.CLAIM_CREATED,
  CLAIM_PHYSICIAN_NOTIFIED: ActionType.CLAIM_PHYSICIAN_NOTIFIED,
  CF4_GENERATED: ActionType.CF4_GENERATED,
};

export const AUDIT_LOG_BUCKETS = ['day', 'week', 'month', 'year'] as const;
export type AuditLogBucket = (typeof AUDIT_LOG_BUCKETS)[number];

const USER_SELECT = {
  userId: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

const AUDIT_LOG_INCLUDE = { user: { select: USER_SELECT } };

/** A log row as the Activity Logs table consumes it. */
export interface AuditLogEntry {
  id: string;
  timeStamp: Date;
  action: ActionType;
  userId: string;
  user: { userId: string; firstName: string; lastName: string; role: Role };
}

/** One page of activity logs plus the total matching the same filters. */
export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  skip: number;
  take: number;
}

/** Dimensions the Activity Logs graph can aggregate by. */
export const AGGREGATE_DIMENSIONS = ['day', 'action', 'actor'] as const;
export type AggregateDimension = (typeof AGGREGATE_DIMENSIONS)[number];

/** Number of `day` buckets returned at most (≈13 months of active days). */
const MAX_DAY_BUCKETS = 400;

/** Number of ranked actors returned at most. */
const MAX_ACTOR_BUCKETS = 12;

export interface AuditLogAggregateBucket {
  /** Stable key: a UTC date for `day`, the action name, or the actor's login id. */
  key: string;
  /** Display-ready label; the UI prefers its own wording for actions. */
  label: string;
  count: number;
}

export interface AuditLogAggregate {
  by: AggregateDimension;
  /** Total matching the filters — the denominator for every bucket. */
  total: number;
  buckets: AuditLogAggregateBucket[];
  /** True when buckets were capped, so the chart can say so instead of lying. */
  truncated: boolean;
}

/** Filters accepted by the Activity Logs table. */
export interface AuditLogQuery {
  skip?: number;
  take?: number;
  action?: ActionType;
  role?: Role;
  /** The actor's login id (`DOC001`), not the row's uuid. */
  userId?: string;
  from?: Date;
  to?: Date;
  /** Free text matched against the actor name/id and against the action name. */
  search?: string;
}

interface RecordAuditInput {
  userId: string;
  action: AuditAction | string;
}

const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: PrismaService) {}

  async record(input: RecordAuditInput) {
    const action = ACTION_MAP[input.action as AuditAction];
    if (!action) {
      // Only reachable from untyped callers; the union makes it a compile error
      // for in-repo call sites. Warn loudly rather than silently mislabelling.
      this.logger.warn(
        `Unknown audit action "${input.action}" — falling back to ${ActionType.EDIT_ACCOUNT}`,
      );
    }
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: action ?? ActionType.EDIT_ACCOUNT,
      },
    });
  }

  /**
   * Admin > Activity Logs. Server-side filtering/paging so the table can show
   * every log in the database, not just the newest page, and so the "showing
   * X of Y" count is the real total.
   */
  async findAll(query: AuditLogQuery = {}): Promise<AuditLogPage> {
    const take = query.take ?? DEFAULT_PAGE_SIZE;
    const skip = query.skip ?? 0;
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timeStamp: 'desc' },
        skip,
        take,
        include: AUDIT_LOG_INCLUDE,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  private buildWhere(query: AuditLogQuery): Prisma.AuditLogWhereInput {
    const conditions: Prisma.AuditLogWhereInput[] = [];

    if (query.action) conditions.push({ action: query.action });
    if (query.role) conditions.push({ user: { role: query.role } });
    if (query.userId) conditions.push({ user: { userId: query.userId } });
    if (query.from || query.to) {
      conditions.push({
        timeStamp: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      });
    }

    const term = query.search?.trim();
    if (term) {
      // Searching "approve summary" or "DOC001" both work: the term is matched
      // against the action name as well as the actor.
      const matchingActions = this.matchingActionsFor(term.replace(/\s+/g, '_').toUpperCase());

      const matches: Prisma.AuditLogWhereInput[] = [
        {
          user: {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
              { userId: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
      ];
      if (matchingActions.length) {
        matches.unshift({ action: { in: matchingActions } });
      }
      conditions.push({ OR: matches });
    }

    return conditions.length ? { AND: conditions } : {};
  }

  /**
   * The Activity Logs graph.
   *
   * Aggregates the *whole* filtered set rather than the visible page, so the
   * chart can never disagree with the table's total, and it accepts exactly the
   * filters `findAll` accepts (paging is ignored — a partial page is not a
   * dataset worth charting).
   */
  async aggregate(
    query: AuditLogQuery = {},
    by: AggregateDimension = 'day',
  ): Promise<AuditLogAggregate> {
    if (!AGGREGATE_DIMENSIONS.includes(by)) {
      throw new BadRequestException(`by must be one of: ${AGGREGATE_DIMENSIONS.join(', ')}`);
    }

    const where = this.buildWhere(query);
    const total = await this.prisma.auditLog.count({ where });

    if (by === 'action') {
      const rows = await this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { _all: true },
      });
      const buckets = rows
        .map((row) => ({ key: row.action, label: row.action, count: row._count._all }))
        .sort((a, b) => b.count - a.count);
      return { by, total, buckets, truncated: false };
    }

    if (by === 'actor') {
      const rows = await this.prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: { _all: true },
      });
      const ranked = [...rows]
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, MAX_ACTOR_BUCKETS);
      const users = ranked.length
        ? await this.prisma.user.findMany({
            where: { id: { in: ranked.map((row) => row.userId) } },
            select: { id: true, userId: true, firstName: true, lastName: true },
          })
        : [];
      const byId = new Map(users.map((user) => [user.id, user]));

      const buckets = ranked.map((row) => {
        const user = byId.get(row.userId);
        return {
          key: user?.userId ?? row.userId,
          label: user ? `${user.firstName} ${user.lastName} (${user.userId})` : 'Unknown user',
          count: row._count._all,
        };
      });
      return { by, total, buckets, truncated: this.sumCounts(buckets) < total };
    }

    // `day` needs date_trunc, which Prisma's groupBy cannot express.
    const rows = await this.prisma.$queryRaw<{ key: string; count: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('day', a."timeStamp" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS key,
             COUNT(*)::int AS count
      FROM audit_logs a
      JOIN users u ON u.id = a."userId"
      WHERE ${this.buildSqlWhere(query)}
      GROUP BY key
      ORDER BY key DESC
      LIMIT ${MAX_DAY_BUCKETS}
    `);
    const buckets = rows.map((row) => ({
      key: row.key,
      label: row.key,
      count: Number(row.count),
    }));

    return {
      by,
      total,
      // Newest-first from SQL, reversed so the chart reads left-to-right in time.
      buckets: buckets.reverse(),
      truncated: this.sumCounts(buckets) < total,
    };
  }

  private sumCounts(buckets: AuditLogAggregateBucket[]): number {
    return buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  }

  /**
   * The action names a free-text term refers to, matching either the call-site
   * name (`SUMMARY_APPROVED`) or the persisted enum value (`APPROVE_SUMMARY`).
   * Shared by the Prisma and raw-SQL filter builders so both select the same
   * rows.
   */
  private matchingActionsFor(needle: string): ActionType[] {
    return Array.from(
      new Set<ActionType>([
        ...(Object.keys(ACTION_MAP) as AuditAction[])
          .filter((name) => name.includes(needle))
          .map((name) => ACTION_MAP[name]),
        ...Object.values(ACTION_MAP).filter((name) => name.includes(needle)),
      ]),
    );
  }

  /**
   * {@link buildWhere} expressed for raw SQL, needed by the `day` aggregation.
   *
   * The two builders must stay in sync: the action-name matching is shared via
   * {@link matchingActionsFor}, and `logs.test.ts` pins the clause set this one
   * produces so a filter added to only one of them fails a test.
   */
  private buildSqlWhere(query: AuditLogQuery): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.action) conditions.push(Prisma.sql`a."action" = ${query.action}::"ActionType"`);
    if (query.role) conditions.push(Prisma.sql`u."role" = ${query.role}::"role"`);
    if (query.userId) conditions.push(Prisma.sql`u."userId" = ${query.userId}`);
    if (query.from) conditions.push(Prisma.sql`a."timeStamp" >= ${query.from}`);
    if (query.to) conditions.push(Prisma.sql`a."timeStamp" <= ${query.to}`);

    const term = query.search?.trim();
    if (term) {
      const like = `%${term}%`;
      const matches: Prisma.Sql[] = [
        Prisma.sql`u."firstName" ILIKE ${like} OR u."lastName" ILIKE ${like} OR u."userId" ILIKE ${like}`,
      ];
      const matchingActions = this.matchingActionsFor(term.replace(/\s+/g, '_').toUpperCase());
      if (matchingActions.length) {
        matches.unshift(Prisma.sql`a."action"::text IN (${Prisma.join(matchingActions)})`);
      }
      conditions.push(Prisma.sql`(${Prisma.join(matches, ' OR ')})`);
    }

    return conditions.length ? Prisma.sql`${Prisma.join(conditions, ' AND ')}` : Prisma.sql`TRUE`;
  }

  /**
   * Orders per day/week/month/year for admin analytics.
   *
   * The bucket is bound as a query parameter (never interpolated) and checked
   * against the allowed set first: `date_trunc` takes the unit as text, so an
   * unvalidated value here would be a SQL injection point.
   */
  async ordersOverTime(bucket: AuditLogBucket = 'day') {
    if (!AUDIT_LOG_BUCKETS.includes(bucket)) {
      throw new BadRequestException(
        `bucket must be one of: ${AUDIT_LOG_BUCKETS.join(', ')}`,
      );
    }

    return this.prisma.$queryRaw<{ period: Date; count: number }[]>(Prisma.sql`
      SELECT date_trunc(${bucket}, "dateCreated") AS period, COUNT(*)::int AS count
      FROM physician_orders
      GROUP BY period
      ORDER BY period DESC
      LIMIT 100
    `);
  }

  async summary() {
    const [totalUsers, activeUsers, pendingResets, pendingSummaries, approvedSummaries] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.passwordResetRequest.count({ where: { status: 'PENDING' } }),
        this.prisma.courseInWard.count({ where: { status: 'DRAFT_AI' } }),
        this.prisma.courseInWard.count({ where: { status: 'APPROVED' } }),
      ]);

    return { totalUsers, activeUsers, pendingResets, pendingSummaries, approvedSummaries };
  }
}
