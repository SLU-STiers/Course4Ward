// unit-tests/reports.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  ActionType,
  OrderStatus,
  OrderType,
  PhilHealthCF4Status,
  ResetStatus,
  Role,
  SummaryStatus,
} from '@prisma/client';
import { ReportsService, TREND_BUCKETS } from '../reports/reports.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  patient: { count: jest.fn() },
  patientAdmission: { count: jest.fn() },
  user: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  physicianOrder: { count: jest.fn(), groupBy: jest.fn() },
  courseInWard: { count: jest.fn(), groupBy: jest.fn() },
  summaryApprovalRequest: { count: jest.fn(), groupBy: jest.fn() },
  passwordResetRequest: { groupBy: jest.fn() },
  auditLog: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  $queryRaw: jest.fn(),
};

/** Every aggregation returns "nothing found" unless a test says otherwise. */
function primeEmptyDatabase() {
  mockPrismaService.patient.count.mockResolvedValue(0);
  mockPrismaService.patientAdmission.count.mockResolvedValue(0);
  mockPrismaService.user.count.mockResolvedValue(0);
  mockPrismaService.user.groupBy.mockResolvedValue([]);
  mockPrismaService.user.findMany.mockResolvedValue([]);
  mockPrismaService.physicianOrder.count.mockResolvedValue(0);
  mockPrismaService.physicianOrder.groupBy.mockResolvedValue([]);
  mockPrismaService.courseInWard.count.mockResolvedValue(0);
  mockPrismaService.courseInWard.groupBy.mockResolvedValue([]);
  mockPrismaService.summaryApprovalRequest.count.mockResolvedValue(0);
  mockPrismaService.summaryApprovalRequest.groupBy.mockResolvedValue([]);
  mockPrismaService.passwordResetRequest.groupBy.mockResolvedValue([]);
  mockPrismaService.auditLog.count.mockResolvedValue(0);
  mockPrismaService.auditLog.findMany.mockResolvedValue([]);
  mockPrismaService.auditLog.groupBy.mockResolvedValue([]);
  mockPrismaService.$queryRaw.mockResolvedValue([]);
}

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    primeEmptyDatabase();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('summary', () => {
    it('should default to the last 30 UTC days when no range is given', async () => {
      // Act
      const result = await service.summary();

      // Assert
      const span = result.range.to.getTime() - result.range.from.getTime();
      const days = Math.round(span / (24 * 60 * 60 * 1000));
      expect(days).toBe(29);
      expect(result.range.from.getUTCHours()).toBe(0);
      expect(result.range.from.getUTCMinutes()).toBe(0);
    });

    it('should read a date-only bound as the whole UTC day', async () => {
      // Act
      const result = await service.summary({
        from: new Date('2026-09-01'),
        to: new Date('2026-09-16'),
      });

      // Assert
      expect(result.range.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(result.range.to.toISOString()).toBe('2026-09-16T23:59:59.999Z');
    });

    it('should reject a range that ends before it starts', async () => {
      // Act & Assert
      await expect(
        service.summary({ from: new Date('2026-09-16'), to: new Date('2026-09-01') }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should zero-fill every enum bucket so the UI never sees a missing key', async () => {
      // Act
      const result = await service.summary();

      // Assert
      expect(Object.keys(result.users.byRole)).toEqual(Object.values(Role));
      expect(Object.keys(result.orders.byStatus)).toEqual(Object.values(OrderStatus));
      expect(Object.keys(result.orders.byType)).toEqual(Object.values(OrderType));
      expect(Object.keys(result.summaries.byStatus)).toEqual(Object.values(SummaryStatus));
      expect(Object.keys(result.philhealthCf4.byStatus)).toEqual(
        Object.values(PhilHealthCF4Status),
      );
      expect(Object.keys(result.passwordResets.byStatus)).toEqual(Object.values(ResetStatus));
      expect(result.users.byRole[Role.PHYSICIAN]).toBe(0);
    });

    it('should report the current census as state, not as a range count', async () => {
      // Arrange
      mockPrismaService.patient.count.mockResolvedValue(120);
      mockPrismaService.patientAdmission.count.mockImplementation(
        ({ where }: { where?: Record<string, unknown> } = {}) => {
          if (!where) return Promise.resolve(150);
          if ('dischargeDate' in where) return Promise.resolve(40);
          return Promise.resolve(7);
        },
      );

      // Act
      const result = await service.summary({ from: new Date('2026-09-01') });

      // Assert
      expect(result.census).toEqual({
        patients: 120,
        admissions: 150,
        activeAdmissions: 40,
        dischargedAdmissions: 110,
        admittedInRange: 7,
      });
    });

    it('should carry the stored counts into the status distributions', async () => {
      // Arrange
      mockPrismaService.physicianOrder.groupBy
        .mockResolvedValueOnce([{ status: OrderStatus.ONGOING, _count: { _all: 12 } }])
        .mockResolvedValueOnce([{ type: OrderType.ADMISSION, _count: { _all: 3 } }]);
      mockPrismaService.courseInWard.groupBy
        .mockResolvedValueOnce([{ status: SummaryStatus.APPROVED, _count: { _all: 9 } }])
        .mockResolvedValueOnce([
          { philhealthCf4Status: PhilHealthCF4Status.APPROVED, _count: { _all: 5 } },
        ]);
      mockPrismaService.summaryApprovalRequest.groupBy.mockResolvedValue([
        { status: 'CF4_GENERATED', _count: { _all: 4 } },
        { status: 'PENDING', _count: { _all: 6 } },
      ]);
      mockPrismaService.passwordResetRequest.groupBy.mockResolvedValue([
        { status: ResetStatus.PENDING, _count: { _all: 2 } },
      ]);

      // Act
      const result = await service.summary();

      // Assert
      expect(result.orders.byStatus[OrderStatus.ONGOING]).toBe(12);
      expect(result.orders.byType[OrderType.ADMISSION]).toBe(3);
      expect(result.summaries.byStatus[SummaryStatus.APPROVED]).toBe(9);
      expect(result.philhealthCf4.byStatus[PhilHealthCF4Status.APPROVED]).toBe(5);
      expect(result.passwordResets.byStatus[ResetStatus.PENDING]).toBe(2);
      // Claim status is a free-form string, so it comes back as an ordered list.
      expect(result.claims.byStatus).toEqual([
        { key: 'PENDING', count: 6 },
        { key: 'CF4_GENERATED', count: 4 },
      ]);
    });

    it('should derive the workflow funnel from the actions recorded in the range', async () => {
      // Arrange
      mockPrismaService.auditLog.groupBy.mockResolvedValue([
        { action: ActionType.CREATE_ORDER, _count: { _all: 40 } },
        { action: ActionType.REQUEST_SUMMARY, _count: { _all: 25 } },
        { action: ActionType.APPROVE_SUMMARY, _count: { _all: 18 } },
        { action: ActionType.CLAIM_CREATED, _count: { _all: 12 } },
        { action: ActionType.CF4_GENERATED, _count: { _all: 8 } },
        { action: ActionType.LOGIN, _count: { _all: 60 } },
      ]);

      // Act
      const result = await service.summary();

      // Assert
      expect(result.pipeline.map((stage) => stage.count)).toEqual([40, 25, 18, 12, 8]);
      expect(result.activity.byAction[0]).toEqual({ key: ActionType.LOGIN, count: 60 });
      expect(result.pipeline[4].label).toBe('CF4 generated');
    });

    it('should resolve the most active accounts with their role', async () => {
      // Arrange
      mockPrismaService.auditLog.count.mockResolvedValue(30);
      mockPrismaService.auditLog.findMany.mockResolvedValue([
        { userId: 'u-real-1' },
        { userId: 'u-real-2' },
      ]);
      mockPrismaService.auditLog.groupBy.mockResolvedValue([
        { userId: 'u-real-1', _count: { _all: 21 } },
        { userId: 'u-real-2', _count: { _all: 9 } },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'u-real-1', userId: 'DOC001', firstName: 'Ana', lastName: 'Reyes', role: Role.PHYSICIAN },
        { id: 'u-real-2', userId: 'NRS001', firstName: 'Ben', lastName: 'Cruz', role: Role.NURSE },
      ]);

      // Act
      const result = await service.summary();

      // Assert
      expect(result.activity.distinctActors).toBe(2);
      expect(result.topActors).toEqual([
        { userId: 'DOC001', name: 'Ana Reyes', role: Role.PHYSICIAN, count: 21 },
        { userId: 'NRS001', name: 'Ben Cruz', role: Role.NURSE, count: 9 },
      ]);
    });

    it('should break activity down by actor role using a join', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([
        { role: Role.PHYSICIAN, count: 14 },
        { role: Role.NURSE, count: 6 },
      ]);

      // Act
      const result = await service.summary();

      // Assert
      expect(result.activity.byRole).toEqual([
        { key: Role.PHYSICIAN, count: 14 },
        { key: Role.NURSE, count: 6 },
      ]);
    });
  });

  describe('activityTrend', () => {
    it('should zero-fill the periods inside the range', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ period: '2026-09-15', count: 4 }])
        .mockResolvedValueOnce([{ period: '2026-09-16', count: 2 }]);

      // Act
      const result = await service.activityTrend({
        bucket: 'day',
        from: new Date('2026-09-14'),
        to: new Date('2026-09-16'),
      });

      // Assert
      expect(result.points).toEqual([
        { period: '2026-09-14', activity: 0, orders: 0 },
        { period: '2026-09-15', activity: 4, orders: 0 },
        { period: '2026-09-16', activity: 0, orders: 2 },
      ]);
    });

    it('should bind the bucket and range as query parameters', async () => {
      // Act
      await service.activityTrend({
        bucket: 'day',
        from: new Date('2026-09-15'),
        to: new Date('2026-09-16'),
      });

      // Assert
      const [activityStatement, orderStatement] = mockPrismaService.$queryRaw.mock.calls.map(
        (call) => call[0],
      );
      expect(activityStatement.sql).toContain('FROM audit_logs');
      expect(activityStatement.sql).not.toContain("'day'");
      expect(activityStatement.values[0]).toBe('day');
      expect(orderStatement.sql).toContain('FROM physician_orders');
      expect(orderStatement.values[0]).toBe('day');
    });

    it('should align week buckets to the Monday date_trunc uses', async () => {
      // Arrange — 2026-09-16 is a Wednesday, so its week starts on 2026-09-14.
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.activityTrend({
        bucket: 'week',
        from: new Date('2026-09-16'),
        to: new Date('2026-09-20'),
      });

      // Assert
      expect(result.points.map((point) => point.period)).toEqual(['2026-09-14']);
    });

    it('should default to a daily bucket', async () => {
      // Act
      const result = await service.activityTrend();

      // Assert
      expect(result.bucket).toBe('day');
      expect(TREND_BUCKETS).toContain(result.bucket);
    });

    it('should reject an unsupported bucket', async () => {
      // Act & Assert
      await expect(
        service.activityTrend({ bucket: 'hour' as never }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('should reject a range too wide for the requested bucket', async () => {
      // Act & Assert
      await expect(
        service.activityTrend({
          bucket: 'day',
          from: new Date('2020-01-01'),
          to: new Date('2026-09-16'),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
