import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
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
    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const prefixes: Record<Role, string> = {
      ADMIN: 'ADM',
      PHYSICIAN: 'DOC',
      NURSE: 'NRS',
      CLAIMS_PROCESSOR: 'CLM',
    };

    const user = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.userIdCounter.update({
        where: { role: dto.role },
        data: { nextNumber: { increment: 1 } },
      });
      const userId = `${prefixes[dto.role]}${String(counter.nextNumber - 1).padStart(3, '0')}`;

      return tx.user.create({
        data: {
          userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          passwordHash,
          mustResetPassword: true,
        },
        select: this.safeSelect,
      });
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
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const statusChanged = dto.isActive !== undefined && dto.isActive !== existing.isActive;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        ...(statusChanged ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: this.safeSelect,
    });

    await this.auditLog.record({
      userId: actingAdminId,
      action: 'USER_UPDATED',
    });

    return user;
  }

}
