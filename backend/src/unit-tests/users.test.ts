import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userIdCounter: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ward: {
      count: jest.fn(),
    },
    patientAdmission: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockAuditLogService = {
    record: jest.fn(),
    patientName: jest.fn().mockResolvedValue('Juan Dela Cruz'),
    userLabel: jest.fn().mockResolvedValue('Ana Reyes (DOC001)'),
  };

  const mockNotificationsService = {
    create: jest.fn(),
    notifyUsers: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockReset();
    mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockPrismaService));
    mockPrismaService.patientAdmission.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('creates a missing userIdCounter row before creating a user account', async () => {
    const tx = {
      userIdCounter: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ role: Role.NURSE, nextNumber: 1 }),
        update: jest.fn().mockResolvedValue({ role: Role.NURSE, nextNumber: 1 }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          userId: 'NRS001',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.NURSE,
          isActive: true,
          mustResetPassword: true,
          createdAt: new Date(),
        }),
      },
    };

    mockPrismaService.$transaction.mockImplementation(async (callback) => callback(tx));
    mockPrismaService.ward.count.mockResolvedValue(1);

    await service.create(
      {
        firstName: 'Jane',
        lastName: 'Doe',
        role: Role.NURSE,
        temporaryPassword: 'StrongPass123',
        wardIds: ['ward-er'],
      },
      'admin-1',
    );

    // NRS001 is used, so the counter now points at the next unused number.
    expect(tx.userIdCounter.create).toHaveBeenCalledWith({
      data: {
        role: Role.NURSE,
        nextNumber: 2,
      },
    });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'NRS001',
          role: Role.NURSE,
        }),
      }),
    );
    expect(mockAuditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      action: 'USER_CREATED',
      details: expect.objectContaining({
        summary: 'Created Nurse account NRS001 for Jane Doe',
        items: expect.arrayContaining([
          { label: 'Login ID', value: 'NRS001' },
          { label: 'Role', value: 'Nurse' },
        ]),
      }),
    }));
  });

  it('skips past ids already taken when the counter lags behind the accounts', async () => {
    const tx = {
      userIdCounter: {
        findUnique: jest.fn().mockResolvedValue({ role: Role.CLAIMS_PROCESSOR, nextNumber: 1 }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue(
          ['CLM001', 'CLM002', 'CLM004', 'CLMX'].map((userId) => ({ userId })),
        ),
        create: jest.fn().mockResolvedValue({
          id: 'user-5', userId: 'CLM005', firstName: 'Ana', lastName: 'Cruz',
          role: Role.CLAIMS_PROCESSOR, isActive: true, mustResetPassword: true,
        }),
      },
    };
    mockPrismaService.$transaction.mockImplementation(async (callback) => callback(tx));

    await service.create(
      { firstName: 'Ana', lastName: 'Cruz', role: Role.CLAIMS_PROCESSOR, temporaryPassword: 'StrongPass123' },
      'admin-1',
    );

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'CLM005' }) }),
    );
    expect(tx.userIdCounter.update).toHaveBeenCalledWith({
      where: { role: Role.CLAIMS_PROCESSOR },
      data: { nextNumber: 6 },
    });
  });

  it('uses the counter when it is ahead of the taken ids', async () => {
    const tx = {
      userIdCounter: {
        findUnique: jest.fn().mockResolvedValue({ role: Role.ADMIN, nextNumber: 9 }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'ADM003' }]),
        create: jest.fn().mockResolvedValue({
          id: 'user-9', userId: 'ADM009', firstName: 'Ana', lastName: 'Cruz',
          role: Role.ADMIN, isActive: true, mustResetPassword: true,
        }),
      },
    };
    mockPrismaService.$transaction.mockImplementation(async (callback) => callback(tx));

    await service.create(
      { firstName: 'Ana', lastName: 'Cruz', role: Role.ADMIN, temporaryPassword: 'StrongPass123' },
      'admin-1',
    );

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'ADM009' }) }),
    );
  });

  it('reports a concurrent id clash as a 409 instead of a server error', async () => {
    mockPrismaService.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(
        { firstName: 'Ana', lastName: 'Cruz', role: Role.ADMIN, temporaryPassword: 'StrongPass123' },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('admin lock-out protection', () => {
    const admin = (id: string) => ({
      id,
      userId: 'ADM001',
      firstName: 'Rafael',
      lastName: 'Cruz',
      role: Role.ADMIN,
      isActive: true,
      wards: [],
      physicianWards: [],
    });

    it('refuses to let an admin deactivate their own account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(admin('admin-1'));
      await expect(service.update('admin-1', { isActive: false }, 'admin-1')).rejects.toThrow(
        'You cannot deactivate your own account',
      );
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('refuses to let an admin remove their own admin role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(admin('admin-1'));
      await expect(
        service.update('admin-1', { role: Role.CLAIMS_PROCESSOR }, 'admin-1'),
      ).rejects.toThrow('remove your own admin role');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('still lets an admin rename themselves', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(admin('admin-1'));
      mockPrismaService.user.update.mockResolvedValue({ ...admin('admin-1'), firstName: 'Raf' });
      await service.update('admin-1', { firstName: 'Raf', role: Role.ADMIN, isActive: true }, 'admin-1');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('refuses to deactivate the last active admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(admin('admin-2'));
      mockPrismaService.user.count.mockResolvedValue(0);
      await expect(service.update('admin-2', { isActive: false }, 'admin-1')).rejects.toThrow(
        'At least one active admin account must remain.',
      );
    });

    it('lets one admin deactivate another while other admins remain', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(admin('admin-2'));
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.update.mockResolvedValue({ ...admin('admin-2'), isActive: false });
      await service.update('admin-2', { isActive: false }, 'admin-1');
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { role: Role.ADMIN, isActive: true, id: { not: 'admin-2' } },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });

  it('logs exactly which account fields an update changed', async () => {
    const before = {
      id: 'user-1',
      userId: 'NRS001',
      firstName: 'Jane',
      lastName: 'Doe',
      role: Role.NURSE,
      isActive: true,
      wards: [{ ward: { id: 'ward-er', name: 'ER' } }],
      physicianWards: [],
    };
    mockPrismaService.user.findUnique.mockResolvedValue(before);
    mockPrismaService.user.update.mockResolvedValue({ ...before, lastName: 'Cruz', isActive: false });

    await service.update('user-1', { lastName: 'Cruz', isActive: false }, 'admin-1');

    expect(mockAuditLogService.record).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'USER_UPDATED',
      details: expect.objectContaining({
        summary: 'Updated Jane Cruz (NRS001): last name, status',
        changes: [
          { field: 'Last name', from: 'Doe', to: 'Cruz' },
          { field: 'Status', from: 'Active', to: 'Inactive' },
        ],
      }),
    });
  });

  describe('physicians with admitted patients', () => {
    const physician = {
      id: 'doctor-1',
      userId: 'DOC001',
      firstName: 'Ana',
      lastName: 'Reyes',
      role: Role.PHYSICIAN,
      isActive: true,
      wards: [],
      physicianWards: [{ ward: { id: 'ward-er', name: 'ER' } }],
    };

    it('refuses to deactivate the attending physician of admitted patients', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(physician);
      mockPrismaService.patientAdmission.findMany.mockResolvedValue([
        { patient: { firstName: 'Rosa', lastName: 'Villanueva' } },
      ]);

      await expect(service.update('doctor-1', { isActive: false }, 'admin-1')).rejects.toThrow(
        /still the attending physician of 1 admitted patient/,
      );
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('signs the user out and gives a new login id when the role changes', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(physician);
      mockPrismaService.userIdCounter.findUnique.mockResolvedValue({ role: Role.CLAIMS_PROCESSOR, nextNumber: 4 });
      mockPrismaService.userIdCounter.update.mockResolvedValue({});
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.update.mockResolvedValue({ ...physician, userId: 'CLM004', role: Role.CLAIMS_PROCESSOR });

      await service.update('doctor-1', { role: Role.CLAIMS_PROCESSOR }, 'admin-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.CLAIMS_PROCESSOR,
            userId: expect.stringMatching(/^CLM/),
            sessionVersion: { increment: 1 },
            lastSeenAt: null,
          }),
        }),
      );
    });
  });

  describe('ward assignment', () => {
    const input = (role: Role, wardIds: string[]) => ({
      firstName: 'Jane',
      lastName: 'Doe',
      role,
      temporaryPassword: 'StrongPass123',
      wardIds,
    });

    it('refuses wards for roles other than physicians and nurses', async () => {
      await expect(service.create(input(Role.ADMIN, ['ward-surgery']), 'admin-1')).rejects.toThrow(
        'Only physicians and nurses are assigned to wards',
      );
    });

    it('requires at least one ward specialty for a physician', async () => {
      await expect(service.create(input(Role.PHYSICIAN, []), 'admin-1')).rejects.toThrow(
        'Physicians must be assigned at least one ward / specialty',
      );
    });

    it('creates a physician with multiple ward specialties', async () => {
      const tx = {
        userIdCounter: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ role: Role.PHYSICIAN, nextNumber: 1 }),
          update: jest.fn(),
        },
        user: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(tx));
      mockPrismaService.ward.count.mockResolvedValue(2);

      await service.create(
        input(Role.PHYSICIAN, ['ward-obdr', 'ward-picu']),
        'admin-1',
      );

      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            physicianWards: {
              create: [{ wardId: 'ward-obdr' }, { wardId: 'ward-picu' }],
            },
          }),
        }),
      );
    });

    it('requires at least one ward for a nurse', async () => {
      await expect(service.create(input(Role.NURSE, []), 'admin-1')).rejects.toThrow(
        'Nurses must be assigned at least one ward',
      );
    });

    it('refuses a ward that does not exist', async () => {
      mockPrismaService.ward.count.mockResolvedValue(1);
      await expect(
        service.create(input(Role.NURSE, ['ward-surgery', 'ward-missing']), 'admin-1'),
      ).rejects.toThrow('One or more wards do not exist');
    });

    it('replaces the wards of a nurse on update', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isActive: true, role: Role.NURSE });
      mockPrismaService.ward.count.mockResolvedValue(2);
      mockPrismaService.user.update.mockResolvedValue({});

      await service.update('user-1', { wardIds: ['ward-micu', 'ward-surgery'] }, 'admin-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            wards: {
              deleteMany: {},
              create: [{ wardId: 'ward-micu' }, { wardId: 'ward-surgery' }],
            },
          }),
        }),
      );
    });

    it('tells a nurse when their ward assignment changes', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        userId: 'NRS001',
        firstName: 'Angela',
        lastName: 'Reyes',
        role: Role.NURSE,
        isActive: true,
        wards: [{ ward: { name: 'Emergency' } }],
        physicianWards: [],
      });
      mockPrismaService.ward.count.mockResolvedValue(2);
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        userId: 'NRS001',
        firstName: 'Angela',
        lastName: 'Reyes',
        role: Role.NURSE,
        isActive: true,
        wards: [{ ward: { name: 'Surgery' } }, { ward: { name: 'Medical ICU' } }],
        physicianWards: [],
      });

      await service.update('user-1', { wardIds: ['ward-surgery', 'ward-micu'] }, 'admin-1');

      expect(mockNotificationsService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        title: 'Ward assignment updated',
        message: 'You have been transferred to Medical ICU and Surgery.',
      });
    });

    it('tells the care-team physician when a nurse is transferred onto their patient ward', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'nurse-1',
        firstName: 'Angela',
        lastName: 'Reyes',
        role: Role.NURSE,
        isActive: true,
        wards: [{ ward: { id: 'ward-er', name: 'Emergency' } }],
        physicianWards: [],
      });
      mockPrismaService.ward.count.mockResolvedValue(1);
      mockPrismaService.user.update.mockResolvedValue({
        id: 'nurse-1',
        firstName: 'Angela',
        lastName: 'Reyes',
        role: Role.NURSE,
        isActive: true,
        wards: [{ ward: { id: 'ward-coronary', name: 'Coronary', holdsUnroomed: false } }],
        physicianWards: [],
      });
      mockPrismaService.patientAdmission.findMany.mockResolvedValue([
        {
          physicianId: 'doctor-1',
          additionalPhysicians: [{ physicianId: 'doctor-2' }],
          patient: { id: 'patient-1', firstName: 'Rosa', lastName: 'Villanueva' },
        },
      ]);

      await service.update('nurse-1', { wardIds: ['ward-coronary'] }, 'admin-1');

      expect(mockPrismaService.patientAdmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dischargeDate: null, room: { wardId: 'ward-coronary' } },
        }),
      );
      expect(mockNotificationsService.notifyUsers).toHaveBeenCalledWith(['doctor-1', 'doctor-2'], {
        title: 'Nurse transferred',
        message: '**Angela Reyes** was transferred to Coronary and will take the shift for **Rosa Villanueva**.',
        patientId: 'patient-1',
      });
    });

    it('replaces a physician specialty set on update', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isActive: true, role: Role.PHYSICIAN });
      mockPrismaService.ward.count.mockResolvedValue(2);
      mockPrismaService.user.update.mockResolvedValue({});

      await service.update('user-1', { wardIds: ['ward-obdr', 'ward-picu'] }, 'admin-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            physicianWards: {
              deleteMany: {},
              create: [{ wardId: 'ward-obdr' }, { wardId: 'ward-picu' }],
            },
            wards: { deleteMany: {} },
          }),
        }),
      );
    });
  });
});
