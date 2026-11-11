// backend/src/unit-tests/claims.test.ts
import { Test, TestingModule } from "@nestjs/testing";
import { ClaimsController } from "../claims/claims.controller";
import { ClaimsService } from "../claims/claims.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType, PhilHealthCF4Status, Sex, SummaryStatus } from "@prisma/client";

const emptyContactDetails = {
  contactNumber: null,
  address: null,
  insurance: null,
  insuranceOther: null,
  religion: null,
  contactPersonName: null,
  contactPersonNumber: null,
  contactPersonAddress: null,
};

const mockPrismaService = {
  courseInWard: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  physicianOrder: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  summaryApprovalRequest: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;

const mockAuditLogService = {
  record: jest.fn(),
  patientName: jest.fn().mockResolvedValue('Juan Dela Cruz'),
  userLabel: jest.fn().mockResolvedValue('Ana Reyes (DOC001)'),
} as unknown as jest.Mocked<AuditLogService>;

const mockNotificationsService = {
  create: jest.fn(),
  notifyUsers: jest.fn().mockResolvedValue([]),
} as unknown as jest.Mocked<NotificationsService>;

const emptyStay = { missingDays: [], unrequestedDays: [], unapprovedDays: [], incompleteDays: [] };

describe("Claims Module", () => {
  let controller: ClaimsController;
  let service: ClaimsService;
  let prismaService: typeof mockPrismaService;
  let auditLogService: typeof mockAuditLogService;
  let notificationsService: typeof mockNotificationsService;

  const mockUser = {
    id: "user-123",
    userId: "CP-001",
    role: "CLAIMS_PROCESSOR",
  };

  const mockCourseInWardId = "course-789";
  const mockClaimId = "claim-456";

  const mockPatient = {
    id: "patient-123",
    firstName: "John",
    middleName: null,
    lastName: "Doe",
    gender: Sex.MALE,
    dateOfBirth: new Date("1990-01-01"),
    ...emptyContactDetails,
    createdAt: new Date(),
    updatedAt: new Date(),
    admissions: [
      {
        id: "adm-1",
        admissionDate: new Date(2026, 10, 1),
        dischargeDate: new Date(2026, 10, 6),
        physicianId: null,
        additionalPhysicians: [],
      },
    ],
  };
  const stillAdmitted = { ...mockPatient, admissions: [{ ...mockPatient.admissions[0], dischargeDate: null }] };

  const mockSummary = {
    id: mockCourseInWardId,
    patientId: "patient-123",
    validatorId: "physician-123",
    status: SummaryStatus.APPROVED,
    approvedStatus: true,
    summaryContent:
      "Patient diagnosed with pneumonia, treated with antibiotics",
    summaryDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    validatedAt: new Date(),
    philhealthCf4Status: PhilHealthCF4Status.PENDING,
    philhealthCf4DecidedAt: null,
    patient: mockPatient,
    orders: [],
  };

  const mockClaim = {
    id: mockClaimId,
    summaryId: mockCourseInWardId,
    physicianId: "physician-123",
    processorId: mockUser.id,
    status: "PENDING",
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
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<ClaimsController>(ClaimsController);
    service = module.get<ClaimsService>(ClaimsService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);
    notificationsService = module.get(NotificationsService);

    jest.clearAllMocks();
    // Interactive transactions run against the same mock client.
    (mockPrismaService.$transaction as jest.Mock).mockImplementation(
      (arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: unknown) => unknown)(mockPrismaService) : Promise.all(arg as unknown[]),
    );
    (mockPrismaService.summaryApprovalRequest.count as jest.Mock).mockResolvedValue(0);
    // The summary's admission lookup (discharge check) reads this by default.
    (mockPrismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue(mockSummary);
  });

  // ============ SERVICE TESTS ============
  describe("ClaimsService", () => {
    describe("createFromSummary", () => {
      it("should create a claim from a valid summary", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          requests: [],
          orders: [],
        });
        (
          prismaService.summaryApprovalRequest.create as jest.Mock
        ).mockResolvedValue(mockClaim);

        const result = await service.createFromSummary(
          mockCourseInWardId,
          mockUser.id,
        );

        expect(prismaService.courseInWard.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: mockCourseInWardId } }),
        );
        expect(
          prismaService.summaryApprovalRequest.create,
        ).toHaveBeenCalledWith({
          data: {
            summaryId: mockCourseInWardId,
            physicianId: mockSummary.validatorId,
            processorId: mockUser.id,
            status: "VALIDATED",
          },
        });
        expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
          userId: mockUser.id,
          action: "CLAIM_CREATED",
        }));
        expect(result).toEqual(mockClaim);
      });

      it("should throw NotFoundException when summary not found", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue(
          null,
        );

        await expect(
          service.createFromSummary(mockCourseInWardId, mockUser.id),
        ).rejects.toThrow("Course in the Ward summary not found");

        expect(
          prismaService.summaryApprovalRequest.create,
        ).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });

      it("should address an unapproved summary to the attending physician as PENDING", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          validatorId: null,
          status: SummaryStatus.DRAFT_AI,
          approvedStatus: null,
          requests: [],
          orders: [
            { orderedById: "physician-ordering", admission: { physicianId: "physician-attending" } },
          ],
        });
        (
          prismaService.summaryApprovalRequest.create as jest.Mock
        ).mockResolvedValue(mockClaim);

        await service.createFromSummary(mockCourseInWardId, mockUser.id);

        expect(
          prismaService.summaryApprovalRequest.create,
        ).toHaveBeenCalledWith({
          data: {
            summaryId: mockCourseInWardId,
            physicianId: "physician-attending",
            processorId: mockUser.id,
            status: "PENDING",
          },
        });
      });

      it("should throw BadRequestException when no physician can validate the summary", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          validatorId: null,
          requests: [],
          orders: [],
        });

        await expect(
          service.createFromSummary(mockCourseInWardId, mockUser.id),
        ).rejects.toThrow("Summary has no attending physician to validate it");

        expect(
          prismaService.summaryApprovalRequest.create,
        ).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });

      it("should refuse a claim while the patient is still admitted", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          patient: stillAdmitted,
          requests: [],
          orders: [],
        });

        await expect(
          service.createFromSummary(mockCourseInWardId, mockUser.id),
        ).rejects.toThrow("A claim can only be opened after the patient is discharged");
        expect(prismaService.summaryApprovalRequest.create).not.toHaveBeenCalled();
      });

      it("should throw ConflictException when the summary already has a claim", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          requests: [{ id: "claim-existing" }],
          orders: [],
        });

        await expect(
          service.createFromSummary(mockCourseInWardId, mockUser.id),
        ).rejects.toThrow("A claim already exists for this summary");

        expect(
          prismaService.summaryApprovalRequest.create,
        ).not.toHaveBeenCalled();
      });

      it("should not open a second claim when another request claimed the day first", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          requests: [],
          orders: [],
        });
        (prismaService.summaryApprovalRequest.count as jest.Mock).mockResolvedValue(1);

        await expect(
          service.createFromSummary(mockCourseInWardId, mockUser.id),
        ).rejects.toThrow("A claim already exists for this summary");

        expect(prismaService.$executeRaw).toHaveBeenCalled();
        expect(prismaService.summaryApprovalRequest.create).not.toHaveBeenCalled();
      });
    });

    describe("createForStay", () => {
      it("should open every day and ask the physician once for the whole stay", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockImplementation(
          ({ where }: { where: { id: string } }) => Promise.resolve({
            ...mockSummary,
            id: where.id,
            validatorId: null,
            status: SummaryStatus.DRAFT_AI,
            approvedStatus: null,
            requests: [],
            orders: [{ orderedById: "physician-1", admission: { physicianId: "physician-attending" } }],
          }),
        );
        (prismaService.summaryApprovalRequest.create as jest.Mock).mockImplementation(
          ({ data }: { data: { summaryId: string } }) => Promise.resolve({ ...mockClaim, id: `claim-${data.summaryId}` }),
        );

        const claims = await service.createForStay(["day-1", "day-2", "day-1"], mockUser.id);

        expect(claims).toHaveLength(2);
        expect(prismaService.summaryApprovalRequest.create).toHaveBeenCalledTimes(2);
        expect(notificationsService.create).toHaveBeenCalledTimes(1);
        expect(notificationsService.create).toHaveBeenCalledWith(expect.objectContaining({
          userId: "physician-attending",
          requestId: "claim-day-1",
        }));
      });

      it("should reject a stay whose every day is already claimed", async () => {
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({
          ...mockSummary,
          requests: [{ id: "claim-existing" }],
          orders: [],
        });

        await expect(service.createForStay(["day-1"], mockUser.id)).rejects.toThrow(
          "Every day of this stay already has a claim",
        );
        expect(notificationsService.create).not.toHaveBeenCalled();
      });
    });

    describe("findAll", () => {
      it("should return all claims with patient info", async () => {
        (
          prismaService.summaryApprovalRequest.findMany as jest.Mock
        ).mockResolvedValue([mockClaim]);

        const result = await service.findAll();

        expect(
          prismaService.summaryApprovalRequest.findMany,
        ).toHaveBeenCalledWith({
          orderBy: { requestedAt: "desc" },
          include: {
            summary: {
              include: {
                patient: true,
                orders: {
                  orderBy: { dateCreated: "desc" },
                  include: {
                    admission: {
                      select: {
                        id: true,
                        admissionDate: true,
                        dischargeDate: true,
                        patientClass: true,
                        initialAssessment: true,
                        medicalSurgicalHistory: true,
                        roomNumber: true,
                        wardName: true,
                        physician: { select: { firstName: true, lastName: true } },
                        room: { select: { number: true, ward: { select: { name: true } } } },
                        triage: expect.objectContaining({
                          select: expect.objectContaining({ triageLevel: true, heartRate: true }),
                        }),
                      },
                    },
                    orderedBy: { select: { firstName: true, lastName: true } },
                    executedBy: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        });
        expect(result).toEqual([{ ...mockClaim, stay: emptyStay }]);
      });

      it("should return empty array when no claims exist", async () => {
        (
          prismaService.summaryApprovalRequest.findMany as jest.Mock
        ).mockResolvedValue([]);

        const result = await service.findAll();

        expect(result).toEqual([]);
      });
    });

    describe("notifyPhysician", () => {
      // The service loads the claim with its patient + processor before it
      // updates the status and raises the notification.
      const claimWithRelations = {
        ...mockClaim,
        processor: { firstName: "Kristine", lastName: "Bautista" },
      };

      beforeEach(() => {
        (
          prismaService.summaryApprovalRequest.findUnique as jest.Mock
        ).mockResolvedValue(claimWithRelations);
      });

      it("should update status, notify the physician and log audit", async () => {
        const updatedClaim = {
          ...mockClaim,
          status: "PHYSICIAN_VALIDATION_REQUESTED",
        };
        (
          prismaService.summaryApprovalRequest.update as jest.Mock
        ).mockResolvedValue(updatedClaim);

        const result = await service.notifyPhysician(
          mockClaimId,
          mockUser.id,
          "Please re-check the dosage.",
        );

        expect(
          prismaService.summaryApprovalRequest.update,
        ).toHaveBeenCalledWith({
          where: { id: mockClaimId },
          data: { status: "PHYSICIAN_VALIDATION_REQUESTED" },
        });
        expect(notificationsService.create).toHaveBeenCalledWith({
          userId: mockClaim.physicianId,
          type: NotificationType.REVIEW_REQUESTED,
          title: "Review requested again",
          message: expect.stringContaining("Please re-check the dosage."),
          requestId: mockClaimId,
        });
        expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
          userId: mockUser.id,
          action: "CLAIM_PHYSICIAN_NOTIFIED",
        }));
        expect(result).toEqual(updatedClaim);
      });

      it("should notify without a message when the processor sends none", async () => {
        (
          prismaService.summaryApprovalRequest.update as jest.Mock
        ).mockResolvedValue(mockClaim);

        await service.notifyPhysician(mockClaimId, mockUser.id);

        expect(notificationsService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockClaim.physicianId,
            requestId: mockClaimId,
          }),
        );
      });

      it("should throw NotFoundException when claim id is unknown", async () => {
        (
          prismaService.summaryApprovalRequest.findUnique as jest.Mock
        ).mockResolvedValue(null);

        await expect(
          service.notifyPhysician("unknown-claim-id", mockUser.id),
        ).rejects.toThrow("Claim not found");

        expect(
          prismaService.summaryApprovalRequest.update,
        ).not.toHaveBeenCalled();
        expect(notificationsService.create).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });
    });

    describe("generateCf4", () => {
      it("should generate CF4 for approved claim", async () => {
        (
          prismaService.summaryApprovalRequest.findUnique as jest.Mock
        ).mockResolvedValue(mockClaim);
        const updatedClaim = {
          ...mockClaim,
          status: "CF4_GENERATED",
        };
        (
          prismaService.summaryApprovalRequest.update as jest.Mock
        ).mockResolvedValue(updatedClaim);

        const result = await service.generateCf4(mockClaimId, mockUser.id);

        expect(
          prismaService.summaryApprovalRequest.findUnique,
        ).toHaveBeenCalledWith({
          where: { id: mockClaimId },
          include: { summary: { include: { patient: true } } },
        });
        expect(
          prismaService.summaryApprovalRequest.update,
        ).toHaveBeenCalledWith({
          where: { id: mockClaimId },
          data: { status: "CF4_GENERATED" },
        });
        expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
          userId: mockUser.id,
          action: "CF4_GENERATED",
        }));
        expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
          [mockClaim.physicianId],
          expect.objectContaining({
            title: "CF4 generated",
            message: expect.stringContaining("John Doe"),
          }),
        );
        expect(result).toEqual({
          claim: updatedClaim,
          cf4Fields: {
            patientName: "John Doe",
            courseInTheWard: mockSummary.summaryContent,
          },
        });
      });

      it("should throw NotFoundException when claim not found", async () => {
        (
          prismaService.summaryApprovalRequest.findUnique as jest.Mock
        ).mockResolvedValue(null);

        await expect(
          service.generateCf4(mockClaimId, mockUser.id),
        ).rejects.toThrow("Claim not found");

        expect(
          prismaService.summaryApprovalRequest.update,
        ).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });

      it("should throw BadRequestException when summary not approved", async () => {
        (
          prismaService.summaryApprovalRequest.findUnique as jest.Mock
        ).mockResolvedValue({
          ...mockClaim,
          summary: { ...mockSummary, status: "PENDING", approvedStatus: false },
        });

        await expect(
          service.generateCf4(mockClaimId, mockUser.id),
        ).rejects.toThrow(
          "Course in the Ward must be physician-approved before CF4 can be generated",
        );

        expect(
          prismaService.summaryApprovalRequest.update,
        ).not.toHaveBeenCalled();
        expect(auditLogService.record).not.toHaveBeenCalled();
      });

      // One approved summary dated on the last day, holding orders from an
      // earlier day too, does not cover that earlier day.
      it("should refuse a CF4 while the patient is still admitted", async () => {
        (prismaService.summaryApprovalRequest.findUnique as jest.Mock).mockResolvedValue(mockClaim);
        (prismaService.courseInWard.findUnique as jest.Mock).mockResolvedValue({ ...mockSummary, patient: stillAdmitted });

        await expect(service.generateCf4(mockClaimId, mockUser.id)).rejects.toThrow(
          "CF4 can only be generated after the patient is discharged",
        );
        expect(prismaService.summaryApprovalRequest.update).not.toHaveBeenCalled();
      });

      it("should refuse a CF4 while a day of the stay has no summary of its own", async () => {
        (prismaService.summaryApprovalRequest.findUnique as jest.Mock).mockResolvedValue(mockClaim);
        (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue({ admissionId: "adm-1" });
        (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([
          { admissionId: "adm-1", dateCreated: new Date(2026, 10, 3, 9) },
          { admissionId: "adm-1", dateCreated: new Date(2026, 10, 5, 9) },
        ]);
        (prismaService.courseInWard.findMany as jest.Mock).mockResolvedValue([
          {
            summaryDate: new Date(2026, 10, 5),
            status: SummaryStatus.APPROVED,
            approvedStatus: true,
            requests: [{ id: mockClaimId }],
            orders: [{ admissionId: "adm-1" }, { admissionId: "adm-1" }],
          },
        ]);

        await expect(service.generateCf4(mockClaimId, mockUser.id)).rejects.toThrow(
          "no Course in the Ward for 2026-11-03",
        );
        expect(prismaService.summaryApprovalRequest.update).not.toHaveBeenCalled();

        (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(null);
        (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([]);
        (prismaService.courseInWard.findMany as jest.Mock).mockResolvedValue([]);
      });

      it("should refuse a CF4 while an approved day has an order finished after approval", async () => {
        (prismaService.summaryApprovalRequest.findUnique as jest.Mock).mockResolvedValue(mockClaim);
        (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue({ admissionId: "adm-1" });
        (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([
          { admissionId: "adm-1", dateCreated: new Date(2026, 10, 5, 9), summarizationId: "s-1" },
          { admissionId: "adm-1", dateCreated: new Date(2026, 10, 5, 15), summarizationId: null },
        ]);
        (prismaService.courseInWard.findMany as jest.Mock).mockResolvedValue([
          {
            summaryDate: new Date(2026, 10, 5),
            status: SummaryStatus.APPROVED,
            approvedStatus: true,
            requests: [{ id: mockClaimId }],
            orders: [{ admissionId: "adm-1" }],
          },
        ]);

        await expect(service.generateCf4(mockClaimId, mockUser.id)).rejects.toThrow(
          "an order missing from the approved summary for 2026-11-05",
        );
        expect(prismaService.summaryApprovalRequest.update).not.toHaveBeenCalled();

        (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(null);
        (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([]);
        (prismaService.courseInWard.findMany as jest.Mock).mockResolvedValue([]);
      });
    });
  });

  // ============ CONTROLLER TESTS ============
  describe("ClaimsController", () => {
    describe("create", () => {
      it("should call service.createFromSummary with correct params", async () => {
        const dto = { courseInWardId: mockCourseInWardId };
        jest.spyOn(service, "createFromSummary").mockResolvedValue(mockClaim);

        const result = await controller.create(dto, mockUser);

        expect(service.createFromSummary).toHaveBeenCalledWith(
          mockCourseInWardId,
          mockUser.id,
        );
        expect(result).toEqual(mockClaim);
      });
    });

    describe("findAll", () => {
      it("should call service.findAll", async () => {
        jest.spyOn(service, "findAll").mockResolvedValue([{ ...mockClaim, stay: emptyStay }]);

        const result = await controller.findAll();

        expect(service.findAll).toHaveBeenCalled();
        expect(result).toEqual([{ ...mockClaim, stay: emptyStay }]);
      });
    });

    describe("notifyPhysician", () => {
      it("should call service.notifyPhysician with correct params", async () => {
        const updatedClaim = {
          ...mockClaim,
          status: "PHYSICIAN_VALIDATION_REQUESTED",
        };
        jest.spyOn(service, "notifyPhysician").mockResolvedValue(updatedClaim);

        const result = await controller.notifyPhysician(
          mockClaimId,
          { message: "Please double-check the dosage." },
          mockUser,
        );

        expect(service.notifyPhysician).toHaveBeenCalledWith(
          mockClaimId,
          mockUser.id,
          "Please double-check the dosage.",
        );
        expect(result).toEqual(updatedClaim);
      });

      it("should forward an undefined message when the processor sends none", async () => {
        jest.spyOn(service, "notifyPhysician").mockResolvedValue(mockClaim);

        await controller.notifyPhysician(mockClaimId, {}, mockUser);

        expect(service.notifyPhysician).toHaveBeenCalledWith(
          mockClaimId,
          mockUser.id,
          undefined,
        );
      });
    });

    describe("generateCf4", () => {
      it("should call service.generateCf4 with correct params", async () => {
        const updatedClaim = {
          ...mockClaim,
          status: "CF4_GENERATED",
        };
        const cf4Result = {
          claim: updatedClaim,
          cf4Fields: {
            patientName: "John Doe",
            courseInTheWard: mockSummary.summaryContent,
          },
        };
        jest.spyOn(service, "generateCf4").mockResolvedValue(cf4Result);

        const result = await controller.generateCf4(mockClaimId, mockUser);

        expect(service.generateCf4).toHaveBeenCalledWith(
          mockClaimId,
          mockUser.id,
        );
        expect(result).toEqual(cf4Result);
      });
    });
  });
});
