// backend/src/unit-tests/claims.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ClaimsController } from '../claims/claims.controller';
import { ClaimsService } from '../claims/claims.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PhilHealthCF4Status, SummaryStatus } from '@prisma/client';

const mockPrismaService = {
  courseInWard: {
    findUnique: jest.fn(),
  },
  summaryApprovalRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaService>;

const mockAuditLogService = {
  record: jest.fn(),
} as unknown as jest.Mocked<AuditLogService>;

describe('Claims Module', () => {
  let controller: ClaimsController;
  let service: ClaimsService;
  let prismaService: typeof mockPrismaService;
  let auditLogService: typeof mockAuditLogService;

  const mockUser = {
    id: 'user-123',
    userId: 'CP-001',
    role: 'CLAIMS_PROCESSOR',
  };

  const mockCourseInWardId = 'course-789';
  const mockClaimId = 'claim-456';
  
  // Complete mock data matching Prisma types
  const mockPatient = {
    id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    gender: 'MALE',
    dateOfBirth: new Date('1990-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Complete mock summary with ALL required fields
  const mockSummary = {
    id: mockCourseInWardId,
    patientId: 'patient-123',
    validatorId: 'physician-123',
    status: SummaryStatus.APPROVED,
    approvedStatus: true,
    summaryContent: 'Patient diagnosed with pneumonia, treated with antibiotics',
    summaryDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    validatedAt: new Date(),
    philhealthCf4Status: PhilHealthCF4Status.PENDING,
    philhealthCf4DecidedAt: null,
    patient: mockPatient,
    orders: [],
  };

  // Complete mock claim with all required fields
  const mockClaim = {
    id: mockClaimId,
    summaryId: mockCourseInWardId,
    physicianId: 'physician-123',
    processorId: mockUser.id,
    status: 'PENDING',
    requestedAt: new Date(),
    summary: mockSummary,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClaimsController],
      providers: [
        ClaimsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    controller = module.get<ClaimsController>(ClaimsController);
    service = module.get<ClaimsService>(ClaimsService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);

    jest.clearAllMocks();
  });

  // ============ SERVICE TESTS ============
  describe('ClaimsService', () => {
    describe('createFromSummary', () => {
      it('should create a claim from a valid summary', async () => {
        // Arrange
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue(mockSummary);
        (prismaService.summaryApprovalRequest.create as jest.Mock).mockResolvedValue(mockClaim);

        // Act
        const result = await service.createFromSummary(mockCourseInWardId, mockUser.id);

        // Assert
        expect(prismaService.courseInWard.findUnique).toHaveBeenCalledWith({
          where: { id: mockCourseInWardId },
        });
        expect(prismaService.summaryApprovalRequest.create).toHaveBeenCalledWith({
          data: {
            summaryId: mockCourseInWardId,
            physicianId: mockSummary.validatorId,
            processorId: mockUser.id,
          },
        });
        expect(auditLogService.record).toHaveBeenCalledWith({
          userId: mockUser.id,
          action: 'CLAIM_CREATED',
        });
        expect(result).toEqual(mockClaim);
      });

      it('should throw NotFoundException when summary not found', async () => {
        // Arrange
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.createFromSummary(mockCourseInWardId, mockUser.id))
          .rejects.toThrow('Course in the Ward summary not found');

        expect(prismaService.summaryApprovalRequest.create).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when summary has no validator', async () => {
        // Arrange
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          validatorId: null,
        });

        // Act & Assert
        await expect(service.createFromSummary(mockCourseInWardId, mockUser.id))
          .rejects.toThrow('Summary has no validating physician');

        expect(prismaService.summaryApprovalRequest.create).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });
    });

    describe('findAll', () => {
      it('should return all claims with patient info', async () => {
        // Arrange
        (prismaService.summaryApprovalRequest.findMany as jest.Mock).mockResolvedValue([mockClaim]);

        // Act
        const result = await service.findAll();

        // Assert
        expect(prismaService.summaryApprovalRequest.findMany).toHaveBeenCalledWith({
          orderBy: { id: 'desc' },
          include: {
            summary: {
              include: {
                patient: true,
                orders: {
                  orderBy: { dateCreated: 'desc' },
                  include: {
                    admission: { select: { admissionDate: true, dischargeDate: true } },
                    orderedBy: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        });
        expect(result).toEqual([mockClaim]);
      });

      it('should return empty array when no claims exist', async () => {
        // Arrange
        (prismaService.summaryApprovalRequest.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.findAll();

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('notifyPhysician', () => {
      it('should update claim status and log audit', async () => {
        // Arrange
        const updatedClaim = { 
          ...mockClaim, 
          status: 'PHYSICIAN_VALIDATION_REQUESTED',
        };
        (prismaService.summaryApprovalRequest.update as jest.Mock).mockResolvedValue(updatedClaim);

        // Act
        const result = await service.notifyPhysician(mockClaimId, mockUser.id);

        // Assert
        expect(prismaService.summaryApprovalRequest.update).toHaveBeenCalledWith({
          where: { id: mockClaimId },
          data: { status: 'PHYSICIAN_VALIDATION_REQUESTED' },
        });
        expect(auditLogService.record).toHaveBeenCalledWith({
          userId: mockUser.id,
          action: 'CLAIM_PHYSICIAN_NOTIFIED',
        });
        expect(result).toEqual(updatedClaim);
      });
    });

    describe('generateCf4', () => {
      it('should generate CF4 for approved claim', async () => {
        // Arrange
        (prismaService.summaryApprovalRequest.findUnique as jest.Mock).mockResolvedValue(mockClaim);
        const updatedClaim = { 
          ...mockClaim, 
          status: 'CF4_GENERATED',
        };
        (prismaService.summaryApprovalRequest.update as jest.Mock).mockResolvedValue(updatedClaim);

        // Act
        const result = await service.generateCf4(mockClaimId, mockUser.id);

        // Assert
        expect(prismaService.summaryApprovalRequest.findUnique).toHaveBeenCalledWith({
          where: { id: mockClaimId },
          include: { summary: { include: { patient: true } } },
        });
        expect(prismaService.summaryApprovalRequest.update).toHaveBeenCalledWith({
          where: { id: mockClaimId },
          data: { status: 'CF4_GENERATED' },
        });
        expect(auditLogService.record).toHaveBeenCalledWith({
          userId: mockUser.id,
          action: 'CF4_GENERATED',
        });
        expect(result).toEqual({
          claim: updatedClaim,
          cf4Fields: {
            patientName: 'John Doe',
            courseInTheWard: mockSummary.summaryContent,
          },
        });
      });

      it('should throw NotFoundException when claim not found', async () => {
        // Arrange
        (prismaService.summaryApprovalRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.generateCf4(mockClaimId, mockUser.id))
          .rejects.toThrow('Claim not found');

        expect(prismaService.summaryApprovalRequest.update).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when summary not approved', async () => {
        // Arrange
        (prismaService.summaryApprovalRequest.findUnique as jest.Mock).mockResolvedValue({
          ...mockClaim,
          summary: { ...mockSummary, status: 'PENDING', approvedStatus: false },
        });

        // Act & Assert
        await expect(service.generateCf4(mockClaimId, mockUser.id))
          .rejects.toThrow('Course in the Ward must be physician-approved before CF4 can be generated');

        expect(prismaService.summaryApprovalRequest.update).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });
    });
  });

  // ============ CONTROLLER TESTS ============
  describe('ClaimsController', () => {
    describe('create', () => {
      it('should call service.createFromSummary with correct params', async () => {
        // Arrange
        const dto = { courseInWardId: mockCourseInWardId };
        jest.spyOn(service, 'createFromSummary').mockResolvedValue(mockClaim);

        // Act
        const result = await controller.create(dto, mockUser);

        // Assert
        expect(service.createFromSummary).toHaveBeenCalledWith(mockCourseInWardId, mockUser.id);
        expect(result).toEqual(mockClaim);
      });
    });

    describe('findAll', () => {
      it('should call service.findAll', async () => {
        // Arrange
        jest.spyOn(service, 'findAll').mockResolvedValue([mockClaim]);

        // Act
        const result = await controller.findAll();

        // Assert
        expect(service.findAll).toHaveBeenCalled();
        expect(result).toEqual([mockClaim]);
      });
    });

    describe('notifyPhysician', () => {
      it('should call service.notifyPhysician with correct params', async () => {
        // Arrange
        const updatedClaim = { 
          ...mockClaim, 
          status: 'PHYSICIAN_VALIDATION_REQUESTED',
        };
        jest.spyOn(service, 'notifyPhysician').mockResolvedValue(updatedClaim);

        // Act
        const result = await controller.notifyPhysician(mockClaimId, mockUser);

        // Assert
        expect(service.notifyPhysician).toHaveBeenCalledWith(mockClaimId, mockUser.id);
        expect(result).toEqual(updatedClaim);
      });
    });

    describe('generateCf4', () => {
      it('should call service.generateCf4 with correct params', async () => {
        // Arrange
        const updatedClaim = { 
          ...mockClaim, 
          status: 'CF4_GENERATED',
        };
        const cf4Result = {
          claim: updatedClaim,
          cf4Fields: {
            patientName: 'John Doe',
            courseInTheWard: mockSummary.summaryContent,
          },
        };
        jest.spyOn(service, 'generateCf4').mockResolvedValue(cf4Result);

        // Act
        const result = await controller.generateCf4(mockClaimId, mockUser);

        // Assert
        expect(service.generateCf4).toHaveBeenCalledWith(mockClaimId, mockUser.id);
        expect(result).toEqual(cf4Result);
      });
    });
  });
});