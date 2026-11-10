import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditChange,
  AuditLogService,
  ROLE_LABELS,
  detailItems,
  fullName,
} from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type WardLinks = { ward: { id?: string; name: string; holdsUnroomed?: boolean } }[];

/** The account's ward / specialty names, as one comparable line. */
function wardNames(user: { wards?: WardLinks; physicianWards?: WardLinks }): string {
  const names = [...(user.wards ?? []), ...(user.physicianWards ?? [])].map((link) => link.ward.name).sort();
  return names.length ? names.join(', ') : 'None';
}

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

/** Login id prefix per role, e.g. NRS014. */
const ID_PREFIXES: Record<Role, string> = {
  ADMIN: 'ADM',
  PHYSICIAN: 'DOC',
  NURSE: 'NRS',
  CLAIMS_PROCESSOR: 'CLM',
};

/** Two admins creating / re-roling at once can still race for one id. */
function rethrowIdRace(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('Another account was created at the same time. Please try again.');
  }
  throw error;
}

function formatList(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** What the nurse reads after an admin changes their ward assignment. */
function wardTransferMessage(previous: string, names: string[]) {
  if (!names.length) return 'You are no longer assigned to a ward.';
  const list = formatList(names);
  if (previous === 'None') return `You have been assigned to ${list}.`;
  return `You have been transferred to ${list}.`;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private notifications: NotificationsService,
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
    wards: { select: { ward: { select: { id: true, name: true, holdsUnroomed: true } } } },
    physicianWards: { select: { ward: { select: { id: true, name: true, holdsUnroomed: true } } } },
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
    // A nurse with no ward sees every patient as restricted yet could register patients.
    if (role === Role.NURSE && !ids.length) {
      throw new BadRequestException('Nurses must be assigned at least one ward');
    }
    if (!ids.length) return ids;
    const found = await this.prisma.ward.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('One or more wards do not exist');
    return ids;
  }

  /**
   * The next unused login id for `role` (DOC001, NRS014, ...). `nextNumber` is
   * never trusted below the highest id already taken, so a counter that lags
   * behind the accounts (e.g. seeded users) cannot hand out a duplicate.
   */
  private async nextUserId(tx: Prisma.TransactionClient, role: Role) {
    const prefix = ID_PREFIXES[role];
    const existingCounter = await tx.userIdCounter.findUnique({ where: { role } });
    const taken = await tx.user.findMany({
      where: { userId: { startsWith: prefix } },
      select: { userId: true },
    });
    const highestTaken = taken.reduce((max, { userId }) => {
      const match = new RegExp(`^${prefix}(\\d+)$`).exec(userId);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const nextUserNumber = Math.max(existingCounter?.nextNumber ?? 1, highestTaken + 1);

    if (existingCounter) {
      await tx.userIdCounter.update({ where: { role }, data: { nextNumber: nextUserNumber + 1 } });
    } else {
      await tx.userIdCounter.create({ data: { role, nextNumber: nextUserNumber + 1 } });
    }
    return `${prefix}${String(nextUserNumber).padStart(3, '0')}`;
  }

  async create(dto: CreateUserDto, actingAdminId: string) {
    const wardIds = await this.wardIdsFor(dto.role, dto.wardIds);
    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const userId = await this.nextUserId(tx, dto.role);

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
    }).catch(rethrowIdRace);

    await this.auditLog.record({
      userId: actingAdminId,
      action: 'USER_CREATED',
      details: {
        summary: `Created ${ROLE_LABELS[user.role]} account ${user.userId} for ${fullName(user)}`,
        items: detailItems([
          ['Login ID', user.userId],
          ['Name', fullName(user)],
          ['Role', ROLE_LABELS[user.role]],
          ['Wards / specialties', wardNames(user)],
          ['Status', user.isActive ? 'Active' : 'Inactive'],
          ['Must change password on first sign-in', yesNo(user.mustResetPassword)],
        ]),
      },
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
      select: this.safeSelect,
    });
    if (!existing) throw new NotFoundException('User not found');

    const { wardIds: requestedWardIds, ...fields } = dto;
    const role = dto.role ?? existing.role;
    const isActive = dto.isActive ?? existing.isActive;
    const roleChanged = role !== existing.role;
    await this.assertAdminAccessKept(existing, role, isActive, actingAdminId);
    if (existing.role === Role.PHYSICIAN && existing.isActive && (roleChanged || !isActive)) {
      await this.assertNotAttending(existing);
    }
    // Replace ward assignments when sent, and clear both relation types on role changes.
    const wardIds =
      requestedWardIds !== undefined || roleChanged
        ? await this.wardIdsFor(role, requestedWardIds)
        : undefined;

    const statusChanged = dto.isActive !== undefined && dto.isActive !== existing.isActive;
    // A new role signs the user out (their session still carries the old one)
    // and gives them a login id with the new role's prefix.
    const user = await this.prisma.$transaction(async (tx) => tx.user.update({
      where: { id },
      data: {
        ...fields,
        ...(roleChanged ? { userId: await this.nextUserId(tx, role) } : {}),
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
        ...(statusChanged || roleChanged ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: this.safeSelect,
    })).catch(rethrowIdRace);

    const changes: AuditChange[] = [];
    const compare = (field: string, from: string, to: string) => {
      if (from !== to) changes.push({ field, from, to });
    };
    compare('Login ID', existing.userId, user.userId);
    compare('First name', existing.firstName, user.firstName);
    compare('Last name', existing.lastName, user.lastName);
    compare('Role', ROLE_LABELS[existing.role], ROLE_LABELS[user.role]);
    compare('Wards / specialties', wardNames(existing), wardNames(user));
    compare('Status', existing.isActive ? 'Active' : 'Inactive', user.isActive ? 'Active' : 'Inactive');

    const target = `${fullName(user)} (${user.userId})`;
    await this.auditLog.record({
      userId: actingAdminId,
      action: 'USER_UPDATED',
      details: {
        summary: changes.length
          ? `Updated ${target}: ${changes.map((change) => change.field.toLowerCase()).join(', ')}`
          : `Saved ${target} with no changes`,
        items: detailItems([
          ['Account', target],
          ['Role', ROLE_LABELS[user.role]],
        ]),
        changes,
      },
    });

    if (user.role === Role.NURSE && wardNames(existing) !== wardNames(user)) {
      const names = (user.wards ?? []).map((link) => link.ward.name).sort((a, b) => a.localeCompare(b));
      await this.notifications.create({
        userId: user.id,
        title: 'Ward assignment updated',
        message: wardTransferMessage(wardNames(existing), names),
      });
      const previous = new Set(
        (existing.wards ?? []).map((link) => link.ward.id).filter((id): id is string => Boolean(id)),
      );
      const added = (user.wards ?? [])
        .map((link) => link.ward)
        .filter((ward): ward is { id: string; name: string; holdsUnroomed: boolean } =>
          Boolean(ward.id) && !previous.has(ward.id),
        );
      await this.notifyPhysiciansOfNurseTransfer(user, added);
    }

    return user;
  }

  /**
   * Keeps the system manageable: an admin cannot deactivate or demote their
   * own account (they would lock themselves out mid-session), and no change
   * may leave the hospital without an active admin to manage accounts.
   */
  private async assertAdminAccessKept(
    existing: { id: string; role: Role; isActive: boolean },
    nextRole: Role,
    nextIsActive: boolean,
    actingAdminId: string,
  ) {
    const losesAdminAccess =
      existing.role === Role.ADMIN && existing.isActive && (nextRole !== Role.ADMIN || !nextIsActive);
    if (!losesAdminAccess) return;

    if (existing.id === actingAdminId) {
      throw new BadRequestException(
        'You cannot deactivate your own account or remove your own admin role. Ask another admin to do it.',
      );
    }
    const otherActiveAdmins = await this.prisma.user.count({
      where: { role: Role.ADMIN, isActive: true, id: { not: existing.id } },
    });
    if (otherActiveAdmins === 0) {
      throw new BadRequestException('At least one active admin account must remain.');
    }
  }

  /**
   * Only the attending physician can write a discharge order, so a physician
   * cannot be deactivated or moved to another role while they still attend
   * patients who have not been discharged: those patients could never leave.
   */
  private async assertNotAttending(physician: { id: string; firstName: string; lastName: string }) {
    const attending = await this.prisma.patientAdmission.findMany({
      where: { physicianId: physician.id, dischargeDate: null },
      select: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { admissionDate: 'asc' },
    });
    if (!attending.length) return;
    const names = attending.slice(0, 3).map(({ patient }) => fullName(patient));
    const more = attending.length > names.length ? ` and ${attending.length - names.length} more` : '';
    throw new BadRequestException(
      `Dr. ${fullName(physician)} is still the attending physician of ${attending.length} admitted patient${
        attending.length === 1 ? '' : 's'
      } (${names.join(', ')}${more}). Have the nurse change their attending physician first.`,
    );
  }

  /**
   * Physicians on a patient's care team hear when a nurse is moved onto that
   * patient's ward and will cover the shift.
   */
  private async notifyPhysiciansOfNurseTransfer(
    nurse: { firstName: string; lastName: string },
    wards: { id: string; name: string; holdsUnroomed: boolean }[],
  ) {
    const nurseName = fullName(nurse);
    await Promise.all(
      wards.map(async (ward) => {
        const admissions = await this.prisma.patientAdmission.findMany({
          where: {
            dischargeDate: null,
            ...(ward.holdsUnroomed
              ? { OR: [{ room: { wardId: ward.id } }, { roomId: null }] }
              : { room: { wardId: ward.id } }),
          },
          select: {
            physicianId: true,
            additionalPhysicians: { select: { physicianId: true } },
            patient: { select: { id: true, firstName: true, lastName: true } },
          },
        });
        await Promise.all(
          admissions.map((admission) => {
            const physicianIds = [
              admission.physicianId,
              ...admission.additionalPhysicians.map(({ physicianId }) => physicianId),
            ].filter((id): id is string => Boolean(id));
            const patientName = fullName(admission.patient);
            return this.notifications.notifyUsers(physicianIds, {
              title: 'Nurse transferred',
              message: `**${nurseName}** was transferred to ${ward.name} and will take the shift for **${patientName}**.`,
              patientId: admission.patient.id,
            });
          }),
        );
      }),
    );
  }

}
