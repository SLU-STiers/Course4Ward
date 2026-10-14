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
  | 'ORDER_STATUS_UPDATED'
  | 'SUMMARY_GENERATED_AI'
  | 'SUMMARY_EDITED_MANUAL'
  | 'SUMMARY_REGENERATED_AI'
  | 'SUMMARY_APPROVED'
  | 'SUMMARY_VERSION_RESTORED'
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
  ORDER_STATUS_UPDATED: ActionType.UPDATE_ORDER_STATUS,
  SUMMARY_GENERATED_AI: ActionType.REQUEST_SUMMARY,
  SUMMARY_EDITED_MANUAL: ActionType.EDIT_SUMMARY,
  SUMMARY_REGENERATED_AI: ActionType.REGENERATE_SUMMARY,
  SUMMARY_APPROVED: ActionType.APPROVE_SUMMARY,
  SUMMARY_VERSION_RESTORED: ActionType.EDIT_SUMMARY,
  CLAIM_CREATED: ActionType.CLAIM_CREATED,
  CLAIM_PHYSICIAN_NOTIFIED: ActionType.CLAIM_PHYSICIAN_NOTIFIED,
  CF4_GENERATED: ActionType.CF4_GENERATED,
};

/**
 * The wording the admin Activity Logs table shows for each action and role.
 * Mirrors `frontend/src/features/admin/activityLabels.ts` so free-text search
 * matches what the admin actually reads ("Account updated", "Signed in",
 * "Claims processor"), not only the stored enum names.
 */
export const ACTION_LABELS: Record<ActionType, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  ADD_NOTE: 'Note added',
  CREATE_ORDER_NURSE: 'Order entered (nurse)',
  CREATE_ORDER: 'Order created',
  UPDATE_ORDER_STATUS: 'Order status updated',
  REQUEST_SUMMARY: 'Summary generated (AI)',
  EDIT_SUMMARY: 'Summary edited',
  REGENERATE_SUMMARY: 'Summary regenerated',
  APPROVE_SUMMARY: 'Summary approved',
  CLAIM_CREATED: 'Claim created',
  CLAIM_PHYSICIAN_NOTIFIED: 'Physician notified',
  CF4_GENERATED: 'PhilHealth CF4 generated',
  ADD_ACCOUNT: 'Account created',
  EDIT_ACCOUNT: 'Account updated',
  DELETE_ACCOUNT: 'Account deactivated',
  PASSWORD_RESET: 'Password reset',
  REGISTER_PATIENT: 'Patient registered',
  PATIENT_UPDATED: 'Patient record updated',
};

export const ROLE_LABELS: Record<Role, string> = {
  PHYSICIAN: 'Physician',
  NURSE: 'Nurse',
  CLAIMS_PROCESSOR: 'Claims processor',
  ADMIN: 'Admin',
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
  /**
   * Free text matched against every column the table shows: log id, actor
   * name (first, last or full) and login id, role, and action.
   */
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
      // Like the other tables: the term matches if any visible column contains
      // it. "Ana Reyes", "a1b2c3d4", "Claims processor" and "Account updated"
      // each find their rows.
      const contains = { contains: term, mode: 'insensitive' as const };
      const { actions, roles, words } = this.searchTargets(term);

      const matches: Prisma.AuditLogWhereInput[] = [
        { id: contains },
        { user: { userId: contains } },
        // Full name: every word has to hit the first or last name.
        {
          user: {
            AND: words.map((word) => ({
              OR: [
                { firstName: { contains: word, mode: 'insensitive' as const } },
                { lastName: { contains: word, mode: 'insensitive' as const } },
              ],
            })),
          },
        },
      ];
      if (roles.length) matches.push({ user: { role: { in: roles } } });
      if (actions.length) matches.push({ action: { in: actions } });
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
   * What a free-text term refers to beyond plain text columns: the actions
   * whose label (`Account updated`) or enum value (`APPROVE_SUMMARY`)
   * contains it, the roles whose label or enum
   * value contains it, and the words used for full-name matching. Shared by
   * the Prisma and raw-SQL filter builders so both select the same rows.
   */
  private searchTargets(term: string): { actions: ActionType[]; roles: Role[]; words: string[] } {
    const lower = term.toLowerCase();
    const enumNeedle = term.replace(/\s+/g, '_').toUpperCase();

    // Call-site names (`PATIENT_CREATED`) are deliberately not matched: the
    // admin never sees them, so "created" must not surface "Patient registered".
    const actions = (Object.keys(ACTION_LABELS) as ActionType[]).filter(
      (action) => action.includes(enumNeedle) || ACTION_LABELS[action].toLowerCase().includes(lower),
    );

    const roles = (Object.keys(ROLE_LABELS) as Role[]).filter(
      (role) => role.includes(enumNeedle) || ROLE_LABELS[role].toLowerCase().includes(lower),
    );

    return { actions, roles, words: term.split(/\s+/).filter(Boolean) };
  }

  /**
   * {@link buildWhere} expressed for raw SQL, needed by the `day` aggregation.
   *
   * The two builders must stay in sync: the action-name matching is shared via
   * {@link searchTargets}, and `logs.test.ts` pins the clause set this one
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
      const { actions, roles, words } = this.searchTargets(term);
      const nameMatch = Prisma.join(
        words.map((word) => {
          const wordLike = `%${word}%`;
          return Prisma.sql`(u."firstName" ILIKE ${wordLike} OR u."lastName" ILIKE ${wordLike})`;
        }),
        ' AND ',
      );
      const matches: Prisma.Sql[] = [
        Prisma.sql`a."id" ILIKE ${like}`,
        Prisma.sql`u."userId" ILIKE ${like}`,
        Prisma.sql`(${nameMatch})`,
      ];
      if (roles.length) {
        matches.push(Prisma.sql`u."role"::text IN (${Prisma.join(roles)})`);
      }
      if (actions.length) {
        matches.push(Prisma.sql`a."action"::text IN (${Prisma.join(actions)})`);
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
