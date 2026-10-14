import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    wards: { select: { ward: { select: { id: true, name: true } } } },
    physicianWards: { select: { ward: { select: { id: true, name: true } } } },
  };

  /** Validate ward assignments for physicians and nurses. */
  private async wardIdsFor(role: Role, wardIds: string[] | undefined) {
    if (role !== Role.NURSE && role !== Role.PHYSICIAN) {
      if (wardIds?.length) throw new BadRequestException('Only physicians and nurses are assigned to wards');
      return [];
    }
    const ids = [...new Set(wardIds ?? [])];
    if (role === Role.PHYSICIAN && !ids.length) {
      throw new BadRequestException('Physicians must be assigned at least one ward / specialty');
    }
    if (!ids.length) return ids;
    const found = await this.prisma.ward.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('One or more wards do not exist');
    return ids;
  }

  async create(dto: CreateUserDto, actingAdminId: string) {
    const wardIds = await this.wardIdsFor(dto.role, dto.wardIds);
    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const prefixes: Record<Role, string> = {
      ADMIN: 'ADM',
      PHYSICIAN: 'DOC',
      NURSE: 'NRS',
      CLAIMS_PROCESSOR: 'CLM',
    };

    const user = await this.prisma.$transaction(async (tx) => {
      const existingCounter = await tx.userIdCounter.findUnique({
        where: { role: dto.role },
      });

      let counter;
      let nextUserNumber: number;

      if (existingCounter) {
        counter = await tx.userIdCounter.update({
          where: { role: dto.role },
          data: { nextNumber: { increment: 1 } },
        });
        nextUserNumber = counter.nextNumber - 1;
      } else {
        counter = await tx.userIdCounter.create({
          data: {
            role: dto.role,
            nextNumber: 1,
          },
        });
        nextUserNumber = counter.nextNumber;
      }

      const userId = `${prefixes[dto.role]}${String(nextUserNumber).padStart(3, '0')}`;

      return tx.user.create({
        data: {
          userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          passwordHash,
          mustResetPassword: true,
          wards: dto.role === Role.NURSE && wardIds.length
            ? { create: wardIds.map((wardId) => ({ wardId })) }
            : undefined,
          physicianWards: dto.role === Role.PHYSICIAN && wardIds.length
            ? { create: wardIds.map((wardId) => ({ wardId })) }
            : undefined,
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
      select: { isActive: true, role: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const { wardIds: requestedWardIds, ...fields } = dto;
    const role = dto.role ?? existing.role;
    // Replace ward assignments when sent, and clear both relation types on role changes.
    const wardIds =
      requestedWardIds !== undefined || role !== existing.role
        ? await this.wardIdsFor(role, requestedWardIds)
        : undefined;

    const statusChanged = dto.isActive !== undefined && dto.isActive !== existing.isActive;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...fields,
        ...(wardIds !== undefined
          ? {
              wards: {
                deleteMany: {},
                ...(role === Role.NURSE && wardIds.length
                  ? { create: wardIds.map((wardId) => ({ wardId })) }
                  : {}),
              },
              physicianWards: {
                deleteMany: {},
                ...(role === Role.PHYSICIAN && wardIds.length
                  ? { create: wardIds.map((wardId) => ({ wardId })) }
                  : {}),
              },
            }
          : {}),
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
