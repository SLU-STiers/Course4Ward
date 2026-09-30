// backend/src/unit-tests/patients.test.ts
import { BadRequestException, ConflictException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreatePatientDto } from "../patients/dto/patient.dto";
import { Test, TestingModule } from "@nestjs/testing";
import { PatientsController } from "../patients/patients.controller";
import { PatientsService } from "../patients/patients.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  CommunicationChannel,
  OrderEnteredBy,
  OrderStatus,
  OrderType,
  PatientClass,
  PhilHealthCF4Status,
  Role,
  Sex,
  SummaryStatus,
} from "@prisma/client";

const mockPrismaService = {
  patient: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  patientAdmission: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  physicianOrder: {
    count: jest.fn(),
  },
  admissionPhysician: {
    create: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaService>;

const mockAuditLogService = {
  record: jest.fn(),
} as unknown as jest.Mocked<AuditLogService>;

describe("Patients Module", () => {
  let controller: PatientsController;
  let service: PatientsService;
  let prismaService: typeof mockPrismaService;
  let auditLogService: typeof mockAuditLogService;

  const mockUser = {
    id: "user-123",
    userId: "NURSE-001",
    role: "NURSE",
  };

  const mockPatientId = "patient-456";
  const mockAdmissionId = "admission-1";

  const mockPatient = {
    id: mockPatientId,
    firstName: "John",
    lastName: "Doe",
    gender: Sex.MALE,
    dateOfBirth: new Date("1990-01-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
    admissions: [
      {
        id: mockAdmissionId,
        patientId: mockPatientId,
        physicianId: "physician-123",
        admissionDate: new Date("2024-01-01"),
        dischargeDate: null,
        patientClass: PatientClass.INPATIENT,
        classSince: new Date("2024-01-01"),
        initialAssessment: null,
        triage: {
          triageLevel: 3,
          triageTime: "08:30",
          heartRate: 88,
          respRate: 18,
          spo2: 97,
          bpSystolic: 120,
          bpDiastolic: 80,
          temperature: null,
          painScore: 2,
          createdAt: new Date("2024-01-01"),
          recordedBy: { firstName: "Nora", lastName: "Reyes" },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        orders: [
          {
            id: "order-1",
            orderContent: "Order content",
            type: OrderType.DEFAULT,
            status: OrderStatus.TO_ACCOMPLISH,
            nurseComment: null,
            executedById: null,
            executedAt: null,
            dateCreated: new Date(),
            dateUpdated: null,
            orderEmbedding: null,
            admissionId: mockAdmissionId,
            orderedById: "physician-123",
            encodedById: "physician-123",
            enteredByRole: OrderEnteredBy.PHYSICIAN,
            active: true,
            summarizationId: null,
            communicationChannel: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ],
    notes: [
      {
        id: "note-1",
        notesArray: "Initial assessment notes",
        physicianId: "physician-123",
        patientId: mockPatientId,
        createdAt: new Date(),
        reminderAt: null,
        updatedAt: new Date(),
      },
    ],
    coursesInWard: [
      {
        id: "course-1",
        patientId: mockPatientId,
        summaryDate: new Date(),
        summaryContent: "Course summary",
        status: SummaryStatus.DRAFT_AI,
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

  const mockPatientSimple = {
    id: mockPatientId,
    firstName: "John",
    lastName: "Doe",
    gender: Sex.MALE,
    dateOfBirth: new Date("1990-01-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
    admissions: [
      {
        id: "admission-1",
        admissionDate: new Date(),
        dischargeDate: null,
        patientClass: PatientClass.INPATIENT,
        classSince: new Date(),
        initialAssessment: null,
        physician: null,
        additionalPhysicians: [],
        triage: null,
      },
    ],
  };

  const mockCreatePatientDto = {
    firstName: "John",
    lastName: "Doe",
    gender: Sex.MALE,
    dateOfBirth: "1990-01-01",
    physicianId: "physician-123",
  };

  const mockUpdatePatientDto = {
    gender: Sex.MALE,
    dateOfBirth: "1990-01-01",
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
    (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);
  });

  // ============ SERVICE TESTS ============
  describe("PatientsService", () => {
    describe("create", () => {
      it("should create a new patient with an admission", async () => {
        (prismaService.patient.create as jest.Mock).mockResolvedValue(
          mockPatientSimple,
        );

        const result = await service.create(mockCreatePatientDto, mockUser.id);

        expect(prismaService.patient.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              firstName: mockCreatePatientDto.firstName,
              lastName: mockCreatePatientDto.lastName,
              gender: mockCreatePatientDto.gender,
              dateOfBirth: new Date(mockCreatePatientDto.dateOfBirth),
              admissions: expect.objectContaining({
                create: expect.objectContaining({
                  // No class given: an outpatient, no order needed.
                  patientClass: PatientClass.OUTPATIENT,
                  classSince: expect.any(Date),
                  physicianId: "physician-123",
                }),
              }),
            }),
            include: expect.any(Object),
          }),
        );
        expect(auditLogService.record).toHaveBeenCalledWith({
          userId: mockUser.id,
          action: "PATIENT_CREATED",
        });
        expect(result).toEqual(mockPatientSimple);
      });

      it("should attach additional physicians to the admission", async () => {
        (prismaService.user.count as jest.Mock).mockResolvedValue(3);
        (prismaService.patient.create as jest.Mock).mockResolvedValue(mockPatientSimple);

        await service.create(
          {
            ...mockCreatePatientDto,
            additionalPhysicianIds: ["physician-2", "physician-3", "physician-123"],
          },
          mockUser.id,
        );

        expect(prismaService.patient.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              admissions: expect.objectContaining({
                create: expect.objectContaining({
                  additionalPhysicians: {
                    create: [{ physicianId: "physician-2" }, { physicianId: "physician-3" }],
                  },
                }),
              }),
            }),
          }),
        );
      });

      it("should store triage vitals in their own table and notes as initialAssessment", async () => {
        (prismaService.patient.create as jest.Mock).mockResolvedValue(mockPatientSimple);

        await service.create(
          {
            ...mockCreatePatientDto,
            triageLevel: 2,
            triageTime: "08:30",
            heartRate: 88,
            spo2: 97,
            bp: "120/80",
            temp: 37.4,
            pain: 3,
            notes: "Chest pain since morning",
          },
          mockUser.id,
        );

        expect(prismaService.patient.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              admissions: expect.objectContaining({
                create: expect.objectContaining({
                  initialAssessment: "Chest pain since morning",
                  triage: {
                    create: {
                      triageLevel: 2,
                      triageTime: "08:30",
                      heartRate: 88,
                      respRate: undefined,
                      spo2: 97,
                      bpSystolic: 120,
                      bpDiastolic: 80,
                      temperature: 37.4,
                      painScore: 3,
                      recordedById: mockUser.id,
                    },
                  },
                }),
              }),
            }),
          }),
        );
      });

      it("should skip the triage row when no vitals are entered", async () => {
        (prismaService.patient.create as jest.Mock).mockResolvedValue(mockPatientSimple);

        await service.create(mockCreatePatientDto, mockUser.id);

        const call = (prismaService.patient.create as jest.Mock).mock.calls[0][0];
        expect(call.data.admissions.create.triage).toBeUndefined();
      });

      it("should keep a triage row for the level alone", async () => {
        (prismaService.patient.create as jest.Mock).mockResolvedValue(mockPatientSimple);

        await service.create({ ...mockCreatePatientDto, triageLevel: 4 }, mockUser.id);

        const call = (prismaService.patient.create as jest.Mock).mock.calls[0][0];
        expect(call.data.admissions.create.triage.create).toEqual(
          expect.objectContaining({ triageLevel: 4, recordedById: mockUser.id }),
        );
      });

      it.each([0, 6, 2.5])("should reject triage level %p in the DTO", async (triageLevel) => {
        const dto = plainToInstance(CreatePatientDto, {
          firstName: "Juan",
          lastName: "Dela Cruz",
          physicianId: "7f1c0d6e-1b2a-4c3d-9e8f-0a1b2c3d4e5f",
          triageLevel,
        });
        const errors = await validate(dto);
        expect(errors.map((error) => error.property)).toContain("triageLevel");
      });

      it("should reject inactive or unknown physicians", async () => {
        (prismaService.user.count as jest.Mock).mockResolvedValue(0);

        await expect(service.create(mockCreatePatientDto, mockUser.id)).rejects.toThrow(
          "One or more selected physicians were not found or are inactive",
        );
        expect(prismaService.patient.create).not.toHaveBeenCalled();
      });

      it("should create a patient without dateOfBirth", async () => {
        const dtoWithoutDob = {
          ...mockCreatePatientDto,
          dateOfBirth: undefined,
        };
        (prismaService.patient.create as jest.Mock).mockResolvedValue({
          ...mockPatientSimple,
          dateOfBirth: null,
        });

        const result = await service.create(dtoWithoutDob, mockUser.id);

        expect(prismaService.patient.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              firstName: dtoWithoutDob.firstName,
              lastName: dtoWithoutDob.lastName,
              gender: dtoWithoutDob.gender,
              dateOfBirth: undefined,
            }),
          }),
        );
        expect(auditLogService.record).toHaveBeenCalled();
        expect(result.dateOfBirth).toBeNull();
      });

      it.each([
        [PatientClass.INPATIENT, OrderType.ADMISSION],
        [PatientClass.OBSERVATION, OrderType.OBSERVATION],
      ])(
        "should register as %s together with the physician's %s order",
        async (patientClass, orderType) => {
          (prismaService.patient.create as jest.Mock).mockResolvedValue(mockPatientSimple);

          await service.create(
            {
              ...mockCreatePatientDto,
              patientClass,
              registrationOrder: "  Admit to ICU. Trauma protocol.  ",
              registrationOrderChannel: CommunicationChannel.VERBAL,
            },
            mockUser.id,
          );

          const admission = (prismaService.patient.create as jest.Mock).mock.calls[0][0].data
            .admissions.create;
          expect(admission).toEqual(
            expect.objectContaining({
              patientClass,
              classSince: expect.any(Date),
              orders: {
                create: {
                  orderContent: "Admit to ICU. Trauma protocol.",
                  type: orderType,
                  orderedById: "physician-123",
                  encodedById: mockUser.id,
                  enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
                  communicationChannel: CommunicationChannel.VERBAL,
                },
              },
            }),
          );
          expect(auditLogService.record).toHaveBeenCalledWith({
            userId: mockUser.id,
            action: "ORDER_CREATED",
          });
        },
      );

      it.each([PatientClass.INPATIENT, PatientClass.OBSERVATION])(
        "should refuse a %s registration without the physician's order",
        async (patientClass) => {
          await expect(
            service.create({ ...mockCreatePatientDto, patientClass }, mockUser.id),
          ).rejects.toThrow(BadRequestException);
          expect(prismaService.patient.create).not.toHaveBeenCalled();
        },
      );

      it.each([PatientClass.EMERGENCY, PatientClass.OUTPATIENT])(
        "should register as %s without an order and refuse one",
        async (patientClass) => {
          (prismaService.patient.create as jest.Mock).mockResolvedValue(mockPatientSimple);
          await service.create({ ...mockCreatePatientDto, patientClass }, mockUser.id);
          const admission = (prismaService.patient.create as jest.Mock).mock.calls[0][0].data
            .admissions.create;
          expect(admission.patientClass).toBe(patientClass);
          expect(admission.orders).toBeUndefined();

          await expect(
            service.create(
              { ...mockCreatePatientDto, patientClass, registrationOrder: "Admit to ward" },
              mockUser.id,
            ),
          ).rejects.toThrow("No order is entered when registering a patient as");
        },
      );

      it("should reject an empty registration order in the DTO", async () => {
        const dto = plainToInstance(CreatePatientDto, {
          firstName: "Juan",
          lastName: "Dela Cruz",
          physicianId: "7f1c0d6e-1b2a-4c3d-9e8f-0a1b2c3d4e5f",
          patientClass: "INPATIENT",
          registrationOrder: "   ",
        });
        const errors = await validate(dto);
        expect(errors.map((error) => error.property)).toContain("registrationOrder");
      });
    });

    describe("dischargeAdmission", () => {
      const admitted = {
        id: mockAdmissionId,
        dischargeDate: null,
        patientClass: PatientClass.INPATIENT,
      };

      beforeEach(() => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(admitted);
        (prismaService.patientAdmission.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(1);
      });

      it("should discharge once a discharge order exists", async () => {
        const result = await service.dischargeAdmission(mockAdmissionId, mockUser.id);

        expect(prismaService.physicianOrder.count).toHaveBeenCalledWith({
          where: { admissionId: mockAdmissionId, type: OrderType.DISCHARGE, active: true },
        });
        expect(prismaService.patientAdmission.updateMany).toHaveBeenCalledWith({
          where: { id: mockAdmissionId, dischargeDate: null },
          data: { dischargeDate: expect.any(Date) },
        });
        expect(result.dischargeDate).toBeInstanceOf(Date);
      });

      it.each([PatientClass.INPATIENT, PatientClass.OBSERVATION, PatientClass.EMERGENCY])(
        "should refuse to discharge a %s patient without a discharge order",
        async (patientClass) => {
          (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
            ...admitted,
            patientClass,
          });
          (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(0);

          await expect(service.dischargeAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
            "A physician must write a discharge order before the patient can be discharged",
          );
          expect(prismaService.patientAdmission.updateMany).not.toHaveBeenCalled();
        },
      );

      it("should end an outpatient visit without a discharge order", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
          ...admitted,
          patientClass: PatientClass.OUTPATIENT,
        });
        (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(0);

        await service.dischargeAdmission(mockAdmissionId, mockUser.id);

        expect(prismaService.physicianOrder.count).not.toHaveBeenCalled();
        expect(prismaService.patientAdmission.updateMany).toHaveBeenCalled();
      });

      it("should refuse to discharge twice", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
          ...admitted,
          dischargeDate: new Date(),
        });

        await expect(service.dischargeAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
          ConflictException,
        );
      });

      it("should refuse when another nurse discharged first", async () => {
        (prismaService.patientAdmission.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

        await expect(service.dischargeAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
          ConflictException,
        );
      });
    });

    describe("class changes", () => {
      const visit = (patientClass: PatientClass) => ({
        id: mockAdmissionId,
        dischargeDate: null,
        patientClass,
      });

      beforeEach(() => {
        (prismaService.patientAdmission.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(1);
      });

      it.each([PatientClass.EMERGENCY, PatientClass.OUTPATIENT, PatientClass.OBSERVATION])(
        "should admit a %s patient once an admission order exists",
        async (from) => {
          (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(visit(from));

          const result = await service.admitAdmission(mockAdmissionId, mockUser.id);

          expect(prismaService.physicianOrder.count).toHaveBeenCalledWith({
            where: { admissionId: mockAdmissionId, type: OrderType.ADMISSION, active: true },
          });
          expect(prismaService.patientAdmission.updateMany).toHaveBeenCalledWith({
            where: { id: mockAdmissionId, patientClass: from, dischargeDate: null },
            data: { patientClass: PatientClass.INPATIENT, classSince: expect.any(Date) },
          });
          expect(result.patientClass).toBe(PatientClass.INPATIENT);
        },
      );

      it.each([PatientClass.EMERGENCY, PatientClass.OUTPATIENT])(
        "should place a %s patient under observation once an observation order exists",
        async (from) => {
          (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(visit(from));

          await service.observeAdmission(mockAdmissionId, mockUser.id);

          expect(prismaService.physicianOrder.count).toHaveBeenCalledWith({
            where: { admissionId: mockAdmissionId, type: OrderType.OBSERVATION, active: true },
          });
          expect(prismaService.patientAdmission.updateMany).toHaveBeenCalledWith({
            where: { id: mockAdmissionId, patientClass: from, dischargeDate: null },
            data: { patientClass: PatientClass.OBSERVATION, classSince: expect.any(Date) },
          });
        },
      );

      it("should refuse to admit without an admission order", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(
          visit(PatientClass.EMERGENCY),
        );
        (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(0);

        await expect(service.admitAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
          "A physician must write an admission order first",
        );
        expect(prismaService.patientAdmission.updateMany).not.toHaveBeenCalled();
      });

      it("should refuse to admit an already admitted patient", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(
          visit(PatientClass.INPATIENT),
        );

        await expect(service.admitAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
          "This patient is already admitted",
        );
      });

      it("should never move an inpatient back to observation", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(
          visit(PatientClass.INPATIENT),
        );

        await expect(service.observeAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
          "A patient who is admitted cannot be placed under observation",
        );
      });

      it("should refuse to change a discharged patient", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
          ...visit(PatientClass.EMERGENCY),
          dischargeDate: new Date(),
        });

        await expect(service.admitAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
          "This patient is already discharged",
        );
      });

      it("should refuse when another nurse changed the class first", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(
          visit(PatientClass.EMERGENCY),
        );
        (prismaService.patientAdmission.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

        await expect(service.admitAdmission(mockAdmissionId, mockUser.id)).rejects.toThrow(
          ConflictException,
        );
      });
    });

    describe("addConsultingPhysician", () => {
      const activeAdmission = {
        dischargeDate: null,
        physicianId: "physician-123",
        additionalPhysicians: [{ physicianId: "physician-2" }],
      };

      it("should add a consulting physician to an active admission", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(activeAdmission);
        (prismaService.user.findFirst as jest.Mock).mockResolvedValue({ id: "physician-3" });
        const created = { physician: { id: "physician-3", firstName: "Ana", lastName: "Reyes" } };
        (prismaService.admissionPhysician.create as jest.Mock).mockResolvedValue(created);

        const result = await service.addConsultingPhysician(mockAdmissionId, "physician-3", mockUser.id);

        expect(prismaService.admissionPhysician.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { admissionId: mockAdmissionId, physicianId: "physician-3" },
          }),
        );
        expect(auditLogService.record).toHaveBeenCalledWith({
          userId: mockUser.id,
          action: "PATIENT_UPDATED",
        });
        expect(result).toEqual(created);
      });

      it("should reject discharged admissions", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
          ...activeAdmission,
          dischargeDate: new Date(),
        });

        await expect(
          service.addConsultingPhysician(mockAdmissionId, "physician-3", mockUser.id),
        ).rejects.toThrow("Cannot add physicians to a discharged patient");
        expect(prismaService.admissionPhysician.create).not.toHaveBeenCalled();
      });

      it("should reject physicians already on the care team", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(activeAdmission);

        await expect(
          service.addConsultingPhysician(mockAdmissionId, "physician-2", mockUser.id),
        ).rejects.toThrow("This physician is already on the care team");
        await expect(
          service.addConsultingPhysician(mockAdmissionId, "physician-123", mockUser.id),
        ).rejects.toThrow("This physician is already on the care team");
      });

      it("should throw when the admission does not exist", async () => {
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          service.addConsultingPhysician(mockAdmissionId, "physician-3", mockUser.id),
        ).rejects.toThrow("Admission not found");
      });
    });

    describe("findAssignedTo", () => {
      it("should return patients assigned to the user", async () => {
        (prismaService.patient.findMany as jest.Mock).mockResolvedValue([
          mockPatient,
        ]);

        const result = await service.findAssignedTo(mockUser.id, Role.PHYSICIAN);

        const physicianScope = {
          OR: [
            { physicianId: mockUser.id },
            { additionalPhysicians: { some: { physicianId: mockUser.id } } },
          ],
        };
        expect(prismaService.patient.findMany).toHaveBeenCalledWith({
          where: {
            admissions: { some: physicianScope },
          },
          include: {
            admissions: {
              where: physicianScope,
              orderBy: { admissionDate: "desc" },
              select: {
                id: true,
                admissionDate: true,
                dischargeDate: true,
                patientClass: true,
                classSince: true,
                initialAssessment: true,
                // Physicians read the full triage assessment, not just the level.
                triage: expect.objectContaining({
                  select: expect.objectContaining({
                    triageLevel: true,
                    heartRate: true,
                    bpSystolic: true,
                    recordedBy: { select: { firstName: true, lastName: true } },
                  }),
                }),
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        });
        expect(result).toEqual([mockPatient]);
      });

      it("should return empty array when no patients assigned", async () => {
        (prismaService.patient.findMany as jest.Mock).mockResolvedValue([]);

        const result = await service.findAssignedTo(mockUser.id, Role.PHYSICIAN);

        expect(result).toEqual([]);
      });

      it("should return all admitted patients for a nurse", async () => {
        (prismaService.patient.findMany as jest.Mock).mockResolvedValue([
          mockPatient,
        ]);

        const result = await service.findAssignedTo(mockUser.id, Role.NURSE);

        expect(prismaService.patient.findMany).toHaveBeenCalledWith({
          where: { admissions: { some: {} } },
          include: {
            admissions: {
              orderBy: { admissionDate: "desc" },
              select: {
                id: true,
                admissionDate: true,
                dischargeDate: true,
                patientClass: true,
                classSince: true,
                initialAssessment: true,
                physician: { select: { firstName: true, lastName: true } },
                additionalPhysicians: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    physician: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
                triage: expect.objectContaining({
                  select: expect.objectContaining({ heartRate: true, bpSystolic: true }),
                }),
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        });
        expect(result).toEqual([mockPatient]);
      });
    });

    describe("findOne", () => {
      it("should return a patient by id with related data", async () => {
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(
          mockPatient,
        );

        const result = await service.findOne(mockPatientId);

        expect(prismaService.patient.findUnique).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          include: {
            admissions: {
              include: {
                orders: { orderBy: { dateCreated: "desc" }, take: 20 },
              },
            },
            notes: { orderBy: { createdAt: "desc" }, take: 20 },
            coursesInWard: { orderBy: { summaryDate: "desc" }, take: 10 },
          },
        });
        expect(result).toEqual(mockPatient);
      });

      it("should throw NotFoundException when patient not found", async () => {
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(service.findOne(mockPatientId)).rejects.toThrow(
          "Patient not found",
        );

        expect(prismaService.patient.findUnique).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          include: {
            admissions: {
              include: {
                orders: { orderBy: { dateCreated: "desc" }, take: 20 },
              },
            },
            notes: { orderBy: { createdAt: "desc" }, take: 20 },
            coursesInWard: { orderBy: { summaryDate: "desc" }, take: 10 },
          },
        });
      });
    });

    describe("update", () => {
      it("should update a patient", async () => {
        const updatedPatient = { ...mockPatientSimple, gender: Sex.FEMALE };
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(
          mockPatient,
        );
        (prismaService.patient.update as jest.Mock).mockResolvedValue(
          updatedPatient,
        );

        const result = await service.update(
          mockPatientId,
          mockUpdatePatientDto,
          mockUser.id,
        );

        expect(prismaService.patient.findUnique).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          include: {
            admissions: {
              include: {
                orders: { orderBy: { dateCreated: "desc" }, take: 20 },
              },
            },
            notes: { orderBy: { createdAt: "desc" }, take: 20 },
            coursesInWard: { orderBy: { summaryDate: "desc" }, take: 10 },
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
          action: "PATIENT_UPDATED",
        });
        expect(result).toEqual(updatedPatient);
      });

      it("should update patient without dateOfBirth", async () => {
        const dtoWithoutDob = {
          ...mockUpdatePatientDto,
          dateOfBirth: undefined,
        };
        const updatedPatient = { ...mockPatientSimple, dateOfBirth: null };
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(
          mockPatient,
        );
        (prismaService.patient.update as jest.Mock).mockResolvedValue(
          updatedPatient,
        );

        const result = await service.update(
          mockPatientId,
          dtoWithoutDob,
          mockUser.id,
        );

        expect(prismaService.patient.update).toHaveBeenCalledWith({
          where: { id: mockPatientId },
          data: {
            gender: dtoWithoutDob.gender,
            dateOfBirth: undefined,
          },
        });
        expect(result.dateOfBirth).toBeNull();
      });

      it("should throw NotFoundException when updating non-existent patient", async () => {
        (prismaService.patient.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          service.update(mockPatientId, mockUpdatePatientDto, mockUser.id),
        ).rejects.toThrow("Patient not found");

        expect(prismaService.patient.update).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });
    });
  });

  // ============ CONTROLLER TESTS ============
  describe("PatientsController", () => {
    describe("create", () => {
      it("should call service.create with correct params", async () => {
        jest.spyOn(service, "create").mockResolvedValue(mockPatientSimple);

        const result = await controller.create(mockCreatePatientDto, mockUser);

        expect(service.create).toHaveBeenCalledWith(
          mockCreatePatientDto,
          mockUser.id,
        );
        expect(result).toEqual(mockPatientSimple);
      });
    });

    describe("findAll", () => {
      it("should return the correct patient list for the current user role", async () => {
        jest.spyOn(service, "findAssignedTo").mockResolvedValue([mockPatient]);

        const result = await controller.findAll(mockUser);

        expect(service.findAssignedTo).toHaveBeenCalledWith(
          mockUser.id,
          mockUser.role,
        );
        expect(result).toEqual([mockPatient]);
      });
    });

    describe("findAssignedToMe", () => {
      it("should call service.findAssignedTo with user id", async () => {
        jest.spyOn(service, "findAssignedTo").mockResolvedValue([mockPatient]);

        const result = await controller.findAssignedToMe(mockUser);

        expect(service.findAssignedTo).toHaveBeenCalledWith(
          mockUser.id,
          mockUser.role,
        );
        expect(result).toEqual([mockPatient]);
      });
    });

    describe("findOne", () => {
      it("should call service.findOne with patient id", async () => {
        jest.spyOn(service, "findOne").mockResolvedValue(mockPatient);

        const result = await controller.findOne(mockPatientId);

        expect(service.findOne).toHaveBeenCalledWith(mockPatientId);
        expect(result).toEqual(mockPatient);
      });
    });

    describe("update", () => {
      it("should call service.update with correct params", async () => {
        const updatedPatient = { ...mockPatientSimple, gender: Sex.FEMALE };
        jest.spyOn(service, "update").mockResolvedValue(updatedPatient);

        const result = await controller.update(
          mockPatientId,
          mockUpdatePatientDto,
          mockUser,
        );

        expect(service.update).toHaveBeenCalledWith(
          mockPatientId,
          mockUpdatePatientDto,
          mockUser.id,
        );
        expect(result).toEqual(updatedPatient);
      });
    });
  });
});
