// unit-tests/course-in-ward.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CourseInWardService } from '../course-in-ward/course-in-ward.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrdersService } from '../orders/orders.service';
import { ConfigService } from '@nestjs/config';
import { SummaryStatus } from '@prisma/client';

// Mock the OllamaClient BEFORE importing the service
jest.mock('../course-in-ward/ollama-client', () => {
  return {
    OllamaClient: jest.fn().mockImplementation(() => ({
      summarizeBatch: jest.fn(),
      health: jest.fn(),
    })),
  };
});

// Import after mocking
import { OllamaClient } from '../course-in-ward/ollama-client';

// Mock the PrismaService
const mockPrismaService = {
  patient: {
    findUnique: jest.fn(),
  },
  physicianOrder: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  courseInWard: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAuditLogService = {
  record: jest.fn(),
};

const mockOrdersService = {
  findOrdersForDay: jest.fn(),
  findTodaysOrders: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

describe('CourseInWardService', () => {
  let service: CourseInWardService;
  let prismaService: PrismaService;
  let auditLogService: AuditLogService;
  let ordersService: OrdersService;
  let configService: ConfigService;
  let mockOllamaClient: jest.Mocked<OllamaClient>;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get the mock instance that will be used
    mockOllamaClient = new OllamaClient() as jest.Mocked<OllamaClient>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseInWardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        // Provide the mock OllamaClient
        {
          provide: OllamaClient,
          useValue: mockOllamaClient,
        },
      ],
    }).compile();

    service = module.get<CourseInWardService>(CourseInWardService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
    ordersService = module.get<OrdersService>(OrdersService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock config service to return a URL
    mockConfigService.get.mockReturnValue('http://localhost:8000');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSummary', () => {
    const mockPatientId = 'patient-123';
    const mockRequestedById = 'physician-456';
    const mockPatient = {
      id: mockPatientId,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'MALE',
    };

    // Both orders are written on the same local calendar day, so the AI folds
    // them into ONE admission-day group.
    const ordersDay = new Date(2026, 2, 4, 9, 15);
    const mockOrders = [
      {
        id: 'order-1',
        admissionId: 'admission-1',
        orderContent: 'Amoxicillin 500mg twice daily',
        dateCreated: ordersDay,
        admission: { id: 'admission-1', admissionDate: new Date(2026, 2, 2) },
      },
      {
        id: 'order-2',
        admissionId: 'admission-1',
        orderContent: 'Blood work',
        dateCreated: new Date(2026, 2, 4, 13, 40),
        admission: { id: 'admission-1', admissionDate: new Date(2026, 2, 2) },
      },
    ];

    // The AI service answers per admission-day group and echoes the orders that
    // were folded into each summary.
    const mockAiResponse = {
      batch_id: 'batch-123',
      total_groups: 1,
      successful: 1,
      failed: 0,
      results: [
        {
          group_id: 'admission-1-day-3',
          summary: 'Amoxicillin 500mg twice daily was given. Blood work was ordered.',
          success: true,
          processing_time_seconds: 1.5,
          error: null,
          orders: mockOrders.map((order) => ({
            id: order.id,
            text: order.orderContent,
            dateCreated: order.dateCreated.toISOString(),
          })),
        },
      ],
    };

    const mockCreatedSummary = {
      id: 'summary-789',
      patientId: mockPatientId,
      summaryContent: 'Amoxicillin 500mg twice daily was given. Blood work was ordered.',
      status: SummaryStatus.DRAFT_AI,
      summaryDate: new Date(2026, 2, 4),
      approvedStatus: false,
      validatorId: null,
      validatedAt: null,
    };

    beforeEach(() => {
      // No working draft for the day yet, so generation creates one.
      mockPrismaService.courseInWard.findFirst.mockResolvedValue(null);
      mockPrismaService.physicianOrder.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.physicianOrder.findMany.mockResolvedValue(mockOrders);
    });

    it('should generate one summary for the requested order day', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.create.mockResolvedValue(mockCreatedSummary);
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      const result = await service.generateSummary(
        mockPatientId,
        mockRequestedById,
        '2026-03-04',
      );

      // Assert
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { id: mockPatientId },
      });
      expect(mockOrdersService.findOrdersForDay).toHaveBeenCalledWith(
        mockPatientId,
        '2026-03-04',
      );
      // One admission-day group is sent, carrying the day's orders.
      expect(mockOllamaClient.summarizeBatch).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            admissionId: 'admission-1',
            orders: [
              expect.objectContaining({
                id: 'order-1',
                text: 'Amoxicillin 500mg twice daily',
              }),
              expect.objectContaining({ id: 'order-2', text: 'Blood work' }),
            ],
          }),
        ],
        expect.objectContaining({ temperature: 0.1 }),
      );
      // The summary is filed under the day its orders came from.
      expect(mockPrismaService.courseInWard.create).toHaveBeenCalledWith({
        data: {
          patientId: mockPatientId,
          summaryContent: mockCreatedSummary.summaryContent,
          summaryDate: new Date(2026, 2, 4),
          status: SummaryStatus.DRAFT_AI,
        },
      });
      // ...and those orders are linked to it for RAG.
      expect(mockPrismaService.physicianOrder.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['order-1', 'order-2'] } },
        data: { summarizationId: 'summary-789' },
      });
      expect(mockAuditLogService.record).toHaveBeenCalledWith({
        userId: mockRequestedById,
        action: 'SUMMARY_GENERATED_AI',
      });
      expect(result).toEqual([mockCreatedSummary]);
    });

    it('should default to today when no day is given', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.create.mockResolvedValue(mockCreatedSummary);
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      await service.generateSummary(mockPatientId, mockRequestedById);

      // Assert
      expect(mockOrdersService.findOrdersForDay).toHaveBeenCalledWith(
        mockPatientId,
        null,
      );
    });

    it('should refresh the day’s working draft instead of duplicating it', async () => {
      // Arrange
      const existingDraft = { id: 'summary-existing', patientId: mockPatientId };
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.findFirst.mockResolvedValue(existingDraft);
      mockPrismaService.courseInWard.update.mockResolvedValue(mockCreatedSummary);
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      await service.generateSummary(mockPatientId, mockRequestedById, '2026-03-04');

      // Assert
      expect(mockPrismaService.courseInWard.update).toHaveBeenCalledWith({
        where: { id: 'summary-existing' },
        data: {
          summaryContent: mockCreatedSummary.summaryContent,
          status: SummaryStatus.DRAFT_AI,
        },
      });
      expect(mockPrismaService.courseInWard.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if patient not found', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(null);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { id: mockPatientId },
      });
      expect(mockOllamaClient.summarizeBatch).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if the day has no orders', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById, '2026-03-04')
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById, '2026-03-04')
      ).rejects.toThrow('No orders recorded for this patient on 2026-03-04');
      expect(mockOllamaClient.summarizeBatch).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if AI service fails', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockRejectedValue(new Error('AI service unavailable'));

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow('AI summarization service is unavailable');
      expect(mockPrismaService.courseInWard.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if AI returns failed results', async () => {
      // Arrange
      const failedAiResponse = {
        batch_id: 'batch-123',
        total_groups: 1,
        successful: 0,
        failed: 1,
        results: [
          {
            group_id: 'admission-1-day-3',
            summary: null,
            success: false,
            processing_time_seconds: 1.0,
            error: 'Failed to summarize',
            orders: [],
          },
        ],
      };
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(failedAiResponse);

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.courseInWard.create).not.toHaveBeenCalled();
    });

    it('should store one summary per day group when the AI reports several', async () => {
      // Arrange
      const twoDayResponse = {
        batch_id: 'batch-123',
        total_groups: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            group_id: 'admission-1-day-3',
            summary: 'Day three summary.',
            success: true,
            processing_time_seconds: 1.0,
            error: null,
            orders: [
              {
                id: 'order-1',
                text: 'Amoxicillin 500mg twice daily',
                dateCreated: new Date(2026, 2, 4, 9, 15).toISOString(),
              },
            ],
          },
          {
            group_id: 'admission-1-day-4',
            summary: 'Day four summary.',
            success: true,
            processing_time_seconds: 1.0,
            error: null,
            orders: [
              {
                id: 'order-2',
                text: 'Blood work',
                dateCreated: new Date(2026, 2, 5, 9, 15).toISOString(),
              },
            ],
          },
        ],
      };
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(twoDayResponse);
      mockPrismaService.courseInWard.create
        .mockResolvedValueOnce({ ...mockCreatedSummary, id: 'summary-1' })
        .mockResolvedValueOnce({ ...mockCreatedSummary, id: 'summary-2' });
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      const result = await service.generateSummary(mockPatientId, mockRequestedById);

      // Assert
      expect(mockPrismaService.courseInWard.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.courseInWard.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ summaryDate: new Date(2026, 2, 4) }),
      });
      expect(mockPrismaService.courseInWard.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ summaryDate: new Date(2026, 2, 5) }),
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('editSummary', () => {
    const mockSummaryId = 'summary-789';
    const mockPhysicianId = 'physician-456';
    const mockEditedText = 'Manually edited summary content.';
    const mockExistingSummary = {
      id: mockSummaryId,
      patientId: 'patient-123',
      summaryContent: 'Original AI summary',
      status: SummaryStatus.DRAFT_AI,
      summaryDate: new Date(),
      approvedStatus: false,
      validatorId: null,
      validatedAt: null,
    };
    const mockUpdatedSummary = {
      ...mockExistingSummary,
      summaryContent: mockEditedText,
      status: SummaryStatus.DRAFT_EDITED,
    };

    it('should edit a summary successfully', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(mockExistingSummary);
      mockPrismaService.courseInWard.update.mockResolvedValue(mockUpdatedSummary);
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      const result = await service.editSummary(mockSummaryId, mockEditedText, mockPhysicianId);

      // Assert
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
      expect(mockPrismaService.courseInWard.update).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
        data: {
          summaryContent: mockEditedText,
          status: SummaryStatus.DRAFT_EDITED,
        },
      });
      expect(mockAuditLogService.record).toHaveBeenCalledWith({
        userId: mockPhysicianId,
        action: 'SUMMARY_EDITED_MANUAL',
      });
      expect(result).toEqual(mockUpdatedSummary);
    });

    it('should throw NotFoundException if summary does not exist', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.editSummary(mockSummaryId, mockEditedText, mockPhysicianId)
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
      expect(mockPrismaService.courseInWard.update).not.toHaveBeenCalled();
    });
  });

  describe('regenerateSummary', () => {
    const mockSummaryId = 'summary-789';
    const mockPhysicianId = 'physician-456';
    const mockExistingSummary = {
      id: mockSummaryId,
      patientId: 'patient-123',
      summaryContent: 'Original AI summary',
      status: SummaryStatus.DRAFT_AI,
      // A Course in the Ward covers one order day.
      summaryDate: new Date(2026, 2, 4),
      approvedStatus: false,
      validatorId: null,
      validatedAt: null,
    };
    // Built from local time so the order day is the same on any runner.
    const orderDate = new Date(2026, 2, 4, 9, 15);
    const mockOrders = [
      {
        id: 'order-1',
        admissionId: 'admission-1',
        orderContent: 'Amoxicillin 500mg twice daily',
        dateCreated: orderDate,
        admission: { id: 'admission-1', admissionDate: new Date(2026, 2, 2) },
      },
    ];
    const mockAiResponse = {
      batch_id: 'batch-123',
      total_groups: 1,
      successful: 1,
      failed: 0,
      results: [
        {
          group_id: 'admission-1-day-3',
          summary: 'Regenerated AI summary.',
          success: true,
          processing_time_seconds: 1.0,
          error: null,
          orders: [
            {
              id: 'order-1',
              text: 'Amoxicillin 500mg twice daily',
              dateCreated: orderDate.toISOString(),
            },
          ],
        },
      ],
    };
    const mockUpdatedSummary = {
      ...mockExistingSummary,
      summaryContent: 'Regenerated AI summary.',
      status: SummaryStatus.DRAFT_AI,
    };

    it('should regenerate a summary successfully', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(mockExistingSummary);
      mockPrismaService.physicianOrder.findMany.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.update.mockResolvedValue(mockUpdatedSummary);
      mockAuditLogService.record.mockResolvedValue({});
      mockPrismaService.physicianOrder.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.regenerateSummary(mockSummaryId, mockPhysicianId);

      // Assert
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
      // Rebuild from the orders this summary is linked to, not from today's.
      expect(mockPrismaService.physicianOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { summarizationId: mockSummaryId },
        }),
      );
      expect(mockOllamaClient.summarizeBatch).toHaveBeenCalled();
      expect(mockPrismaService.courseInWard.update).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
        data: expect.objectContaining({
          summaryContent: 'Regenerated AI summary.',
          status: SummaryStatus.DRAFT_AI,
        }),
      });
      expect(mockAuditLogService.record).toHaveBeenCalledWith({
        userId: mockPhysicianId,
        action: 'SUMMARY_REGENERATED_AI',
      });
      expect(result).toEqual(mockUpdatedSummary);
    });

    it('should fall back to the orders of the day the summary covers', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(mockExistingSummary);
      mockPrismaService.physicianOrder.findMany.mockResolvedValue([]);
      mockOrdersService.findOrdersForDay.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.update.mockResolvedValue(mockUpdatedSummary);
      mockAuditLogService.record.mockResolvedValue({});
      mockPrismaService.physicianOrder.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.regenerateSummary(mockSummaryId, mockPhysicianId);

      // Assert
      expect(mockOrdersService.findOrdersForDay).toHaveBeenCalledWith(
        mockExistingSummary.patientId,
        '2026-03-04',
      );
    });

    it('should throw NotFoundException if summary does not exist', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.regenerateSummary(mockSummaryId, mockPhysicianId)
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
    });

    it('should throw BadRequestException if AI service fails during regeneration', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(mockExistingSummary);
      mockPrismaService.physicianOrder.findMany.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockRejectedValue(new Error('AI service unavailable'));

      // Act & Assert
      await expect(
        service.regenerateSummary(mockSummaryId, mockPhysicianId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    const mockSummaryId = 'summary-789';
    const mockPhysicianId = 'physician-456';
    const mockExistingSummary = {
      id: mockSummaryId,
      patientId: 'patient-123',
      summaryContent: 'Summary content',
      status: SummaryStatus.DRAFT_AI,
      summaryDate: new Date(),
      approvedStatus: false,
      validatorId: null,
      validatedAt: null,
    };
    const mockApprovedSummary = {
      ...mockExistingSummary,
      status: SummaryStatus.APPROVED,
      approvedStatus: true,
      validatorId: mockPhysicianId,
      validatedAt: expect.any(Date),
    };

    it('should approve a summary successfully', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(mockExistingSummary);
      mockPrismaService.courseInWard.update.mockResolvedValue(mockApprovedSummary);
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      const result = await service.approve(mockSummaryId, mockPhysicianId);

      // Assert
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
      expect(mockPrismaService.courseInWard.update).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
        data: {
          status: SummaryStatus.APPROVED,
          approvedStatus: true,
          validatorId: mockPhysicianId,
          validatedAt: expect.any(Date),
        },
      });
      expect(mockAuditLogService.record).toHaveBeenCalledWith({
        userId: mockPhysicianId,
        action: 'SUMMARY_APPROVED',
      });
      expect(result).toEqual(mockApprovedSummary);
    });

    it('should throw NotFoundException if summary does not exist', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.approve(mockSummaryId, mockPhysicianId)
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
      expect(mockPrismaService.courseInWard.update).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const mockSummaryId = 'summary-789';
    const mockSummary = {
      id: mockSummaryId,
      patientId: 'patient-123',
      summaryContent: 'Summary content',
      status: SummaryStatus.DRAFT_AI,
      summaryDate: new Date(),
      approvedStatus: false,
      validatorId: null,
      validatedAt: null,
    };

    it('should return a summary if found', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(mockSummary);

      // Act
      const result = await service.findOne(mockSummaryId);

      // Assert
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
      expect(result).toEqual(mockSummary);
    });

    it('should throw NotFoundException if summary not found', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(mockSummaryId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
    });
  });

  describe('findForPatient', () => {
    const mockPatientId = 'patient-123';
    const mockSummaries = [
      {
        id: 'summary-1',
        patientId: mockPatientId,
        summaryContent: 'Summary 1',
        status: SummaryStatus.APPROVED,
        summaryDate: new Date('2026-12-20T10:00:00Z'),
        approvedStatus: true,
        validatorId: 'physician-1',
        validatedAt: new Date('2026-12-20T10:00:00Z'),
      },
      {
        id: 'summary-2',
        patientId: mockPatientId,
        summaryContent: 'Summary 2',
        status: SummaryStatus.DRAFT_AI,
        summaryDate: new Date('2026-12-19T10:00:00Z'),
        approvedStatus: false,
        validatorId: null,
        validatedAt: null,
      },
    ];

    it('should return all summaries for a patient sorted by date descending', async () => {
      // Arrange
      mockPrismaService.courseInWard.findMany.mockResolvedValue(mockSummaries);

      // Act
      const result = await service.findForPatient(mockPatientId);

      // Assert
      expect(mockPrismaService.courseInWard.findMany).toHaveBeenCalledWith({
        where: { patientId: mockPatientId },
        orderBy: { summaryDate: 'desc' },
        // The linked orders tell the UI which order day each summary covers.
        include: { orders: { select: { id: true, dateCreated: true } } },
      });
      expect(result).toEqual(mockSummaries);
      expect(result.length).toBe(2);
    });

    it('should return empty array when patient has no summaries', async () => {
      // Arrange
      mockPrismaService.courseInWard.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findForPatient(mockPatientId);

      // Assert
      expect(result).toEqual([]);
      expect(mockPrismaService.courseInWard.findMany).toHaveBeenCalledWith({
        where: { patientId: mockPatientId },
        orderBy: { summaryDate: 'desc' },
        include: { orders: { select: { id: true, dateCreated: true } } },
      });
    });
  });

  describe('callAiSummarizer (private method)', () => {
    // Testing the private method indirectly through generateSummary
    const mockPatientId = 'patient-123';
    const mockRequestedById = 'physician-456';
    const mockPatient = {
      id: mockPatientId,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'MALE',
    };

    beforeEach(() => {
      mockPrismaService.courseInWard.findFirst.mockResolvedValue(null);
      mockPrismaService.physicianOrder.updateMany.mockResolvedValue({ count: 1 });
      mockAuditLogService.record.mockResolvedValue({});
    });

    it('should send the raw order content, one entry per admission', async () => {
      // Arrange
      const orders = [
        {
          id: 'order-1',
          admissionId: 'admission-1',
          orderContent: 'Amoxicillin 500mg twice daily',
          dateCreated: new Date(2026, 2, 4, 8, 0),
          admission: { id: 'admission-1', admissionDate: new Date(2026, 2, 2) },
        },
        {
          id: 'order-2',
          admissionId: 'admission-2',
          orderContent: 'Chest X-ray',
          dateCreated: new Date(2026, 2, 4, 9, 0),
          admission: { id: 'admission-2', admissionDate: new Date(2026, 2, 4) },
        },
      ];
      const mockAiResponse = {
        batch_id: 'batch-123',
        total_groups: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            group_id: 'admission-1-day-3',
            summary: 'Amoxicillin was given.',
            success: true,
            processing_time_seconds: 1.0,
            error: null,
            orders: [
              {
                id: 'order-1',
                text: 'Amoxicillin 500mg twice daily',
                dateCreated: new Date(2026, 2, 4, 8, 0).toISOString(),
              },
            ],
          },
          {
            group_id: 'admission-2-day-1',
            summary: 'A chest X-ray was taken.',
            success: true,
            processing_time_seconds: 1.0,
            error: null,
            orders: [
              {
                id: 'order-2',
                text: 'Chest X-ray',
                dateCreated: new Date(2026, 2, 4, 9, 0).toISOString(),
              },
            ],
          },
        ],
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findOrdersForDay.mockResolvedValue(orders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.create.mockResolvedValue({
        id: 'summary-789',
        patientId: mockPatientId,
        summaryContent: 'Amoxicillin was given.',
        status: SummaryStatus.DRAFT_AI,
        summaryDate: new Date(2026, 2, 4),
        approvedStatus: false,
        validatorId: null,
        validatedAt: null,
      });

      // Act
      await service.generateSummary(mockPatientId, mockRequestedById);

      // Assert
      const [admissions] = mockOllamaClient.summarizeBatch.mock.calls[0];
      expect(admissions).toHaveLength(2);
      expect(admissions[0]).toEqual(
        expect.objectContaining({
          admissionId: 'admission-1',
          // Carried through so the AI can label the group "Day N of Admission".
          admissionDate: new Date(2026, 2, 2).toISOString(),
          orders: [
            expect.objectContaining({
              id: 'order-1',
              text: 'Amoxicillin 500mg twice daily',
            }),
          ],
        }),
      );
      expect(admissions[1]).toEqual(
        expect.objectContaining({
          admissionId: 'admission-2',
          orders: [expect.objectContaining({ id: 'order-2', text: 'Chest X-ray' })],
        }),
      );
      // Both groups cover the same day but different admissions, so the day
      // holds one Course in the Ward per admission.
      expect(mockPrismaService.courseInWard.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.courseInWard.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ summaryDate: new Date(2026, 2, 4) }),
      });
      expect(mockPrismaService.courseInWard.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ summaryDate: new Date(2026, 2, 4) }),
      });
    });
  });
});