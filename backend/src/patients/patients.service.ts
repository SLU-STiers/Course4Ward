import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // Nurse patient management: name, gender, initial assessment
  async create(dto: CreatePatientDto, nurseId: string) {
    const patient = await this.prisma.patient.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
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
  async findAssignedTo(userId: string) {
    return this.prisma.patient.findMany({
      where: {
        admissions: { some: { physicianId: userId, dischargeDate: null } },
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

}
