// unit-tests/audit-log.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActionType } from '@prisma/client';

// Mock the PrismaService
const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
  passwordResetRequest: {
    count: jest.fn(),
  },
  courseInWard: {
    count: jest.fn(),
  },
  $queryRawUnsafe: jest.fn(),
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

    it('should record an audit log with PASSWORD_RESET action mapping to EDIT_ACCOUNT', async () => {
      // Arrange
      const mockAuditLogReset = {
        id: 'audit-2',
        userId: mockUserId,
        action: ActionType.EDIT_ACCOUNT,
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
          action: ActionType.EDIT_ACCOUNT,
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

    it('should map unknown action to EDIT_ACCOUNT as default', async () => {
      // Arrange
      const unknownAction = 'UNKNOWN_ACTION';
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
    });

    it('should handle all action mappings correctly', async () => {
      // Arrange
      const actionMappings = [
        { input: 'LOGIN', expected: ActionType.LOGIN },
        { input: 'PASSWORD_RESET', expected: ActionType.EDIT_ACCOUNT },
        { input: 'USER_CREATED', expected: ActionType.ADD_ACCOUNT },
        { input: 'USER_UPDATED', expected: ActionType.EDIT_ACCOUNT },
        { input: 'USER_DEACTIVATED', expected: ActionType.DELETE_ACCOUNT },
        { input: 'PATIENT_CREATED', expected: ActionType.REGISTER_PATIENT },
        { input: 'PATIENT_UPDATED', expected: ActionType.REGISTER_PATIENT },
        { input: 'ORDER_CREATED', expected: ActionType.CREATE_ORDER },
        { input: 'SUMMARY_GENERATED_AI', expected: ActionType.REQUEST_SUMMARY },
        { input: 'SUMMARY_EDITED_MANUAL', expected: ActionType.EDIT_SUMMARY },
        { input: 'SUMMARY_REGENERATED_AI', expected: ActionType.REGENERATE_SUMMARY },
        { input: 'SUMMARY_APPROVED', expected: ActionType.APPROVE_SUMMARY },
        { input: 'CLAIM_CREATED', expected: ActionType.REQUEST_SUMMARY },
        { input: 'CLAIM_PHYSICIAN_NOTIFIED', expected: ActionType.REQUEST_SUMMARY },
        { input: 'CF4_GENERATED', expected: ActionType.CREATE_ORDER },
      ];

      for (const mapping of actionMappings) {
        mockPrismaService.auditLog.create.mockResolvedValue({
          id: 'audit-5',
          userId: mockUserId,
          action: mapping.expected,
          timeStamp: new Date(),
        });

        await service.record({
          userId: mockUserId,
          action: mapping.input,
        });

        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: {
            userId: mockUserId,
            action: mapping.expected,
          },
        });
      }
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(actionMappings.length);
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

      // Act
      const result = await service.findAll({});

      // Assert
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { timeStamp: 'desc' },
        skip: undefined,
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
      expect(result).toEqual(mockAuditLogs);
      expect(result.length).toBe(2);
    });

    it('should return audit logs with custom skip and take values', async () => {
      // Arrange
      const params = { skip: 10, take: 20 };
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      // Act
      const result = await service.findAll(params);

      // Assert
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
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
      expect(result).toEqual(mockAuditLogs);
    });

    it('should include user information in the response', async () => {
      // Arrange
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result[0]).toHaveProperty('user');
      expect(result[0].user).toHaveProperty('firstName');
      expect(result[0].user).toHaveProperty('lastName');
      expect(result[0].user).toHaveProperty('role');
    });

    it('should return empty array when no audit logs exist', async () => {
      // Arrange
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result).toEqual([]);
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

  describe('ordersOverTime', () => {
    const mockOrderData = [
      { period: new Date('2026-12-20'), count: 5 },
      { period: new Date('2026-12-19'), count: 3 },
      { period: new Date('2026-12-18'), count: 7 },
    ];

    it('should return orders grouped by day', async () => {
      // Arrange
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockOrderData);

      // Act
      const result = await service.ordersOverTime('day');

      // Assert
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("date_trunc('day', \"dateCreated\")")
      );
      expect(result).toEqual(mockOrderData);
    });

    it('should return orders grouped by week', async () => {
      // Arrange
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockOrderData);

      // Act
      const result = await service.ordersOverTime('week');

      // Assert
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("date_trunc('week', \"dateCreated\")")
      );
      expect(result).toEqual(mockOrderData);
    });

    it('should return orders grouped by month', async () => {
      // Arrange
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockOrderData);

      // Act
      const result = await service.ordersOverTime('month');

      // Assert
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("date_trunc('month', \"dateCreated\")")
      );
      expect(result).toEqual(mockOrderData);
    });

    it('should return orders grouped by year', async () => {
      // Arrange
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockOrderData);

      // Act
      const result = await service.ordersOverTime('year');

      // Assert
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("date_trunc('year', \"dateCreated\")")
      );
      expect(result).toEqual(mockOrderData);
    });

    it('should limit results to 100 entries', async () => {
      // Arrange
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockOrderData);

      // Act
      await service.ordersOverTime('day');

      // Assert
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 100;')
      );
    });

    it('should order results by period descending', async () => {
      // Arrange
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockOrderData);

      // Act
      await service.ordersOverTime('day');

      // Assert
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY period DESC')
      );
    });

    it('should handle errors from raw query', async () => {
      // Arrange
      const error = new Error('SQL query failed');
      mockPrismaService.$queryRawUnsafe.mockRejectedValue(error);

      // Act & Assert
      await expect(service.ordersOverTime('day')).rejects.toThrow('SQL query failed');
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledTimes(1);
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