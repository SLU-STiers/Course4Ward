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
  courseInWard: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAuditLogService = {
  record: jest.fn(),
};

const mockOrdersService = {
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

    const mockOrders = [
      {
        id: 'order-1',
        type: 'Medication',
        description: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Twice daily',
      },
      {
        id: 'order-2',
        type: 'Lab Test',
        description: 'Blood work',
        dosage: null,
        frequency: null,
      },
    ];

    const mockAiResponse = {
      batch_id: 'batch-123',
      total_groups: 2,
      successful: 2,
      failed: 0,
      results: [
        { 
          id: 'order-1', 
          success: true, 
          summary: 'Patient received Amoxicillin 500mg twice daily.',
          processing_time_seconds: 1.5,
          error: null
        },
        { 
          id: 'order-2', 
          success: true, 
          summary: 'Blood work ordered.',
          processing_time_seconds: 1.2,
          error: null
        },
      ],
    };

    const mockCreatedSummary = {
      id: 'summary-789',
      patientId: mockPatientId,
      summaryContent: 'Patient received Amoxicillin 500mg twice daily. Blood work ordered.',
      status: SummaryStatus.DRAFT_AI,
      summaryDate: new Date(),
      approvedStatus: false,
      validatorId: null,
      validatedAt: null,
    };

    it('should generate a summary successfully', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findTodaysOrders.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.create.mockResolvedValue(mockCreatedSummary);
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      const result = await service.generateSummary(mockPatientId, mockRequestedById);

      // Assert
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { id: mockPatientId },
      });
      expect(mockOrdersService.findTodaysOrders).toHaveBeenCalledWith(mockPatientId);
      expect(mockOllamaClient.summarizeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'order-1',
            text: 'Medication Amoxicillin 500mg Twice daily',
          }),
          expect.objectContaining({
            id: 'order-2',
            text: 'Lab Test Blood work',
          }),
        ])
      );
      expect(mockPrismaService.courseInWard.create).toHaveBeenCalledWith({
        data: {
          patientId: mockPatientId,
          summaryContent: 'Patient received Amoxicillin 500mg twice daily. Blood work ordered.',
          status: SummaryStatus.DRAFT_AI,
        },
      });
      expect(mockAuditLogService.record).toHaveBeenCalledWith({
        userId: mockRequestedById,
        action: 'SUMMARY_GENERATED_AI',
      });
      expect(result).toEqual(mockCreatedSummary);
    });

    it('should throw NotFoundException if patient not found', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { id: mockPatientId },
      });
      // FIX: The service calls findTodaysOrders after finding the patient, but since patient is null,
      // it should not reach that point. However, the test is failing because it's being called.
      // Let's check if the service actually calls it or if the mock is being called unexpectedly.
      // Actually, the service throws NotFoundException before calling findTodaysOrders,
      // so this expectation should pass.
      expect(mockOrdersService.findTodaysOrders).not.toHaveBeenCalled();
      expect(mockOllamaClient.summarizeBatch).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if no orders found for today', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findTodaysOrders.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow('No orders recorded for this patient today');
      expect(mockOrdersService.findTodaysOrders).toHaveBeenCalledWith(mockPatientId);
      expect(mockOllamaClient.summarizeBatch).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if AI service fails', async () => {
      // Arrange
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findTodaysOrders.mockResolvedValue(mockOrders);
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
        results: [{ 
          id: 'order-1', 
          success: false, 
          summary: null,
          processing_time_seconds: 1.0,
          error: 'Failed to summarize'
        }],
      };
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findTodaysOrders.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(failedAiResponse);

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.courseInWard.create).not.toHaveBeenCalled();
    });

    it('should handle AI response with some failed results', async () => {
      // Arrange
      const partialFailedResponse = {
        batch_id: 'batch-123',
        total_groups: 2,
        successful: 1,
        failed: 1,
        results: [
          { 
            id: 'order-1', 
            success: true, 
            summary: 'First order summary.',
            processing_time_seconds: 1.0,
            error: null
          },
          { 
            id: 'order-2', 
            success: false, 
            summary: null,
            processing_time_seconds: 1.0,
            error: 'Failed to summarize'
          },
        ],
      };
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findTodaysOrders.mockResolvedValue(mockOrders);
      mockOllamaClient.summarizeBatch.mockResolvedValue(partialFailedResponse);

      // Act & Assert
      await expect(
        service.generateSummary(mockPatientId, mockRequestedById)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.courseInWard.create).not.toHaveBeenCalled();
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
      summaryDate: new Date(),
      approvedStatus: false,
      validatorId: null,
      validatedAt: null,
    };
    const mockPatient = {
      id: 'patient-123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'MALE',
    };
    const mockOrders = [
      {
        id: 'order-1',
        type: 'Medication',
        description: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Twice daily',
      },
    ];
    const mockAiResponse = {
      batch_id: 'batch-123',
      total_groups: 1,
      successful: 1,
      failed: 0,
      results: [{ 
        id: 'order-1', 
        success: true, 
        summary: 'Regenerated AI summary.',
        processing_time_seconds: 1.0,
        error: null
      }],
    };
    const mockUpdatedSummary = {
      ...mockExistingSummary,
      summaryContent: 'Regenerated AI summary.',
      status: SummaryStatus.DRAFT_AI,
    };

    it('should regenerate a summary successfully', async () => {
      // Arrange
      mockPrismaService.courseInWard.findUnique.mockResolvedValue(mockExistingSummary);
      mockOrdersService.findTodaysOrders.mockResolvedValue(mockOrders);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.update.mockResolvedValue(mockUpdatedSummary);
      mockAuditLogService.record.mockResolvedValue({});

      // Act
      const result = await service.regenerateSummary(mockSummaryId, mockPhysicianId);

      // Assert
      expect(mockPrismaService.courseInWard.findUnique).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
      });
      expect(mockOrdersService.findTodaysOrders).toHaveBeenCalledWith(
        mockExistingSummary.patientId
      );
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { id: mockExistingSummary.patientId },
      });
      expect(mockOllamaClient.summarizeBatch).toHaveBeenCalled();
      expect(mockPrismaService.courseInWard.update).toHaveBeenCalledWith({
        where: { id: mockSummaryId },
        data: {
          summaryContent: 'Regenerated AI summary.',
          status: SummaryStatus.DRAFT_AI,
        },
      });
      expect(mockAuditLogService.record).toHaveBeenCalledWith({
        userId: mockPhysicianId,
        action: 'SUMMARY_REGENERATED_AI',
      });
      expect(result).toEqual(mockUpdatedSummary);
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
      mockOrdersService.findTodaysOrders.mockResolvedValue(mockOrders);
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
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

    it('should handle null/undefined fields in order text', async () => {
      // Arrange
      const ordersWithNulls = [
        {
          id: 'order-1',
          type: 'Medication',
          description: null,
          dosage: null,
          frequency: null,
        },
      ];
      const mockAiResponse = {
        batch_id: 'batch-123',
        total_groups: 1,
        successful: 1,
        failed: 0,
        results: [{ 
          id: 'order-1', 
          success: true, 
          summary: 'Medication order.',
          processing_time_seconds: 1.0,
          error: null
        }],
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findTodaysOrders.mockResolvedValue(ordersWithNulls);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.create.mockResolvedValue({
        id: 'summary-789',
        patientId: mockPatientId,
        summaryContent: 'Medication order.',
        status: SummaryStatus.DRAFT_AI,
        summaryDate: new Date(),
        approvedStatus: false,
        validatorId: null,
        validatedAt: null,
      });

      // Act
      await service.generateSummary(mockPatientId, mockRequestedById);

      // Assert
      expect(mockOllamaClient.summarizeBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'order-1',
          text: 'Medication', // Only the type field since others are null
        }),
      ]);
    });

    it('should filter out empty strings from order text', async () => {
      // Arrange
      const ordersWithEmpty = [
        {
          id: 'order-1',
          type: 'Medication',
          description: '',
          dosage: '500mg',
          frequency: '',
        },
      ];
      const mockAiResponse = {
        batch_id: 'batch-123',
        total_groups: 1,
        successful: 1,
        failed: 0,
        results: [{ 
          id: 'order-1', 
          success: true, 
          summary: 'Medication 500mg.',
          processing_time_seconds: 1.0,
          error: null
        }],
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockOrdersService.findTodaysOrders.mockResolvedValue(ordersWithEmpty);
      mockOllamaClient.summarizeBatch.mockResolvedValue(mockAiResponse);
      mockPrismaService.courseInWard.create.mockResolvedValue({
        id: 'summary-789',
        patientId: mockPatientId,
        summaryContent: 'Medication 500mg.',
        status: SummaryStatus.DRAFT_AI,
        summaryDate: new Date(),
        approvedStatus: false,
        validatorId: null,
        validatedAt: null,
      });

      // Act
      await service.generateSummary(mockPatientId, mockRequestedById);

      // Assert
      expect(mockOllamaClient.summarizeBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'order-1',
          text: 'Medication 500mg', // Empty strings filtered out
        }),
      ]);
    });
  });
});