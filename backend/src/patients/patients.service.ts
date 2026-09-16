import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

function buildInitialAssessment(dto: CreatePatientDto): string | null {
  const vitals = [
    dto.triageTime ? `Time: ${dto.triageTime}` : null,
    dto.heartRate ? `HR: ${dto.heartRate}` : null,
    dto.respRate ? `RR: ${dto.respRate}` : null,
    dto.spo2 ? `SpO2: ${dto.spo2}` : null,
    dto.bp ? `BP: ${dto.bp}` : null,
    dto.temp ? `Temp: ${dto.temp}` : null,
    dto.pain ? `Pain: ${dto.pain}` : null,
  ].filter(Boolean);

  const notes = (dto.notes ?? dto.initialAssessment ?? '').trim();
  const parts: string[] = [];
  if (vitals.length) parts.push(`Triage — ${vitals.join(', ')}`);
  if (notes) parts.push(notes);
  return parts.length ? parts.join('\n') : null;
}

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
    if (dto.physicianId) {
      const physician = await this.prisma.user.findFirst({
        where: { id: dto.physicianId, role: Role.PHYSICIAN, isActive: true },
      });
      if (!physician) {
        throw new BadRequestException('Assigned physician not found or inactive');
      }
    }

    const isOutpatient =
      dto.admissionStatus === 'ER_OUTPATIENT'
        ? true
        : dto.admissionStatus === 'ADMITTED'
          ? false
          : Boolean(dto.isOutpatient);

    const admissionDate = dto.admissionDate ? new Date(dto.admissionDate) : new Date();
    const initialAssessment = buildInitialAssessment(dto);

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
            physicianId: dto.physicianId || null,
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
    return this.prisma.patient.findMany({
      where: { admissions: { some: nurseScope ? {} : { physicianId: userId } } },
      include: {
        admissions: {
          ...(nurseScope ? {} : { where: { physicianId: userId } }),
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
}
