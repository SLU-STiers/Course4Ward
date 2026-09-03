import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  private readonly safeSelect = {
    id: true,
    userId: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    mustResetPassword: true,
    createdAt: true,
  };

  async create(dto: CreateUserDto, actingAdminId: string) {
    const existing = await this.prisma.user.findUnique({ where: { userId: dto.userId } });
    if (existing) throw new ConflictException('userId already exists');

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        passwordHash,
        mustResetPassword: true,
      },
      select: this.safeSelect,
    });

    await this.auditLog.record({
      userId: actingAdminId,
      action: 'USER_CREATED',
    });

    return user;
  }

  findAll() {
    return this.prisma.user.findMany({ select: this.safeSelect, orderBy: { lastName: 'asc' } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: this.safeSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actingAdminId: string) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.safeSelect,
    });

    await this.auditLog.record({
      userId: actingAdminId,
      action: 'USER_UPDATED',
    });

    return user;
  }

  // Soft delete (deactivate) is the standard in healthcare systems --
  // hard-deleting a user breaks audit trail / order history integrity.
  async remove(id: string, actingAdminId: string) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: this.safeSelect,
    });

    await this.auditLog.record({
      userId: actingAdminId,
      action: 'USER_DEACTIVATED',
    });

    return user;
  }
}
