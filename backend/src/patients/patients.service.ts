import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/types/domain';
import { DatabaseService } from '../database/database.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    private database: DatabaseService,
    private auditLog: AuditLogService,
  ) {}

  // Nurse patient management: name, gender, initial assessment
  async create(dto: CreatePatientDto, nurseId: string) {
    const patient = await this.database.patient.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        dateOfBirth: new Date(dto.dateOfBirth),
        initialAssessment: dto.initialAssessment,
        admissionDate: new Date(),
      },
    });

    await this.database.patientAssignment.create({
      data: { patientId: patient.id, userId: nurseId, role: Role.NURSE },
    });

    await this.auditLog.record({
      userId: nurseId,
      action: 'PATIENT_CREATED',
      entityType: 'Patient',
      entityId: patient.id,
    });

    return patient;
  }

  // "Find and view the patient they are currently handling" -- scoped to
  // the requesting physician/nurse's active assignments.
  async findAssignedTo(userId: string) {
    return this.database.patient.findMany({
      where: {
        assignments: { some: { userId, active: true } },
      },
      orderBy: { admissionDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const patient = await this.database.patient.findUnique({
      where: { id },
      include: {
        orders: { orderBy: { orderDate: 'desc' }, take: 20 },
        notes: { orderBy: { createdAt: 'desc' }, take: 20 },
        coursesInWard: { orderBy: { summaryDate: 'desc' }, take: 10 },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, userId: string) {
    await this.findOne(id);
    const patient = await this.database.patient.update({
      where: { id },
      data: {
        initialAssessment: dto.initialAssessment,
        admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : undefined,
        dischargeDate: dto.dischargeDate ? new Date(dto.dischargeDate) : undefined,
      },
    });

    await this.auditLog.record({
      userId,
      action: 'PATIENT_UPDATED',
      entityType: 'Patient',
      entityId: id,
      metadata: dto as any,
    });

    return patient;
  }

  async assignStaff(patientId: string, staffUserId: string, role: Role) {
    return this.database.patientAssignment.create({
      data: { patientId, userId: staffUserId, role },
    });
  }
}
