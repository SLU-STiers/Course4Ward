import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OrderEnteredBy, OrderStatus, OrderType, PatientClass, Role, ActionType } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('order creation workflow integration', () => {
  let service: OrdersService;
  let module: TestingModule;

  const admission = {
    id: 'admission-1',
    patientId: 'patient-1',
    dischargeDate: null,
    patientClass: PatientClass.INPATIENT,
    physicianId: 'doctor-1',
    additionalPhysicians: [],
    room: null,
    patient: { firstName: 'Mina', middleName: null, lastName: 'Santos' },
  };
  const order = {
    id: 'order-1',
    admissionId: admission.id,
    orderedById: 'doctor-1',
    encodedById: 'nurse-1',
    enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
    orderContent: 'CBC tomorrow morning',
    status: OrderStatus.TO_ACCOMPLISH,
    type: OrderType.DEFAULT,
    orderedBy: { firstName: 'Ana', lastName: 'Reyes' },
  };
  const prisma = {
    patientAdmission: { findUnique: jest.fn().mockResolvedValue(admission) },
    physicianOrder: { create: jest.fn().mockResolvedValue(order) },
    auditLog: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
    notification: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'notification-1', ...data })),
    },
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        OrdersService,
        AuditLogService,
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://127.0.0.1:8000') } },
      ],
    }).compile();
    service = module.get(OrdersService);
    jest.spyOn(service as any, 'persistOrderEmbedding').mockResolvedValue(undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patientAdmission.findUnique.mockResolvedValue(admission);
    prisma.physicianOrder.create.mockResolvedValue(order);
    prisma.auditLog.create.mockImplementation(({ data }) => Promise.resolve(data));
    prisma.notification.create.mockImplementation(({ data }) => Promise.resolve({ id: 'notification-1', ...data }));
  });

  afterAll(async () => {
    await module.close();
  });

  it('persists the order, audit entry, and care-team notification through their real services', async () => {
    const result = await service.create(
      { admissionId: admission.id, orderedById: 'doctor-1', orderContent: order.orderContent },
      'nurse-1',
      Role.NURSE,
    );

    expect(result).toEqual(order);
    expect(prisma.physicianOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
          orderedById: 'doctor-1',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'nurse-1',
          action: ActionType.CREATE_ORDER,
          details: expect.objectContaining({ summary: expect.stringContaining('Mina Santos') }),
        }),
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'doctor-1',
        patientId: 'patient-1',
        title: 'Order entered on your behalf',
      }),
    });
  });
});
