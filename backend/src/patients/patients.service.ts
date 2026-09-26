import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

function buildTriage(dto: CreatePatientDto, nurseId: string) {
  const [bpSystolic, bpDiastolic] = dto.bp ? dto.bp.split('/').map(Number) : [undefined, undefined];
  const triage = {
    triageTime: dto.triageTime,
    heartRate: dto.heartRate,
    respRate: dto.respRate,
    spo2: dto.spo2,
    bpSystolic,
    bpDiastolic,
    temperature: dto.temp,
    painScore: dto.pain,
  };
  const hasAny = Object.values(triage).some((value) => value !== undefined && value !== null);
  return hasAny ? { ...triage, recordedById: nurseId } : null;
}

const triageSelect = {
  select: {
    triageTime: true,
    heartRate: true,
    respRate: true,
    spo2: true,
    bpSystolic: true,
    bpDiastolic: true,
    temperature: true,
    painScore: true,
    createdAt: true,
  },
};

const additionalPhysiciansSelect = {
  orderBy: { createdAt: 'asc' as const },
  select: { physician: { select: { id: true, firstName: true, lastName: true } } },
};

function resolveDateOfBirth(dto: CreatePatientDto): Date | undefined {
  if (dto.dateOfBirth) return new Date(dto.dateOfBirth);
  if (dto.age === undefined || dto.age === null) return undefined;
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - dto.age);
  dob.setMonth(0, 1);
  dob.setHours(0, 0, 0, 0);
  return dob;
}

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  /** Physicians available for nurse assignment when registering a patient. */
  listPhysicians() {
    return this.prisma.user.findMany({
      where: { role: Role.PHYSICIAN, isActive: true },
      select: { id: true, userId: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  // Nurse patient management: demographics + admission (ward or ER/outpatient)
  async create(dto: CreatePatientDto, nurseId: string) {
    const additionalPhysicianIds = [...new Set(dto.additionalPhysicianIds ?? [])].filter(
      (id) => id !== dto.physicianId,
    );
    const requiredIds = [dto.physicianId, ...additionalPhysicianIds];
    const activePhysicians = await this.prisma.user.count({
      where: { id: { in: requiredIds }, role: Role.PHYSICIAN, isActive: true },
    });
    if (activePhysicians !== requiredIds.length) {
      throw new BadRequestException('One or more selected physicians were not found or are inactive');
    }

    const isOutpatient =
      dto.admissionStatus === 'ER_OUTPATIENT'
        ? true
        : dto.admissionStatus === 'ADMITTED'
          ? false
          : Boolean(dto.isOutpatient);

    const admissionDate = dto.admissionDate ? new Date(dto.admissionDate) : new Date();
    const initialAssessment = (dto.notes ?? dto.initialAssessment ?? '').trim() || null;
    const triage = buildTriage(dto, nurseId);

    const patient = await this.prisma.patient.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        gender: dto.gender?.trim() || undefined,
        dateOfBirth: resolveDateOfBirth(dto),
        admissions: {
          create: {
            admissionDate,
            isOutpatient,
            outpatientSetAt: isOutpatient ? admissionDate : null,
            initialAssessment,
            physicianId: dto.physicianId,
            additionalPhysicians: additionalPhysicianIds.length
              ? { create: additionalPhysicianIds.map((physicianId) => ({ physicianId })) }
              : undefined,
            triage: triage ? { create: triage } : undefined,
          },
        },
      },
      include: {
        admissions: {
          orderBy: { admissionDate: 'desc' },
          select: {
            id: true,
            admissionDate: true,
            dischargeDate: true,
            isOutpatient: true,
            initialAssessment: true,
            physician: { select: { id: true, firstName: true, lastName: true } },
            additionalPhysicians: additionalPhysiciansSelect,
            triage: triageSelect,
          },
        },
      },
    });

    await this.auditLog.record({
      userId: nurseId,
      action: 'PATIENT_CREATED',
    });

    return patient;
  }

  // "Find and view the patient they are currently handling" -- scoped to
  // the requesting physician/nurse's active assignments.
  async findAssignedTo(userId: string, role: Role) {
    const nurseScope = role === Role.NURSE;
    const physicianScope = {
      OR: [
        { physicianId: userId },
        { additionalPhysicians: { some: { physicianId: userId } } },
      ],
    };
    return this.prisma.patient.findMany({
      where: { admissions: { some: nurseScope ? {} : physicianScope } },
      include: {
        admissions: {
          ...(nurseScope ? {} : { where: physicianScope }),
          orderBy: { admissionDate: 'desc' },
          ...(nurseScope
            ? {
                select: {
                  id: true,
                  admissionDate: true,
                  dischargeDate: true,
                  isOutpatient: true,
                  initialAssessment: true,
                  physician: { select: { firstName: true, lastName: true } },
                  additionalPhysicians: additionalPhysiciansSelect,
                  triage: triageSelect,
                },
              }
            : {
                select: {
                  id: true,
                  admissionDate: true,
                  dischargeDate: true,
                  isOutpatient: true,
                },
              }),
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findAllForNurse() {
    return this.prisma.patient.findMany({
      where: { admissions: { some: {} } },
      include: {
        admissions: {
          orderBy: { admissionDate: 'desc' },
          select: {
            id: true,
            admissionDate: true,
            dischargeDate: true,
            isOutpatient: true,
            initialAssessment: true,
            physician: { select: { firstName: true, lastName: true } },
            additionalPhysicians: additionalPhysiciansSelect,
            triage: triageSelect,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        admissions: { include: { orders: { orderBy: { dateCreated: 'desc' }, take: 20 } } },
        notes: { orderBy: { createdAt: 'desc' }, take: 20 },
        coursesInWard: { orderBy: { summaryDate: 'desc' }, take: 10 },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, userId: string) {
    await this.findOne(id);
    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });

    await this.auditLog.record({
      userId,
      action: 'PATIENT_UPDATED',
    });

    return patient;
  }

  async dischargeAdmission(id: string, userId: string) {
    const admission = await this.prisma.patientAdmission.findUnique({ where: { id } });
    if (!admission) throw new NotFoundException('Admission not found');
    const updated = await this.prisma.patientAdmission.update({
      where: { id },
      data: { dischargeDate: new Date() },
    });
    await this.auditLog.record({ userId, action: 'REGISTER_PATIENT' });
    return updated;
  }

  async addConsultingPhysician(admissionId: string, physicianId: string, nurseId: string) {
    const admission = await this.prisma.patientAdmission.findUnique({
      where: { id: admissionId },
      select: {
        dischargeDate: true,
        physicianId: true,
        additionalPhysicians: { select: { physicianId: true } },
      },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.dischargeDate) {
      throw new BadRequestException('Cannot add physicians to a discharged patient');
    }
    if (
      admission.physicianId === physicianId ||
      admission.additionalPhysicians.some((entry) => entry.physicianId === physicianId)
    ) {
      throw new BadRequestException('This physician is already on the care team');
    }

    const physician = await this.prisma.user.findFirst({
      where: { id: physicianId, role: Role.PHYSICIAN, isActive: true },
      select: { id: true },
    });
    if (!physician) throw new BadRequestException('Physician not found or inactive');

    const entry = await this.prisma.admissionPhysician.create({
      data: { admissionId, physicianId },
      select: { physician: { select: { id: true, firstName: true, lastName: true } } },
    });

    await this.auditLog.record({ userId: nurseId, action: 'PATIENT_UPDATED' });
    return entry;
  }
}
