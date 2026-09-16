// unit-tests/audit-log.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import {
  ACTION_MAP,
  AuditLogService,
  type AggregateDimension,
  type AuditLogBucket,
} from '../audit-log/audit-log.service';import { PrismaService } from '../prisma/prisma.service';
import { ActionType, Role } from '@prisma/client';

// Mock the PrismaService
const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  passwordResetRequest: {
    count: jest.fn(),
  },
  courseInWard: {
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
  // `findAll` reads the page and its matching total in one transaction.
  $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
};

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('record', () => {
    const mockUserId = 'user-123';
    const mockAction = 'LOGIN';

    const mockAuditLog = {
      id: 'audit-1',
      userId: mockUserId,
      action: ActionType.LOGIN,
      timeStamp: new Date(),
    };

    it('should record an audit log with valid action', async () => {
      // Arrange
      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      // Act
      const result = await service.record({
        userId: mockUserId,
        action: mockAction,
      });

      // Assert
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: ActionType.LOGIN,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should keep PASSWORD_RESET distinct from EDIT_ACCOUNT', async () => {
      // Arrange
      const mockAuditLogReset = {
        id: 'audit-2',
        userId: mockUserId,
        action: ActionType.PASSWORD_RESET,
        timeStamp: new Date(),
      };
      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLogReset);

      // Act
      const result = await service.record({
        userId: mockUserId,
        action: 'PASSWORD_RESET',
      });

      // Assert
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: ActionType.PASSWORD_RESET,
        },
      });
      expect(result).toEqual(mockAuditLogReset);
    });

    it('should record an audit log with USER_CREATED action mapping to ADD_ACCOUNT', async () => {
      // Arrange
      const mockAuditLogCreated = {
        id: 'audit-3',
        userId: mockUserId,
        action: ActionType.ADD_ACCOUNT,
        timeStamp: new Date(),
      };
      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLogCreated);

      // Act
      const result = await service.record({
        userId: mockUserId,
        action: 'USER_CREATED',
      });

      // Assert
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: ActionType.ADD_ACCOUNT,
        },
      });
      expect(result).toEqual(mockAuditLogCreated);
    });

    it('should warn and fall back to EDIT_ACCOUNT for an unknown action', async () => {
      // Arrange
      const unknownAction = 'UNKNOWN_ACTION';
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const mockAuditLogDefault = {
        id: 'audit-4',
        userId: mockUserId,
        action: ActionType.EDIT_ACCOUNT,
        timeStamp: new Date(),
      };
      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLogDefault);

      // Act
      const result = await service.record({
        userId: mockUserId,
        action: unknownAction,
      });

      // Assert
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: ActionType.EDIT_ACCOUNT,
        },
      });
      expect(result).toEqual(mockAuditLogDefault);
      // A silent fallback is what made the old log table misleading.
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(unknownAction));
      warn.mockRestore();
    });

    it('should map every recorded action to its declared ActionType', async () => {
      // Arrange — iterating the map itself keeps this honest when an action is
      // added: the closed `AuditAction` union makes ACTION_MAP exhaustive.
      const actionMappings = Object.entries(ACTION_MAP) as Array<[string, ActionType]>;

      for (const [input, expected] of actionMappings) {
        mockPrismaService.auditLog.create.mockResolvedValue({
          id: 'audit-5',
          userId: mockUserId,
          action: expected,
          timeStamp: new Date(),
        });

        await service.record({
          userId: mockUserId,
          action: input,
        });

        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: {
            userId: mockUserId,
            action: expected,
          },
        });
      }
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(actionMappings.length);
    });

    it('should not collapse the previously merged workflows (regression)', async () => {
      // Arrange — these five all used to be stored as some other action.
      const previouslyCollapsed: Array<[string, ActionType]> = [
        ['PASSWORD_RESET', ActionType.PASSWORD_RESET],
        ['PATIENT_UPDATED', ActionType.PATIENT_UPDATED],
        ['CLAIM_CREATED', ActionType.CLAIM_CREATED],
        ['CLAIM_PHYSICIAN_NOTIFIED', ActionType.CLAIM_PHYSICIAN_NOTIFIED],
        ['CF4_GENERATED', ActionType.CF4_GENERATED],
      ];

      // Act & Assert
      const stored = new Set<ActionType>();
      for (const [input, expected] of previouslyCollapsed) {
        mockPrismaService.auditLog.create.mockResolvedValue({
          id: `audit-${input}`,
          userId: mockUserId,
          action: expected,
          timeStamp: new Date(),
        });

        await service.record({ userId: mockUserId, action: input });

        expect(mockPrismaService.auditLog.create).toHaveBeenLastCalledWith({
          data: { userId: mockUserId, action: expected },
        });
        stored.add(expected);
      }
      expect(stored.size).toBe(previouslyCollapsed.length);
    });

    it('should handle errors from Prisma when recording audit log', async () => {
      // Arrange
      const error = new Error('Database error');
      mockPrismaService.auditLog.create.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.record({
          userId: mockUserId,
          action: mockAction,
        })
      ).rejects.toThrow('Database error');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    const mockAuditLogs = [
      {
        id: 'audit-1',
        userId: 'user-1',
        action: ActionType.LOGIN,
        timeStamp: new Date('2026-12-20T10:00:00Z'),
        user: {
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          role: 'PHYSICIAN',
        },
      },
      {
        id: 'audit-2',
        userId: 'user-2',
        action: ActionType.EDIT_ACCOUNT,
        timeStamp: new Date('2026-12-19T10:00:00Z'),
        user: {
          userId: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'ADMIN',
        },
      },
    ];

    it('should return audit logs with default take limit of 50', async () => {
      // Arrange
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(mockAuditLogs.length);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timeStamp: 'desc' },
        skip: 0,
        take: 50,
        include: {
          user: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });
      // The table needs the real total, not just the size of the current page.
      expect(mockPrismaService.auditLog.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ items: mockAuditLogs, total: 2, skip: 0, take: 50 });
    });

    it('should translate the filters into a Prisma where clause', async () => {
      // Arrange
      const from = new Date('2026-09-01T00:00:00.000Z');
      const to = new Date('2026-09-16T23:59:59.999Z');
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      // Act
      await service.findAll({
        action: ActionType.CF4_GENERATED,
        role: Role.CLAIMS_PROCESSOR,
        userId: 'CLM001',
        from,
        to,
      });

      // Assert
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { action: ActionType.CF4_GENERATED },
              { user: { role: Role.CLAIMS_PROCESSOR } },
              { user: { userId: 'CLM001' } },
              { timeStamp: { gte: from, lte: to } },
            ],
          },
        }),
      );
      expect(mockPrismaService.auditLog.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      });
    });

    it('should match free text against both the actor and the action name', async () => {
      // Arrange
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      // Act
      await service.findAll({ search: 'approve summary' });

      // Assert
      const [call] = mockPrismaService.auditLog.findMany.mock.calls;
      const where = call[0].where as { AND: Array<Record<string, unknown>> };
      expect(where.AND[0]).toEqual({ OR: expect.any(Array) });
      const [actionClause, userClause] = where.AND[0].OR as Array<Record<string, unknown>>;
      expect(actionClause).toEqual({ action: { in: [ActionType.APPROVE_SUMMARY] } });
      expect(userClause).toEqual({
        user: {
          OR: [
            { firstName: { contains: 'approve summary', mode: 'insensitive' } },
            { lastName: { contains: 'approve summary', mode: 'insensitive' } },
            { userId: { contains: 'approve summary', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('should return audit logs with custom skip and take values', async () => {
      // Arrange
      const params = { skip: 10, take: 20 };
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(42);

      // Act
      const result = await service.findAll(params);

      // Assert
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timeStamp: 'desc' },
        skip: 10,
        take: 20,
        include: {
          user: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });
      expect(result.total).toBe(42);
      expect(result.items).toEqual(mockAuditLogs);
    });

    it('should include user information in the response', async () => {
      // Arrange
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(mockAuditLogs.length);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result.items[0]).toHaveProperty('user');
      expect(result.items[0].user).toHaveProperty('firstName');
      expect(result.items[0].user).toHaveProperty('lastName');
      expect(result.items[0].user).toHaveProperty('role');
    });

    it('should return an empty page when no audit logs exist', async () => {
      // Arrange
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result).toEqual({ items: [], total: 0, skip: 0, take: 50 });
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from Prisma', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockPrismaService.auditLog.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findAll({})).rejects.toThrow('Database connection failed');
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('aggregate', () => {
    it('should reject an unknown dimension', async () => {
      // Act & Assert
      await expect(service.aggregate({}, 'week' as AggregateDimension)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.auditLog.groupBy).not.toHaveBeenCalled();
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('should rank actions by count over the whole filtered set', async () => {
      // Arrange
      mockPrismaService.auditLog.count.mockResolvedValue(30);
      mockPrismaService.auditLog.groupBy.mockResolvedValue([
        { action: ActionType.LOGIN, _count: { _all: 20 } },
        { action: ActionType.CF4_GENERATED, _count: { _all: 10 } },
      ]);

      // Act
      const result = await service.aggregate({ role: Role.PHYSICIAN }, 'action');

      // Assert
      expect(mockPrismaService.auditLog.groupBy).toHaveBeenCalledWith({
        by: ['action'],
        where: { AND: [{ user: { role: Role.PHYSICIAN } }] },
        _count: { _all: true },
      });
      expect(result.total).toBe(30);
      expect(result.truncated).toBe(false);
      expect(result.buckets).toEqual([
        { key: ActionType.LOGIN, label: ActionType.LOGIN, count: 20 },
        { key: ActionType.CF4_GENERATED, label: ActionType.CF4_GENERATED, count: 10 },
      ]);
    });

    it('should resolve actor names for the ranking', async () => {
      // Arrange
      mockPrismaService.auditLog.count.mockResolvedValue(9);
      mockPrismaService.auditLog.groupBy.mockResolvedValue([
        { userId: 'u1', _count: { _all: 6 } },
        { userId: 'u2', _count: { _all: 3 } },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'u1', userId: 'DOC001', firstName: 'Ana', lastName: 'Reyes' },
        { id: 'u2', userId: 'NRS001', firstName: 'Ben', lastName: 'Cruz' },
      ]);

      // Act
      const result = await service.aggregate({}, 'actor');

      // Assert
      expect(result.buckets).toEqual([
        { key: 'DOC001', label: 'Ana Reyes (DOC001)', count: 6 },
        { key: 'NRS001', label: 'Ben Cruz (NRS001)', count: 3 },
      ]);
      expect(result.truncated).toBe(false);
    });

    it('should flag a capped ranking instead of silently dropping actors', async () => {
      // Arrange
      mockPrismaService.auditLog.count.mockResolvedValue(20);
      mockPrismaService.auditLog.groupBy.mockResolvedValue([
        { userId: 'u1', _count: { _all: 4 } },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      // Act
      const result = await service.aggregate({}, 'actor');

      // Assert
      expect(result.truncated).toBe(true);
      expect(result.buckets[0].label).toBe('Unknown user');
    });

    it('should bucket days in UTC and read left-to-right in time', async () => {
      // Arrange
      mockPrismaService.auditLog.count.mockResolvedValue(5);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { key: '2026-09-16', count: 3 },
        { key: '2026-09-15', count: 2 },
      ]);

      // Act
      const result = await service.aggregate({}, 'day');

      // Assert
      expect(result.buckets.map((bucket) => bucket.key)).toEqual(['2026-09-15', '2026-09-16']);
      expect(result.truncated).toBe(false);
      const [statement] = mockPrismaService.$queryRaw.mock.calls[0];
      expect(statement.sql).toContain("AT TIME ZONE 'UTC'");
      expect(statement.sql).toContain('JOIN users u');
    });

    it('should bind every table filter into the day query', async () => {
      // Arrange
      const from = new Date('2026-09-01T00:00:00.000Z');
      const to = new Date('2026-09-16T23:59:59.999Z');
      mockPrismaService.auditLog.count.mockResolvedValue(100);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act — the same filters the table accepts.
      await service.aggregate(
        {
          action: ActionType.CF4_GENERATED,
          role: Role.CLAIMS_PROCESSOR,
          userId: 'CLM001',
          from,
          to,
          search: 'approve summary',
        },
        'day',
      );

      // Assert — the raw-SQL mirror of `buildWhere` must bind the same inputs.
      // The search term is bound once per ILIKE column, and the bucket cap is
      // bound too rather than inlined.
      const [statement] = mockPrismaService.$queryRaw.mock.calls[0];
      expect(statement.values).toEqual([
        ActionType.CF4_GENERATED,
        Role.CLAIMS_PROCESSOR,
        'CLM001',
        from,
        to,
        ActionType.APPROVE_SUMMARY,
        '%approve summary%',
        '%approve summary%',
        '%approve summary%',
        400,
      ]);
      expect(statement.sql).toContain('a."action" = ?::"ActionType"');
      expect(statement.sql).toContain('u."role" = ?::"role"');
      expect(statement.sql).toContain('ILIKE');
      expect(statement.sql).toContain('LIMIT ?');
    });

    it('should report a truncated series when the cap hides older buckets', async () => {
      // Arrange
      mockPrismaService.auditLog.count.mockResolvedValue(50);
      mockPrismaService.$queryRaw.mockResolvedValue([{ key: '2026-09-16', count: 10 }]);

      // Act
      const result = await service.aggregate({}, 'day');

      // Assert
      expect(result.total).toBe(50);
      expect(result.truncated).toBe(true);
    });
  });

  describe('ordersOverTime', () => {
    const mockOrderData = [
      { period: new Date('2026-12-20'), count: 5 },
      { period: new Date('2026-12-19'), count: 3 },
      { period: new Date('2026-12-18'), count: 7 },
    ];

    it('should bind the bucket as a query parameter, never interpolate it', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue(mockOrderData);

      // Act
      const result = await service.ordersOverTime('day');

      // Assert — regression test for the raw-SQL injection issue: the time unit
      // reaches Postgres as a bound value, not as part of the statement text.
      const [statement] = mockPrismaService.$queryRaw.mock.calls[0];
      expect(statement.sql).toContain('FROM physician_orders');
      expect(statement.sql).toContain('LIMIT 100');
      expect(statement.sql).not.toContain("'day'");
      expect(statement.values).toEqual(['day']);
      expect(result).toEqual(mockOrderData);
    });

    it('should reject a bucket outside the allowed set', async () => {
      // Act & Assert
      await expect(
        service.ordersOverTime('quarter' as AuditLogBucket),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('summary', () => {
    const mockSummaryData = {
      totalUsers: 100,
      activeUsers: 75,
      pendingResets: 5,
      pendingSummaries: 20,
      approvedSummaries: 50,
    };

    it('should return summary statistics with all counts', async () => {
      // Arrange
      mockPrismaService.user.count
        .mockResolvedValueOnce(mockSummaryData.totalUsers)
        .mockResolvedValueOnce(mockSummaryData.activeUsers);
      mockPrismaService.passwordResetRequest.count.mockResolvedValue(
        mockSummaryData.pendingResets
      );
      mockPrismaService.courseInWard.count
        .mockResolvedValueOnce(mockSummaryData.pendingSummaries)
        .mockResolvedValueOnce(mockSummaryData.approvedSummaries);

      // Act
      const result = await service.summary();

      // Assert
      expect(mockPrismaService.user.count).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.user.count).toHaveBeenCalledWith();
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(mockPrismaService.passwordResetRequest.count).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
      });
      expect(mockPrismaService.courseInWard.count).toHaveBeenCalledWith({
        where: { status: 'DRAFT_AI' },
      });
      expect(mockPrismaService.courseInWard.count).toHaveBeenCalledWith({
        where: { status: 'APPROVED' },
      });

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 75,
        pendingResets: 5,
        pendingSummaries: 20,
        approvedSummaries: 50,
      });
    });

    it('should return zero counts when no data exists', async () => {
      // Arrange
      mockPrismaService.user.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrismaService.passwordResetRequest.count.mockResolvedValue(0);
      mockPrismaService.courseInWard.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      // Act
      const result = await service.summary();

      // Assert
      expect(result).toEqual({
        totalUsers: 0,
        activeUsers: 0,
        pendingResets: 0,
        pendingSummaries: 0,
        approvedSummaries: 0,
      });
    });

    it('should execute queries in parallel using Promise.all', async () => {
      // Arrange
      const mockUserCount = jest.fn().mockResolvedValue(100);
      const mockPasswordResetCount = jest.fn().mockResolvedValue(5);
      const mockCourseInWardCount = jest.fn().mockResolvedValue(20);

      mockPrismaService.user.count = mockUserCount;
      mockPrismaService.passwordResetRequest.count = mockPasswordResetCount;
      mockPrismaService.courseInWard.count = mockCourseInWardCount;

      // Act
      await service.summary();

      // Assert - All counts should be called
      expect(mockUserCount).toHaveBeenCalledTimes(2);
      expect(mockPasswordResetCount).toHaveBeenCalledTimes(1);
      expect(mockCourseInWardCount).toHaveBeenCalledTimes(2);
    });

    it('should handle errors from Prisma when getting summary', async () => {
      // Arrange
      const error = new Error('Database error');
      // First call succeeds, second call fails
      mockPrismaService.user.count
        .mockResolvedValueOnce(100)
        .mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.summary()).rejects.toThrow('Database error');
      // user.count is called twice (total users and active users)
      expect(mockPrismaService.user.count).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failure in Promise.all', async () => {
      // Arrange
      const error = new Error('Course count failed');
      mockPrismaService.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(75);
      mockPrismaService.passwordResetRequest.count.mockResolvedValue(5);
      mockPrismaService.courseInWard.count
        .mockResolvedValueOnce(20)
        .mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.summary()).rejects.toThrow('Course count failed');
    });
  });
});