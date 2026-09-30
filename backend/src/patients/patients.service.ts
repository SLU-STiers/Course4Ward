import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InsuranceType, OrderEnteredBy, OrderType, PatientClass, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

function buildTriage(dto: CreatePatientDto, nurseId: string) {
  const [bpSystolic, bpDiastolic] = dto.bp ? dto.bp.split('/').map(Number) : [undefined, undefined];
  const triage = {
    triageLevel: dto.triageLevel,
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
    triageLevel: true,
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

/** Human wording of each class, for error messages. */
const CLASS_LABEL: Record<PatientClass, string> = {
  EMERGENCY: 'an emergency patient',
  OUTPATIENT: 'an outpatient',
  OBSERVATION: 'under observation',
  INPATIENT: 'admitted',
};

const ORDER_LABEL: Partial<Record<OrderType, string>> = {
  ADMISSION: 'admission order',
  OBSERVATION: 'observation order',
};

/** The physician order a class needs: at registration or to move into it. */
const CLASS_ORDER: Record<PatientClass, OrderType | null> = {
  EMERGENCY: null,
  OUTPATIENT: null,
  OBSERVATION: OrderType.OBSERVATION,
  INPATIENT: OrderType.ADMISSION,
};

/** Which classes a patient may be moved into a class from. */
const CLASS_TRANSITIONS: Record<PatientClass, PatientClass[]> = {
  EMERGENCY: [],
  OUTPATIENT: [],
  OBSERVATION: [PatientClass.EMERGENCY, PatientClass.OUTPATIENT],
  INPATIENT: [PatientClass.EMERGENCY, PatientClass.OUTPATIENT, PatientClass.OBSERVATION],
};

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

  // Nurse patient management: demographics + admission. New patients default
  // to OUTPATIENT (the nurse form no longer offers EMERGENCY); EMERGENCY and
  // OUTPATIENT registrations need no order. OBSERVATION and INPATIENT (direct
  // admission, trauma, scheduled surgery) are physician decisions, so the
  // nurse enters the physician's order on their behalf in the same request.
  async create(dto: CreatePatientDto, nurseId: string) {
    const patientClass = dto.patientClass ?? PatientClass.OUTPATIENT;
    const orderType = CLASS_ORDER[patientClass];
    const registrationOrder = dto.registrationOrder?.trim();
    if (orderType && !registrationOrder) {
      throw new BadRequestException(
        `Registering a patient as ${CLASS_LABEL[patientClass]} needs the physician's ${ORDER_LABEL[orderType]}`,
      );
    }
    if (!orderType && (registrationOrder || dto.registrationOrderChannel)) {
      throw new BadRequestException(
        `No order is entered when registering a patient as ${CLASS_LABEL[patientClass]}`,
      );
    }

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

    const admissionDate = dto.admissionDate ? new Date(dto.admissionDate) : new Date();
    const initialAssessment = (dto.notes ?? dto.initialAssessment ?? '').trim() || null;
    const triage = buildTriage(dto, nurseId);

    const patient = await this.prisma.patient.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        gender: dto.gender,
        dateOfBirth: resolveDateOfBirth(dto),
        contactNumber: dto.contactNumber || null,
        address: dto.address || null,
        insurance: dto.insurance ?? null,
        insuranceOther: dto.insurance === InsuranceType.OTHER ? dto.insuranceOther || null : null,
        religion: dto.religion || null,
        contactPersonName: dto.contactPersonName || null,
        contactPersonNumber: dto.contactPersonNumber || null,
        contactPersonAddress: dto.contactPersonAddress || null,
        admissions: {
          create: {
            admissionDate,
            patientClass,
            classSince: admissionDate,
            initialAssessment,
            physicianId: dto.physicianId,
            additionalPhysicians: additionalPhysicianIds.length
              ? { create: additionalPhysicianIds.map((physicianId) => ({ physicianId })) }
              : undefined,
            triage: triage ? { create: triage } : undefined,
            // Created in the same write, so an observation / inpatient stay
            // never exists without the order behind it.
            orders: orderType
              ? {
                  create: {
                    orderContent: registrationOrder!,
                    type: orderType,
                    orderedById: dto.physicianId,
                    encodedById: nurseId,
                    enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
                    communicationChannel: dto.registrationOrderChannel ?? null,
                  },
                }
              : undefined,
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
            patientClass: true,
            classSince: true,
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
    if (orderType) {
      await this.auditLog.record({ userId: nurseId, action: 'ORDER_CREATED' });
    }

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
                  patientClass: true,
                  classSince: true,
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
                  patientClass: true,
                  classSince: true,
                  // Physicians see the priority, not the full vitals row.
                  triage: { select: { triageLevel: true } },
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
            patientClass: true,
            classSince: true,
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

  /** Whether a physician has written an active order of `type` for this admission. */
  private async hasActiveOrder(admissionId: string, type: OrderType) {
    const count = await this.prisma.physicianOrder.count({
      where: { admissionId, type, active: true },
    });
    return count > 0;
  }

  // The nurse formally discharges the patient once a physician has written the
  // discharge order. An outpatient visit is simply ended: clinic visits have
  // no discharge order.
  async dischargeAdmission(id: string, userId: string) {
    const admission = await this.prisma.patientAdmission.findUnique({ where: { id } });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.dischargeDate) {
      throw new ConflictException('This patient is already discharged');
    }
    if (
      admission.patientClass !== PatientClass.OUTPATIENT &&
      !(await this.hasActiveOrder(id, OrderType.DISCHARGE))
    ) {
      throw new BadRequestException(
        'A physician must write a discharge order before the patient can be discharged',
      );
    }

    // Guarded so two nurses discharging at once cannot move the date.
    const dischargeDate = new Date();
    const { count } = await this.prisma.patientAdmission.updateMany({
      where: { id, dischargeDate: null },
      data: { dischargeDate },
    });
    if (count === 0) throw new ConflictException('This patient is already discharged');

    await this.auditLog.record({ userId, action: 'REGISTER_PATIENT' });
    return { ...admission, dischargeDate };
  }

  // Emergency / outpatient / observation -> inpatient, once a physician has
  // written the admission order.
  admitAdmission(id: string, userId: string) {
    return this.changeClass(id, userId, PatientClass.INPATIENT);
  }

  // Emergency / outpatient -> observation, once a physician has written the
  // observation order.
  observeAdmission(id: string, userId: string) {
    return this.changeClass(id, userId, PatientClass.OBSERVATION);
  }

  /**
   * The nurse carries out a physician's admission / observation order. Only
   * the transitions in CLASS_TRANSITIONS exist, each needs an active order of
   * the matching type, and the update is guarded on the current class so two
   * nurses acting at once cannot both apply it.
   */
  private async changeClass(id: string, userId: string, target: PatientClass) {
    const admission = await this.prisma.patientAdmission.findUnique({ where: { id } });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.dischargeDate) {
      throw new BadRequestException('This patient is already discharged');
    }
    if (admission.patientClass === target) {
      throw new ConflictException(`This patient is already ${CLASS_LABEL[target]}`);
    }
    if (!CLASS_TRANSITIONS[target].includes(admission.patientClass)) {
      throw new BadRequestException(
        `A patient who is ${CLASS_LABEL[admission.patientClass]} cannot be ${
          target === PatientClass.OBSERVATION ? 'placed under observation' : 'admitted'
        }`,
      );
    }
    const orderType = CLASS_ORDER[target]!;
    if (!(await this.hasActiveOrder(id, orderType))) {
      throw new BadRequestException(
        `A physician must write an ${ORDER_LABEL[orderType]} first`,
      );
    }

    const classSince = new Date();
    const { count } = await this.prisma.patientAdmission.updateMany({
      where: { id, patientClass: admission.patientClass, dischargeDate: null },
      data: { patientClass: target, classSince },
    });
    if (count === 0) {
      throw new ConflictException('This patient was updated by someone else; reload and try again');
    }

    await this.auditLog.record({ userId, action: 'PATIENT_UPDATED' });
    return { ...admission, patientClass: target, classSince };
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
