import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userIdCounter: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ward: {
      count: jest.fn(),
    },
  };

  const mockAuditLogService = {
    record: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
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

    await service.create(
      {
        firstName: 'Jane',
        lastName: 'Doe',
        role: Role.NURSE,
        temporaryPassword: 'StrongPass123',
      },
      'admin-1',
    );

    expect(tx.userIdCounter.create).toHaveBeenCalledWith({
      data: {
        role: Role.NURSE,
        nextNumber: 1,
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
    expect(mockAuditLogService.record).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'USER_CREATED',
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
        user: { create: jest.fn().mockResolvedValue({}) },
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
