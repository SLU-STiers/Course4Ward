// backend/src/unit-tests/auth.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto } from '../auth/dto/login.dto';
import * as bcrypt from 'bcrypt';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  passwordResetRequest: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
} as unknown as jest.Mocked<JwtService>;

const mockConfigService = {
  get: jest.fn(),
} as unknown as jest.Mocked<ConfigService>;

const mockAuditLogService = {
  record: jest.fn(),
} as unknown as jest.Mocked<AuditLogService>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;
  let configService: typeof mockConfigService;
  let auditLogService: typeof mockAuditLogService;

  const mockUser = {
    id: 'user-123',
    userId: 'DRJ-0231',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    role: 'DOCTOR',
    isActive: true,
    mustResetPassword: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    auditLogService = module.get(AuditLogService);

    jest.clearAllMocks();

    // Sensible defaults so tests don't need to restate config values
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, string> = {
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return values[key];
    });

    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('mock-access-token')
      .mockResolvedValueOnce('mock-refresh-token');
  });

  describe('requestPasswordReset', () => {
    it('should reject a user ID that does not exist', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.requestPasswordReset({ userId: 'INVALID-USER' })).rejects.toThrow(
        'User ID not found',
      );

      expect(prismaService.passwordResetRequest.updateMany).not.toHaveBeenCalled();
      expect(prismaService.passwordResetRequest.create).not.toHaveBeenCalled();
    });

    it('should not expose the raw reset token in the response', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.passwordResetRequest.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prismaService.passwordResetRequest.create as jest.Mock).mockResolvedValue({ id: 'req-1' });

      const response = await service.requestPasswordReset({ userId: 'DRJ-0231' });

      expect(response).toEqual({
        message: 'Reset request submitted for administrator approval.',
      });
      expect(response).not.toHaveProperty('resetToken');
    });
  });

  describe('getPasswordResetStatus', () => {
    it('should return EXPIRED when the token is missing or expired', async () => {
      (prismaService.passwordResetRequest.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getPasswordResetStatus('missing-token')).resolves.toEqual({ status: 'EXPIRED' });

      (prismaService.passwordResetRequest.findUnique as jest.Mock).mockResolvedValue({
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
        temporaryPassword: null,
      });

      await expect(service.getPasswordResetStatus('expired-token')).resolves.toEqual({ status: 'EXPIRED' });
    });

    it('should return REJECTED for a rejected request', async () => {
      (prismaService.passwordResetRequest.findUnique as jest.Mock).mockResolvedValue({
        status: 'REJECTED',
        expiresAt: new Date(Date.now() + 60_000),
        temporaryPassword: null,
      });

      await expect(service.getPasswordResetStatus('rejected-token')).resolves.toEqual({
        status: 'REJECTED',
        temporaryPassword: null,
      });
    });

    it('should return the same temporary password on every call until it expires', async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      (prismaService.passwordResetRequest.findUnique as jest.Mock).mockResolvedValue({
        status: 'APPROVED',
        expiresAt,
        temporaryPassword: 'temp-pass-123',
      });

      const first = await service.getPasswordResetStatus('approved-token');
      const second = await service.getPasswordResetStatus('approved-token');

      expect(first).toEqual({ status: 'APPROVED', temporaryPassword: 'temp-pass-123', expiresAt });
      expect(second).toEqual(first);
      expect(prismaService.passwordResetRequest.update).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should return EXPIRED once the temporary password has been used', async () => {
      (prismaService.passwordResetRequest.findUnique as jest.Mock).mockResolvedValue({
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 60_000),
        temporaryPassword: null,
      });

      await expect(service.getPasswordResetStatus('used-token')).resolves.toEqual({ status: 'EXPIRED' });
    });
  });

  describe('approvePasswordReset', () => {
    it('should restart the retrieval window from the moment of approval', async () => {
      const request = {
        id: 'req-123',
        userId: 'user-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        user: { userId: 'DRJ-0231', firstName: 'John', lastName: 'Doe' },
      };
      (prismaService.passwordResetRequest.findUnique as jest.Mock).mockResolvedValue(request);
      (prismaService.$transaction as jest.Mock).mockResolvedValue([]);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      const before = Date.now();
      await service.approvePasswordReset('req-123', 'admin-456');

      const { data } = (prismaService.passwordResetRequest.update as jest.Mock).mock.calls[0][0];
      expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
    });
  });

  describe('changePassword', () => {
    it('should discard any temporary password still held for the user', async () => {
      (prismaService.user.update as jest.Mock).mockResolvedValue({ ...mockUser, sessionVersion: 2 });
      (prismaService.passwordResetRequest.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      await service.changePassword('user-123', 'new-password-123');

      expect(prismaService.passwordResetRequest.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', temporaryPassword: { not: null } },
        data: { temporaryPassword: null },
      });
    });
  });

  describe('rejectPasswordReset', () => {
    it('should mark a pending request as rejected', async () => {
      const request = {
        id: 'req-123',
        userId: 'user-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        user: { userId: 'DRJ-0231', firstName: 'John', lastName: 'Doe' },
      };

      (prismaService.passwordResetRequest.findUnique as jest.Mock).mockResolvedValue(request);
      (prismaService.$transaction as jest.Mock).mockResolvedValue([request]);

      await expect(service.rejectPasswordReset('req-123', 'admin-456')).resolves.toEqual({
        message: 'Password reset request rejected.',
        user: {
          userId: 'DRJ-0231',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto: LoginDto = { userId: 'DRJ-0231', password: 'correct-password' };

    it('should return tokens and user info when credentials are valid', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true) as never);

      // Act
      const result = await service.login(dto);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { userId: 'DRJ-0231' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', mockUser.passwordHash);

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: mockUser.id, userId: mockUser.userId, role: mockUser.role },
        { secret: 'access-secret', expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: mockUser.id, userId: mockUser.userId, role: mockUser.role },
        { secret: 'refresh-secret', expiresIn: '7d' },
      );

      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: mockUser.id,
        action: 'LOGIN',
      });

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        mustResetPassword: false,
        user: {
          id: mockUser.id,
          userId: mockUser.userId,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role,
          mustResetPassword: false,
        },
      });
    });

    it('should throw error when user is not found', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { userId: 'DRJ-0231' },
      });
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('should throw error when user is inactive', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('should throw error when password is incorrect', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false) as never);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');

      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password'.length ? dto.password : dto.password, mockUser.passwordHash);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
  describe('findPasswordResetRequests', () => {
    const findManyArgs = () =>
      (prismaService.passwordResetRequest.findMany as jest.Mock).mock.calls[0][0];

    beforeEach(() => {
      (prismaService.$transaction as jest.Mock).mockResolvedValue([[{ id: 'req-1' }], 1234]);
    });

    it('returns one page plus the full total, newest first by default', async () => {
      const result = await service.findPasswordResetRequests();

      expect(result).toEqual({ items: [{ id: 'req-1' }], total: 1234, skip: 0, take: 10 });
      const args = findManyArgs();
      expect(args.skip).toBe(0);
      expect(args.take).toBe(10);
      expect(args.where).toEqual({});
      expect(args.orderBy).toEqual([{ requestedAt: 'desc' }, { id: 'desc' }]);
    });

    it('applies skip/take and sorts by user name', async () => {
      await service.findPasswordResetRequests({ skip: 100, take: 50, sort: 'name', direction: 'asc' });

      const args = findManyArgs();
      expect(args.skip).toBe(100);
      expect(args.take).toBe(50);
      expect(args.orderBy).toEqual([
        { user: { firstName: 'asc' } },
        { user: { lastName: 'asc' } },
        { id: 'asc' },
      ]);
    });

    it('filters by status and requires every search word to match, in the page and the count', async () => {
      await service.findPasswordResetRequests({ status: 'PENDING', search: ' john  doe ' });

      const where = findManyArgs().where;
      expect(where.AND).toHaveLength(3);
      expect(where.AND[0]).toEqual({ status: 'PENDING' });
      expect(JSON.stringify(where.AND[1])).toContain('"contains":"john"');
      expect(JSON.stringify(where.AND[2])).toContain('"contains":"doe"');
      expect(prismaService.passwordResetRequest.count).toHaveBeenCalledWith({ where });
    });

    it('never returns the temporary password in the list', async () => {
      await service.findPasswordResetRequests();

      expect(findManyArgs().select.temporaryPassword).toBeUndefined();
      expect(findManyArgs().select.status).toBe(true);
    });
  });
});
