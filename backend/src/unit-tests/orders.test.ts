// backend/src/unit-tests/orders.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderEnteredBy, OrderStatus, OrderType, PatientClass, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from '../orders/dto/create-order.dto';

const mockPrismaService = {
  physicianOrder: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn(),
  },
  patientAdmission: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  room: {
    findUnique: jest.fn(),
  },
  courseInWard: {
    findFirst: jest.fn(),
  },
  ward: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;
// Room transactions run their callback against the same mocks.
(mockPrismaService.$transaction as jest.Mock).mockImplementation((fn: any) => fn(mockPrismaService));

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:8000'),
} as unknown as jest.Mocked<ConfigService>;

const orderInclude = {
  orderedBy: { select: { firstName: true, lastName: true } },
  encodedBy: { select: { firstName: true, lastName: true, role: true } },
  executedBy: { select: { firstName: true, lastName: true } },
  transferRoom: { select: { number: true, ward: { select: { name: true } } } },
};

const openAdmission = {
  dischargeDate: null,
  patientClass: PatientClass.INPATIENT,
  physicianId: 'doctor-123',
  additionalPhysicians: [{ physicianId: 'doctor-456' }],
};

const mockAuditLogService = {
  record: jest.fn(),
  patientName: jest.fn().mockResolvedValue('Juan Dela Cruz'),
  userLabel: jest.fn().mockResolvedValue('Ana Reyes (DOC001)'),
} as unknown as jest.Mocked<AuditLogService>;

const mockNotificationsService = {
  create: jest.fn(),
  notifyUsers: jest.fn().mockResolvedValue([]),
  notifyNursesInWard: jest.fn().mockResolvedValue([]),
} as unknown as jest.Mocked<NotificationsService>;

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: typeof mockPrismaService;
  let auditLogService: typeof mockAuditLogService;

  const mockOrder = {
    id: 'order-123',
    admissionId: 'admission-123',
    orderedById: 'doctor-123',
    encodedById: 'nurse-123',
    enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
    orderContent: 'Administer 500mg paracetamol',
    status: OrderStatus.TO_ACCOMPLISH,
    dateCreated: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);

    jest.clearAllMocks();
    // Embedding is best-effort and fire-and-forget; keep it off the network.
    jest.spyOn(service as any, 'persistOrderEmbedding').mockResolvedValue(undefined);
    (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(openAdmission);
    (prismaService.ward.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
      firstName: 'Angela',
      lastName: 'Reyes',
      isActive: true,
    });
  });

  describe('create', () => {
    const dto: CreateOrderDto = {
      admissionId: 'admission-123',
      orderedById: 'doctor-123',
      orderContent: 'Administer 500mg paracetamol',
    } as CreateOrderDto;

    it('should flag order as NURSE_ON_BEHALF when entered by a nurse', async () => {
      (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.create(dto, 'nurse-123', Role.NURSE);

      expect(prismaService.physicianOrder.create).toHaveBeenCalledWith({
        data: {
          admissionId: dto.admissionId,
          orderedById: dto.orderedById,
          encodedById: 'nurse-123',
          enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
          orderContent: dto.orderContent,
          type: OrderType.DEFAULT,
          communicationChannel: null,
        },
        include: orderInclude,
      });
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'nurse-123',
        action: 'ORDER_CREATED',
      }));
      expect(result).toEqual(mockOrder);
    });

    it('stores how a nurse received the order in communicationChannel, not the order text', async () => {
      (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);

      await service.create({ ...dto, communicationChannel: 'SMS' } as CreateOrderDto, 'nurse-123', Role.NURSE);

      expect(prismaService.physicianOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orderContent: dto.orderContent, communicationChannel: 'SMS' }),
        }),
      );
    });

    it('rejects an order entered on behalf of a deactivated physician', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({ isActive: false });

      await expect(service.create(dto, 'nurse-123', Role.NURSE)).rejects.toThrow(/deactivated/);
      expect(prismaService.physicianOrder.create).not.toHaveBeenCalled();
    });

    it('should flag order as PHYSICIAN when entered by a physician', async () => {
      (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);

      await service.create(dto, 'doctor-123', Role.PHYSICIAN);

      expect(prismaService.physicianOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            encodedById: 'doctor-123',
            enteredByRole: OrderEnteredBy.PHYSICIAN,
          }),
        }),
      );
    });

    it('should flag order as PHYSICIAN for any non-nurse role (e.g. ADMIN)', async () => {
      (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);

      await service.create(dto, 'admin-123', Role.ADMIN);

      expect(prismaService.physicianOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enteredByRole: OrderEnteredBy.PHYSICIAN,
          }),
        }),
      );
    });

    it('should attribute the order to the submitting physician when orderedById is omitted', async () => {
      (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);

      await service.create(
        { admissionId: 'admission-123', orderContent: 'CBC tomorrow AM' } as CreateOrderDto,
        'doctor-456',
        Role.PHYSICIAN,
      );

      expect(prismaService.physicianOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orderedById: 'doctor-456', encodedById: 'doctor-456' }),
        }),
      );
    });

    it('should reject a physician who is not on the care team', async () => {
      await expect(service.create(dto, 'doctor-999', Role.PHYSICIAN)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaService.physicianOrder.create).not.toHaveBeenCalled();
    });

    it('should reject a nurse order without an ordering physician', async () => {
      await expect(
        service.create(
          { admissionId: 'admission-123', orderContent: 'CBC' } as CreateOrderDto,
          'nurse-123',
          Role.NURSE,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject an ordering physician outside the care team', async () => {
      await expect(
        service.create({ ...dto, orderedById: 'doctor-999' }, 'nurse-123', Role.NURSE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject orders on a missing admission', async () => {
      (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(dto, 'doctor-123', Role.PHYSICIAN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject orders on a discharged admission', async () => {
      (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
        ...openAdmission,
        dischargeDate: new Date(),
      });

      await expect(service.create(dto, 'doctor-123', Role.PHYSICIAN)).rejects.toThrow(
        'Cannot add orders to a discharged admission',
      );
      expect(prismaService.physicianOrder.create).not.toHaveBeenCalled();
    });

    describe('order types', () => {
      const erAdmission = { ...openAdmission, patientClass: PatientClass.EMERGENCY };

      beforeEach(() => {
        (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(0);
        (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);
        (prismaService.patientAdmission.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      });

      it('should not check discharge rules for a general order', async () => {
        await service.create(dto, 'doctor-123', Role.PHYSICIAN);

        expect(prismaService.physicianOrder.count).not.toHaveBeenCalled();
        expect(prismaService.patientAdmission.updateMany).not.toHaveBeenCalled();
      });

      it.each([OrderType.ADMISSION, OrderType.OBSERVATION])(
        'should refuse a new %s order in the DTO',
        async (type) => {
          const errors = await validate(
            plainToInstance(CreateOrderDto, {
              admissionId: '7f1c0d6e-1b2a-4c3d-9e8f-0a1b2c3d4e5f',
              orderContent: 'Admit to ward',
              type,
            }),
          );
          expect(errors.map((error) => error.property)).toContain('type');
        },
      );

      it('should allow a discharge order for admitted and ER patients alike', async () => {
        await service.create({ ...dto, type: OrderType.DISCHARGE }, 'doctor-123', Role.PHYSICIAN);
        (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(erAdmission);
        await service.create({ ...dto, type: OrderType.DISCHARGE }, 'doctor-123', Role.PHYSICIAN);

        expect(prismaService.physicianOrder.create).toHaveBeenCalledTimes(2);
        expect(prismaService.patientAdmission.updateMany).not.toHaveBeenCalled();
      });

      it('should reject a second discharge order', async () => {
        (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(1);

        await expect(
          service.create({ ...dto, type: OrderType.DISCHARGE }, 'doctor-123', Role.PHYSICIAN),
        ).rejects.toThrow('This patient already has a discharge order');
      });

      it('should reject a discharge order from a consulting physician', async () => {
        const { orderedById: _omit, ...ownOrder } = dto;
        await expect(
          service.create({ ...ownOrder, type: OrderType.DISCHARGE }, 'doctor-456', Role.PHYSICIAN),
        ).rejects.toThrow('Only the attending physician can write a discharge order');
        // Naming the attending as the ordering physician does not get around it.
        await expect(
          service.create({ ...dto, type: OrderType.DISCHARGE }, 'doctor-456', Role.PHYSICIAN),
        ).rejects.toThrow('Only the attending physician can write a discharge order');
        expect(prismaService.physicianOrder.create).not.toHaveBeenCalled();
      });

      it('should reject a nurse entering a discharge order on a consultant’s behalf', async () => {
        await expect(
          service.create(
            { ...dto, type: OrderType.DISCHARGE, orderedById: 'doctor-456' },
            'nurse-1',
            Role.NURSE,
          ),
        ).rejects.toThrow('Only the attending physician can write a discharge order');
      });

      it('should still let a consulting physician write a general order', async () => {
        await service.create(dto, 'doctor-456', Role.PHYSICIAN);
        expect(prismaService.physicianOrder.create).toHaveBeenCalled();
      });

      it('should only count active discharge orders', async () => {
        await service.create({ ...dto, type: OrderType.DISCHARGE }, 'doctor-123', Role.PHYSICIAN);

        expect(prismaService.physicianOrder.count).toHaveBeenCalledWith({
          where: { admissionId: dto.admissionId, active: true, type: OrderType.DISCHARGE },
        });
      });
    });

    it('should record an audit log entry after creating the order', async () => {
      (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);

      await service.create(dto, 'doctor-123', Role.PHYSICIAN);

      expect(auditLogService.record).toHaveBeenCalledTimes(1);
    });
  });

  describe('findForPatient', () => {
    it('should query orders for a patient, newest first, with names/role included', async () => {
      (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([mockOrder]);

      const result = await service.findForPatient('patient-123');

      expect(prismaService.physicianOrder.findMany).toHaveBeenCalledWith({
        where: { admission: { patientId: 'patient-123' } },
        orderBy: { dateCreated: 'desc' },
        include: orderInclude,
      });
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findTodaysOrders', () => {
    it('should query orders from start of today, oldest first', async () => {
      (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([mockOrder]);

      await service.findTodaysOrders('patient-123');

      expect(prismaService.physicianOrder.findMany).toHaveBeenCalledWith({
        where: {
          admission: { patientId: 'patient-123' },
          dateCreated: { gte: expect.any(Date), lt: expect.any(Date) },
          status: OrderStatus.FINISHED,
        },
        orderBy: { dateCreated: 'asc' },
        include: {
          admission: { select: { id: true, admissionDate: true } },
          summary: { select: { status: true } },
        },
      });
    });

    it('should use midnight (00:00:00.000) of the current day as the lower bound', async () => {
      (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([]);

      await service.findTodaysOrders('patient-123');

      const callArg = (prismaService.physicianOrder.findMany as jest.Mock).mock.calls[0][0];
      const gte: Date = callArg.where.dateCreated.gte;

      expect(gte.getHours()).toBe(0);
      expect(gte.getMinutes()).toBe(0);
      expect(gte.getSeconds()).toBe(0);
      expect(gte.getMilliseconds()).toBe(0);
    });
  });

  describe('updateStatus', () => {
    it('should stamp the nurse and time when an order is carried out', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue(mockOrder);

      await service.updateStatus(
        'order-123',
        { status: OrderStatus.FINISHED, nurseComment: '  Given at 08:00  ' },
        'nurse-123',
      );

      expect(prismaService.physicianOrder.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-123', active: true },
      });
      const { data } = (prismaService.physicianOrder.update as jest.Mock).mock.calls[0][0];
      expect(data).toEqual({
        status: OrderStatus.FINISHED,
        nurseComment: 'Given at 08:00',
        executedById: 'nurse-123',
        executedAt: expect.any(Date),
      });
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'nurse-123',
        action: 'ORDER_STATUS_UPDATED',
      }));
    });

    it.each([
      [OrderStatus.ONGOING, OrderStatus.TO_ACCOMPLISH],
      [OrderStatus.FINISHED, OrderStatus.TO_ACCOMPLISH],
      [OrderStatus.FINISHED, OrderStatus.ONGOING],
    ])('should refuse to move an order from %s back to %s', async (current, next) => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue({ ...mockOrder, status: current });

      await expect(service.updateStatus('order-123', { status: next }, 'nurse-123')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.physicianOrder.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('should notify the attending physician when an order finishes after its day was summarized', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue(mockOrder);
      (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
        patientId: 'patient-123',
        physicianId: 'doctor-789',
        additionalPhysicians: [],
        patient: { firstName: 'Juan', lastName: 'Cruz' },
      });
      (prismaService.courseInWard.findFirst as jest.Mock).mockResolvedValue({ id: 'summary-1' });

      await service.updateStatus('order-123', { status: OrderStatus.FINISHED }, 'nurse-123');

      expect(prismaService.courseInWard.findFirst).toHaveBeenCalledWith({
        where: { patientId: 'patient-123', summaryDate: { gte: expect.any(Date), lt: expect.any(Date) } },
        select: { id: true },
      });
      expect(mockNotificationsService.notifyUsers).toHaveBeenCalledWith(
        ['doctor-789', 'doctor-123'],
        expect.objectContaining({
          title: 'Order accomplished after summary',
          message: expect.stringContaining(
            '**Angela Reyes** accomplished an order for **Juan Dela Cruz**',
          ),
          patientId: 'patient-123',
        }),
      );
    });

    it('should notify the care team when an order is finished before a summary exists', async () => {
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue(mockOrder);
      (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
        patientId: 'patient-123',
        physicianId: 'doctor-789',
        additionalPhysicians: [],
        patient: { firstName: 'Juan', lastName: 'Cruz' },
      });
      (prismaService.courseInWard.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      await service.updateStatus('order-123', { status: OrderStatus.FINISHED }, 'nurse-123');

      expect(mockNotificationsService.notifyUsers).toHaveBeenCalledWith(
        ['doctor-789', 'doctor-123'],
        {
          title: 'Order accomplished',
          message: '**Angela Reyes** accomplished an order for **Juan Dela Cruz**.',
          patientId: 'patient-123',
        },
      );
    });

    it('should keep the executor stamp when only the note changes', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.FINISHED,
      });
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue(mockOrder);

      await service.updateStatus(
        'order-123',
        { status: OrderStatus.FINISHED, nurseComment: 'Patient tolerated well' },
        'nurse-456',
      );

      const { data } = (prismaService.physicianOrder.update as jest.Mock).mock.calls[0][0];
      expect(data).toEqual({ status: OrderStatus.FINISHED, nurseComment: 'Patient tolerated well' });
    });

    it('should refuse to edit a finished order whose note was already submitted', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.FINISHED,
        nurseComment: 'Given at 08:00',
      });

      await expect(
        service.updateStatus(
          'order-123',
          { status: OrderStatus.FINISHED, nurseComment: 'Changed my mind' },
          'nurse-123',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.physicianOrder.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('should store an empty comment as null', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue(mockOrder);

      await service.updateStatus('order-123', { status: OrderStatus.ONGOING, nurseComment: '   ' }, 'nurse-123');

      const { data } = (prismaService.physicianOrder.update as jest.Mock).mock.calls[0][0];
      expect(data.nurseComment).toBeNull();
      expect(mockNotificationsService.notifyUsers).toHaveBeenCalledWith(
        ['doctor-123', 'doctor-456'],
        {
          title: 'Order started',
          message: '**Angela Reyes** started an order for **Juan Dela Cruz**.',
          patientId: undefined,
        },
      );
    });

    it('should discharge the patient when the discharge order is finished with a note and earlier orders are done', async () => {
      const dischargeOrder = {
        ...mockOrder,
        type: OrderType.DISCHARGE,
        dateCreated: new Date('2026-03-02T08:00:00'),
      };
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(dischargeOrder);
      (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(0);
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue({
        ...dischargeOrder,
        status: OrderStatus.FINISHED,
        nurseComment: 'Sent home with instructions',
      });
      (prismaService.patientAdmission.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.updateStatus(
        'order-123',
        { status: OrderStatus.FINISHED, nurseComment: 'Sent home with instructions' },
        'nurse-123',
      );

      expect(prismaService.physicianOrder.count).toHaveBeenCalledWith({
        where: {
          admissionId: 'admission-123',
          active: true,
          id: { not: 'order-123' },
          dateCreated: { lte: dischargeOrder.dateCreated },
          status: { not: OrderStatus.FINISHED },
        },
      });
      expect(prismaService.patientAdmission.updateMany).toHaveBeenCalledWith({
        where: { id: 'admission-123', dischargeDate: null },
        data: { dischargeDate: expect.any(Date) },
      });
    });

    it('should refuse to finish a discharge order while an earlier order is still open', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        type: OrderType.DISCHARGE,
      });
      (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.updateStatus(
          'order-123',
          { status: OrderStatus.FINISHED, nurseComment: 'Ready to go' },
          'nurse-123',
        ),
      ).rejects.toThrow(
        'Finish every order written before the discharge order before this patient can be discharged',
      );
      expect(prismaService.physicianOrder.update).not.toHaveBeenCalled();
      expect(prismaService.patientAdmission.updateMany).not.toHaveBeenCalled();
    });

    it('should refuse to finish a discharge order without a note', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        type: OrderType.DISCHARGE,
      });

      await expect(
        service.updateStatus('order-123', { status: OrderStatus.FINISHED, nurseComment: '  ' }, 'nurse-123'),
      ).rejects.toThrow('Add a note before marking the discharge order done');
      expect(prismaService.physicianOrder.count).not.toHaveBeenCalled();
      expect(prismaService.physicianOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for a missing or inactive order', async () => {
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', { status: OrderStatus.FINISHED }, 'nurse-123'),
      ).rejects.toThrow(NotFoundException);
      expect(prismaService.physicianOrder.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('transfer orders', () => {
    const surgery305 = {
      id: 'room-305',
      number: '305',
      isActive: true,
      ward: { id: 'ward-surgery', name: 'Surgery' },
      admissions: [],
      transferOrders: [],
    };
    const transferDto: CreateOrderDto = {
      admissionId: 'admission-123',
      orderContent: 'Needs post-op monitoring',
      type: OrderType.TRANSFER,
      transferRoomNumber: '305',
    };

    beforeEach(() => {
      (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
        ...openAdmission,
        patientId: 'patient-123',
        room: { wardId: 'ward-coronary', number: '210', ward: { id: 'ward-coronary', name: 'Coronary' } },
      });
      (prismaService.physicianOrder.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.physicianOrder.create as jest.Mock).mockResolvedValue(mockOrder);
      (prismaService.room.findUnique as jest.Mock).mockResolvedValue(surgery305);
      // No discharge order yet (earlier tests leave their own count behind).
      (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(0);
    });

    it('should reserve the room and name it in the order text when the attending orders it', async () => {
      await service.create(transferDto, 'doctor-123', Role.PHYSICIAN);

      // The previous pending transfer is retired, freeing its room.
      expect(prismaService.physicianOrder.updateMany).toHaveBeenCalledWith({
        where: {
          admissionId: 'admission-123',
          type: OrderType.TRANSFER,
          active: true,
          status: { not: OrderStatus.FINISHED },
        },
        data: { active: false },
      });
      expect(prismaService.physicianOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: OrderType.TRANSFER,
          transferRoomId: 'room-305',
          orderContent: 'Transfer to room 305 (Surgery). Needs post-op monitoring',
        }),
        include: orderInclude,
      });
    });

    it('should let a nurse enter it on the attending physician\'s behalf', async () => {
      await service.create({ ...transferDto, orderedById: 'doctor-123' }, 'nurse-123', Role.NURSE);
      expect(prismaService.physicianOrder.create).toHaveBeenCalled();
    });

    it.each([
      ['a consulting physician', { ...transferDto }, 'doctor-456', Role.PHYSICIAN],
      ['a nurse on a consultant\'s behalf', { ...transferDto, orderedById: 'doctor-456' }, 'nurse-123', Role.NURSE],
    ])('should refuse a transfer from %s', async (_label, body, userId, role) => {
      await expect(service.create(body, userId, role)).rejects.toThrow(ForbiddenException);
      expect(prismaService.physicianOrder.create).not.toHaveBeenCalled();
    });

    it('should refuse a room reserved by another patient\'s transfer', async () => {
      (prismaService.room.findUnique as jest.Mock).mockResolvedValue({
        ...surgery305,
        transferOrders: [{ id: 'order-9' }],
      });

      await expect(service.create(transferDto, 'doctor-123', Role.PHYSICIAN)).rejects.toThrow(
        'Room 305 is reserved for a pending transfer',
      );
      expect(prismaService.physicianOrder.create).not.toHaveBeenCalled();
    });

    it('should refuse the room the patient is already in, and a patient who is not admitted', async () => {
      await expect(
        service.create({ ...transferDto, transferRoomNumber: '210' }, 'doctor-123', Role.PHYSICIAN),
      ).rejects.toThrow('The patient is already in room 210');

      (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue({
        ...openAdmission,
        patientClass: PatientClass.OBSERVATION,
        room: null,
      });
      await expect(service.create(transferDto, 'doctor-123', Role.PHYSICIAN)).rejects.toThrow(
        'Only an admitted patient can be transferred',
      );
    });

    it('should refuse a transfer without a room, and a room on another order type', async () => {
      await expect(
        service.create({ ...transferDto, transferRoomNumber: undefined }, 'doctor-123', Role.PHYSICIAN),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ ...transferDto, type: OrderType.DEFAULT }, 'doctor-123', Role.PHYSICIAN),
      ).rejects.toThrow('A room can only be given with a transfer order');
    });

    it('should cancel a pending transfer when a discharge is ordered', async () => {
      await service.create(
        { admissionId: 'admission-123', orderContent: 'May go home', type: OrderType.DISCHARGE },
        'doctor-123',
        Role.PHYSICIAN,
      );

      expect(prismaService.physicianOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: OrderType.TRANSFER, active: true }),
          data: { active: false },
        }),
      );
    });

    it('should move the patient and notify both wards and the physicians when the nurse finishes it', async () => {
      const transferOrder = { ...mockOrder, type: OrderType.TRANSFER, transferRoomId: 'room-305' };
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(transferOrder);
      (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(1);
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue({
        ...transferOrder,
        status: OrderStatus.FINISHED,
        orderedBy: { firstName: 'Ana', lastName: 'Cruz' },
      });
      (prismaService.courseInWard.findFirst as jest.Mock).mockResolvedValue(null);

      await service.updateStatus('order-123', { status: OrderStatus.FINISHED }, 'nurse-123');

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.patientAdmission.update).toHaveBeenCalledWith({
        where: { id: 'admission-123' },
        data: expect.objectContaining({
          roomId: 'room-305',
          roomNumber: '305',
        }),
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PATIENT_TRANSFERRED' }),
      );
      expect(mockNotificationsService.notifyNursesInWard).toHaveBeenCalledWith('ward-coronary', {
        title: 'Patient transferred out',
        message: expect.stringContaining('to room 305 (Surgery)'),
      });
      expect(mockNotificationsService.notifyNursesInWard).toHaveBeenCalledWith('ward-surgery', {
        title: 'Patient transferred in',
        message: expect.stringContaining('from room 210 (Coronary)'),
        patientId: 'patient-123',
      });
      expect(mockNotificationsService.notifyUsers).toHaveBeenCalledWith(
        ['doctor-123', 'doctor-456', 'doctor-123'],
        expect.objectContaining({
          title: 'Patient transferred',
          message: expect.stringContaining('moved from room 210 (Coronary) to room 305 (Surgery)'),
        }),
      );
    });

    it('should send one message when the new room is in the same ward', async () => {
      (prismaService.room.findUnique as jest.Mock).mockResolvedValue({
        ...surgery305,
        ward: { id: 'ward-coronary', name: 'Coronary' },
      });
      const transferOrder = { ...mockOrder, type: OrderType.TRANSFER, transferRoomId: 'room-305' };
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(transferOrder);
      (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(1);
      (prismaService.physicianOrder.update as jest.Mock).mockResolvedValue(transferOrder);

      await service.updateStatus('order-123', { status: OrderStatus.FINISHED }, 'nurse-123');

      expect(mockNotificationsService.notifyNursesInWard).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.notifyNursesInWard).toHaveBeenCalledWith(
        'ward-coronary',
        expect.objectContaining({ title: 'Patient moved rooms' }),
      );
    });

    it('should refuse to carry out a transfer that was already done or replaced', async () => {
      const transferOrder = { ...mockOrder, type: OrderType.TRANSFER, transferRoomId: 'room-305' };
      (prismaService.physicianOrder.findFirst as jest.Mock).mockResolvedValue(transferOrder);
      (prismaService.physicianOrder.count as jest.Mock).mockResolvedValue(0);

      await expect(
        service.updateStatus('order-123', { status: OrderStatus.FINISHED }, 'nurse-123'),
      ).rejects.toThrow(ConflictException);
      expect(prismaService.patientAdmission.update).not.toHaveBeenCalled();
      expect(prismaService.physicianOrder.update).not.toHaveBeenCalled();
    });
  });
});
