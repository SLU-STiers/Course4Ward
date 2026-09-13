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
});
