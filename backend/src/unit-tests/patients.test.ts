// backend/src/unit-tests/patients.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PatientsController } from '../patients/patients.controller';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrderEnteredBy, OrderStatus, OrderType, PhilHealthCF4Status, SummaryStatus } from '@prisma/client';

const mockPrismaService = {
  patient: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaService>;

const mockAuditLogService = {
  record: jest.fn(),
} as unknown as jest.Mocked<AuditLogService>;

describe('Patients Module', () => {
  let controller: PatientsController;
  let service: PatientsService;
  let prismaService: typeof mockPrismaService;
  let auditLogService: typeof mockAuditLogService;

  const mockUser = {
    id: 'user-123',
    userId: 'NURSE-001',
    role: 'NURSE',
  };

  const mockPatientId = 'patient-456';
  const mockAdmissionId = 'admission-1';
  
  // Complete mock patient matching the Prisma schema
  const mockPatient = {
    id: mockPatientId,
    firstName: 'John',
    lastName: 'Doe',
    gender: 'MALE',
    dateOfBirth: new Date('1990-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    admissions: [
      {
        id: mockAdmissionId,
        patientId: mockPatientId,
        physicianId: 'physician-123',
        admissionDate: new Date('2024-01-01'),
        dischargeDate: null,
        isOutpatient: false,
        outpatientSetAt: null,
        initialAssessment: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        orders: [
          {
            id: 'order-1',
            orderContent: 'Order content',
            type: OrderType.DEFAULT,
            status: OrderStatus.TO_ACCOMPLISH,
            nurseComment: null,
            executedById: null,
            executedAt: null,
            dateCreated: new Date(),
            dateUpdated: null,
            orderEmbedding: null,
            admissionId: mockAdmissionId,
            orderedById: 'physician-123',
            encodedById: 'physician-123',
            enteredByRole: OrderEnteredBy.PHYSICIAN,
            active: true,
            communicationChannel: null,
            summarizationId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        ],
      },
    ],
    notes: [
      {
        id: 'note-1',
        notesArray: 'Initial assessment notes',
        physicianId: 'physician-123',
        patientId: mockPatientId,
        createdAt: new Date(),
        reminderAt: null,
        updatedAt: new Date(),
      },
    ],
    coursesInWard: [
      {
        id: 'course-1',
        patientId: mockPatientId,
        summaryDate: new Date(),
        summaryContent: 'Course summary',
        status: SummaryStatus.DRAFT_AI, // ✅ Using enum instead of string
        approvedStatus: null,
        validatorId: null,
        validatedAt: null,
        philhealthCf4Status: PhilHealthCF4Status.PENDING,
        philhealthCf4DecidedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        orders: [],
        requests: [],
        approvedBy: null,
      },
    ],
  };

  // Simplified mock for create/update operations (without relations)
  const mockPatientSimple = {
    id: mockPatientId,
    firstName: 'John',
    lastName: 'Doe',
    gender: 'MALE',
    dateOfBirth: new Date('1990-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreatePatientDto = {
    firstName: 'John',
    lastName: 'Doe',
    gender: 'MALE',
    dateOfBirth: '1990-01-01',
  };

  const mockUpdatePatientDto = {
    gender: 'MALE',
    dateOfBirth: '1990-01-01',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    controller = module.get<PatientsController>(PatientsController);
    service = module.get<PatientsService>(PatientsService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);

    jest.clearAllMocks();
  });

  // ============ SERVICE TESTS ============
  describe('PatientsService', () => {
    describe('create', () => {
      it('should create a new patient', async () => {
        // Arrange
        (prismaService.patient.create as jest.Mock).mockResolvedValue(mockPatientSimple);

        // Act
        const result = await service.create(mockCreatePatientDto, mockUser.id);

        // Assert
        expect(prismaService.patient.create).toHaveBeenCalledWith({
          data: {
            firstName: mockCreatePatientDto.firstName,
            lastName: mockCreatePatientDto.lastName,
            gender: mockCreatePatientDto.gender,
            dateOfBirth: new Date(mockCreatePatientDto.dateOfBirth),
          },
        });
        expect(auditLogService.record).toHaveBeenCalledWith({
          userId: mockUser.id,
          action: 'PATIENT_CREATED',
        });
        expect(result).toEqual(mockPatientSimple);
      });

      it('should create a patient without dateOfBirth', async () => {
        // Arrange
        const dtoWithoutDob = { ...mockCreatePatientDto, dateOfBirth: undefined };
        (prismaService.patient.create as jest.Mock).mockResolvedValue({
          ...mockPatientSimple,
          dateOfBirth: null,
        });

        // Act
        const result = await service.create(dtoWithoutDob, mockUser.id);

        // Assert
        expect(prismaService.patient.create).toHaveBeenCalledWith({
          data: {
            firstName: dtoWithoutDob.firstName,
            lastName: dtoWithoutDob.lastName,
            gender: dtoWithoutDob.gender,
            dateOfBirth: undefined,
          },
        });
        expect(auditLogService.record).toHaveBeenCalled();
        expect(result.dateOfBirth).toBeNull();
      });
    });

    describe('findAssignedTo', () => {
      it('should return patients assigned to the user', async () => {
        // Arrange
        (prismaService.patient.findMany as jest.Mock).mockResolvedValue([mockPatient]);

        // Act
        const result = await service.findAssignedTo(mockUser.id);

        // Assert
        expect(prismaService.patient.findMany).toHaveBeenCalledWith({
          where: {
            admissions: { some: { physicianId: mockUser.id } },
          },
          include: {
            admissions: {
              where: { physicianId: mockUser.id },
              orderBy: { admissionDate: 'desc' },
              select: { id: true, admissionDate: true, dischargeDate: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        });
        expect(result).toEqual([mockPatient]);
      });

      it('should return empty array when no patients assigned', async () => {
        // Arrange
        (prismaService.patient.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.findAssignedTo(mockUser.id);

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('findOne', () => {
      it('should return a patient by id with related data', async () => {
        // Arrange
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);

        // Act
        const result = await service.findOne(mockPatientId);

        // Assert
        expect(prismaService.patient.findUnique).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          include: {
            admissions: { include: { orders: { orderBy: { dateCreated: 'desc' }, take: 20 } } },
            notes: { orderBy: { createdAt: 'desc' }, take: 20 },
            coursesInWard: { orderBy: { summaryDate: 'desc' }, take: 10 },
          },
        });
        expect(result).toEqual(mockPatient);
      });

      it('should throw NotFoundException when patient not found', async () => {
        // Arrange
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.findOne(mockPatientId))
          .rejects.toThrow('Patient not found');

        expect(prismaService.patient.findUnique).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          include: {
            admissions: { include: { orders: { orderBy: { dateCreated: 'desc' }, take: 20 } } },
            notes: { orderBy: { createdAt: 'desc' }, take: 20 },
            coursesInWard: { orderBy: { summaryDate: 'desc' }, take: 10 },
          },
        });
      });
    });

    describe('update', () => {
      it('should update a patient', async () => {
        // Arrange
        const updatedPatient = { ...mockPatientSimple, gender: 'FEMALE' };
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
        (prismaService.patient.update as jest.Mock).mockResolvedValue(updatedPatient);

        // Act
        const result = await service.update(mockPatientId, mockUpdatePatientDto, mockUser.id);

        // Assert
        expect(prismaService.patient.findUnique).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          include: {
            admissions: { include: { orders: { orderBy: { dateCreated: 'desc' }, take: 20 } } },
            notes: { orderBy: { createdAt: 'desc' }, take: 20 },
            coursesInWard: { orderBy: { summaryDate: 'desc' }, take: 10 },
          },
        });
        expect(prismaService.patient.update).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          data: {
            gender: mockUpdatePatientDto.gender,
            dateOfBirth: new Date(mockUpdatePatientDto.dateOfBirth),
          },
        });
        expect(auditLogService.record).toHaveBeenCalledWith({
          userId: mockUser.id,
          action: 'PATIENT_UPDATED',
        });
        expect(result).toEqual(updatedPatient);
      });

      it('should update patient without dateOfBirth', async () => {
        // Arrange
        const dtoWithoutDob = { ...mockUpdatePatientDto, dateOfBirth: undefined };
        const updatedPatient = { ...mockPatientSimple, dateOfBirth: null };
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
        (prismaService.patient.update as jest.Mock).mockResolvedValue(updatedPatient);

        // Act
        const result = await service.update(mockPatientId, dtoWithoutDob, mockUser.id);

        // Assert
        expect(prismaService.patient.update).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          data: {
            gender: dtoWithoutDob.gender,
            dateOfBirth: undefined,
          },
        });
        expect(result.dateOfBirth).toBeNull();
      });

      it('should throw NotFoundException when updating non-existent patient', async () => {
        // Arrange
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.update(mockPatientId, mockUpdatePatientDto, mockUser.id))
          .rejects.toThrow('Patient not found');

        expect(prismaService.patient.update).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });
    });
  });

  // ============ CONTROLLER TESTS ============
  describe('PatientsController', () => {
    describe('create', () => {
      it('should call service.create with correct params', async () => {
        // Arrange
        jest.spyOn(service, 'create').mockResolvedValue(mockPatientSimple);

        // Act
        const result = await controller.create(mockCreatePatientDto, mockUser);

        // Assert
        expect(service.create).toHaveBeenCalledWith(mockCreatePatientDto, mockUser.id);
        expect(result).toEqual(mockPatientSimple);
      });
    });

    describe('findAssignedToMe', () => {
      it('should call service.findAssignedTo with user id', async () => {
        // Arrange
        jest.spyOn(service, 'findAssignedTo').mockResolvedValue([mockPatient]);

        // Act
        const result = await controller.findAssignedToMe(mockUser);

        // Assert
        expect(service.findAssignedTo).toHaveBeenCalledWith(mockUser.id);
        expect(result).toEqual([mockPatient]);
      });
    });

    describe('findOne', () => {
      it('should call service.findOne with patient id', async () => {
        // Arrange
        jest.spyOn(service, 'findOne').mockResolvedValue(mockPatient);

        // Act
        const result = await controller.findOne(mockPatientId);

        // Assert
        expect(service.findOne).toHaveBeenCalledWith(mockPatientId);
        expect(result).toEqual(mockPatient);
      });
    });

    describe('update', () => {
      it('should call service.update with correct params', async () => {
        // Arrange
        const updatedPatient = { ...mockPatientSimple, gender: 'FEMALE' };
        jest.spyOn(service, 'update').mockResolvedValue(updatedPatient);

        // Act
        const result = await controller.update(mockPatientId, mockUpdatePatientDto, mockUser);

        // Assert
        expect(service.update).toHaveBeenCalledWith(mockPatientId, mockUpdatePatientDto, mockUser.id);
        expect(result).toEqual(updatedPatient);
      });
    });
  });
});