// backend/src/unit-tests/orders.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrderEnteredBy, Role } from '@prisma/client';
import { CreateOrderDto } from '../orders/dto/create-order.dto';

const mockPrismaService = {
  physicianOrder: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  patientAdmission: {
    findUnique: jest.fn(),
  },
  $executeRaw: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:8000'),
} as unknown as jest.Mocked<ConfigService>;

const orderInclude = {
  orderedBy: { select: { firstName: true, lastName: true } },
  encodedBy: { select: { firstName: true, lastName: true, role: true } },
};

const openAdmission = {
  dischargeDate: null,
  physicianId: 'doctor-123',
  additionalPhysicians: [{ physicianId: 'doctor-456' }],
};

const mockAuditLogService = {
  record: jest.fn(),
} as unknown as jest.Mocked<AuditLogService>;

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
    dateCreated: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);

    jest.clearAllMocks();
    // Embedding is best-effort and fire-and-forget; keep it off the network.
    jest.spyOn(service as any, 'persistOrderEmbedding').mockResolvedValue(undefined);
    (prismaService.patientAdmission.findUnique as jest.Mock).mockResolvedValue(openAdmission);
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
        },
        include: orderInclude,
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: 'nurse-123',
        action: 'ORDER_CREATED',
      });
      expect(result).toEqual(mockOrder);
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
        BadRequestException,
      );
      expect(prismaService.physicianOrder.create).not.toHaveBeenCalled();
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
        include: {
          orderedBy: { select: { firstName: true, lastName: true } },
          encodedBy: { select: { firstName: true, lastName: true, role: true } },
        },
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
        },
        orderBy: { dateCreated: 'asc' },
        include: { admission: { select: { id: true, admissionDate: true } } },
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
});