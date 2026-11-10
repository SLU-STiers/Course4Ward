import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InsuranceType, OrderEnteredBy, OrderStatus, OrderType, PatientClass, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditLogService,
  dayLabel,
  detailItems,
  fullName,
} from '../audit-log/audit-log.service';
import { CreatePatientDto, ReadmitPatientDto, UpdatePatientDto } from './dto/patient.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CourseInWardService } from '../course-in-ward/course-in-ward.service';
import { WardAccessService } from '../wards/ward-access.service';

function buildTriage(dto: ReadmitPatientDto, nurseId: string) {
  const [bpSystolic, bpDiastolic] = dto.bp ? dto.bp.split('/').map(Number) : [undefined, undefined];
  const triage = {
    triageLevel: dto.triageLevel,
    triageDate: dto.triageDate ? new Date(`${dto.triageDate}T00:00:00.000Z`) : undefined,
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

/**
 * The triage assessment every clinical role reads: nurses, physicians and
 * (through the claim's admission) claims processors.
 */
export const triageSelect = {
  select: {
    triageLevel: true,
    triageDate: true,
    triageTime: true,
    heartRate: true,
    respRate: true,
    spo2: true,
    bpSystolic: true,
    bpDiastolic: true,
    temperature: true,
    painScore: true,
    createdAt: true,
    recordedBy: { select: { firstName: true, lastName: true } },
  },
};

const roomSelect = {
  select: { id: true, number: true, ward: { select: { id: true, name: true } } },
};

/** Room checks and writes run serializably so two nurses cannot take the same room at once. */
const ROOM_TX = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

const additionalPhysiciansSelect = {
  orderBy: { createdAt: 'asc' as const },
  select: { createdAt: true, physician: { select: { id: true, firstName: true, lastName: true } } },
};

const MAX_AGE_YEARS = 130;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A `YYYY-MM-DD` date of birth that exists, is not in the future and is within 130 years. */
function parseDateOfBirth(value: string): Date {
  const dob = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Date of birth must be a real date');
  }
  const now = new Date();
  if (dob.getTime() > now.getTime()) {
    throw new BadRequestException('Date of birth cannot be in the future');
  }
  const oldest = new Date(now);
  oldest.setUTCFullYear(now.getUTCFullYear() - MAX_AGE_YEARS);
  if (dob.getTime() < oldest.getTime()) {
    throw new BadRequestException(`Date of birth cannot be more than ${MAX_AGE_YEARS} years ago`);
  }
  return dob;
}

/** The admissions a registration / re-admission returns, newest first. */
const registeredAdmissions = {
  orderBy: { admissionDate: 'desc' as const },
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
    room: roomSelect,
  },
};

/** Optional text fields: '' or null clears them, undefined keeps them. */
const blankToNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/** Patient detail fields, in the order the activity log lists their changes. */
const DETAIL_LABELS = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  gender: 'Sex',
  dateOfBirth: 'Date of birth',
  contactNumber: 'Contact number',
  address: 'Address',
  insurance: 'Insurance',
  insuranceOther: 'Insurance (other)',
  religion: 'Religion',
  contactPersonName: 'Contact person',
  contactPersonNumber: 'Contact person number',
  contactPersonAddress: 'Contact person address',
} as const;

/** Human wording of each class, for error messages. */
const CLASS_LABEL: Record<PatientClass, string> = {
  EMERGENCY: 'an emergency patient',
  OUTPATIENT: 'an outpatient',
  OBSERVATION: 'under observation',
  INPATIENT: 'admitted',
};

/** Class names as the activity log shows them. */
const CLASS_NAME: Record<PatientClass, string> = {
  EMERGENCY: 'Emergency',
  OUTPATIENT: 'Outpatient',
  OBSERVATION: 'Observation',
  INPATIENT: 'Inpatient',
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
    private notifications: NotificationsService,
    private courseInWard: CourseInWardService,
    private wardAccess: WardAccessService,
  ) {}

  /** Physicians available for nurse assignment, including their ward specialties. */
  async listPhysicians() {
    const physicians = await this.prisma.user.findMany({
      where: { role: Role.PHYSICIAN, isActive: true },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        physicianWards: { select: { ward: { select: { id: true, name: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return physicians.map(({ physicianWards, ...physician }) => ({
      ...physician,
      wards: physicianWards,
    }));
  }

  // Nurse patient management: demographics + admission. New patients default
  // to OUTPATIENT (the nurse form no longer offers EMERGENCY); EMERGENCY and
  // OUTPATIENT registrations need no order. OBSERVATION and INPATIENT (direct
  // admission, trauma, scheduled surgery) are physician decisions, so the
  // nurse enters the physician's order on their behalf in the same request.
  async create(dto: CreatePatientDto, nurseId: string) {
    const dateOfBirth = parseDateOfBirth(dto.dateOfBirth);
    await this.assertNotRegistered(dto, dateOfBirth);
    const plan = await this.planAdmission(dto, nurseId);

    const createPatient = (db: Prisma.TransactionClient, roomId: string | null) => db.patient.create({
      data: {
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim() || null,
        lastName: dto.lastName.trim(),
        gender: dto.gender,
        dateOfBirth,
        contactNumber: dto.contactNumber || null,
        address: dto.address || null,
        insurance: dto.insurance ?? null,
        insuranceOther: dto.insurance === InsuranceType.OTHER ? dto.insuranceOther || null : null,
        religion: dto.religion || null,
        contactPersonName: dto.contactPersonName || null,
        contactPersonNumber: dto.contactPersonNumber || null,
        contactPersonAddress: dto.contactPersonAddress || null,
        admissions: { create: this.admissionData(plan, dto, nurseId, roomId) },
      },
      include: { admissions: registeredAdmissions },
    });

    const roomNumber = dto.roomNumber;
    const patient = roomNumber
      ? await this.inRoomTransaction(async (tx) =>
          createPatient(tx, await this.freeRoomId(tx, roomNumber, nurseId)),
        )
      : await createPatient(this.prisma, null);

    const patientName = fullName(patient);
    const { attending, consultants } = await this.careTeamLabels(dto.physicianId, plan.additionalPhysicianIds);
    await this.auditLog.record({
      userId: nurseId,
      action: 'PATIENT_CREATED',
      details: {
        summary: `Registered ${patientName} as ${CLASS_NAME[plan.patientClass]}`,
        items: detailItems([
          ['Patient', patientName],
          ['Sex', dto.gender],
          ['Date of birth', dayLabel(dateOfBirth)],
          ['Class', CLASS_NAME[plan.patientClass]],
          ['Admission date', dayLabel(plan.admissionDate)],
          ['Attending physician', attending],
          ['Additional physicians', consultants.join(', ')],
          ['Room', dto.roomNumber],
          ['Insurance', dto.insurance === InsuranceType.OTHER ? dto.insuranceOther : dto.insurance],
          ['Religion', dto.religion],
          ['Triage level', dto.triageLevel],
          ['Initial assessment', plan.initialAssessment],
        ]),
      },
    });
    await this.announceAdmission(patientName, plan, dto, nurseId, attending, 'registered');

    return patient;
  }

  /**
   * A new stay for a patient who is already registered, so a returning
   * patient keeps one record instead of a new one per visit. Only once their
   * previous stay has ended.
   */
  async readmit(patientId: string, dto: ReadmitPatientDto, nurseId: string) {
    const plan = await this.planAdmission(dto, nurseId);

    await this.inRoomTransaction(async (tx) => {
      const patient = await tx.patient.findUnique({
        where: { id: patientId },
        select: {
          firstName: true,
          lastName: true,
          admissions: { where: { dischargeDate: null }, select: { id: true }, take: 1 },
        },
      });
      if (!patient) throw new NotFoundException('Patient not found');
      if (patient.admissions.length) {
        throw new ConflictException(
          `${fullName(patient)} is still admitted; discharge the current stay before re-admitting them`,
        );
      }
      const roomId = dto.roomNumber ? await this.freeRoomId(tx, dto.roomNumber, nurseId) : null;
      await tx.patientAdmission.create({
        data: { patientId, ...this.admissionData(plan, dto, nurseId, roomId) },
      });
    });

    const patient = await this.prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      include: { admissions: registeredAdmissions },
    });
    const patientName = fullName(patient);
    const { attending, consultants } = await this.careTeamLabels(dto.physicianId, plan.additionalPhysicianIds);
    await this.auditLog.record({
      userId: nurseId,
      action: 'REGISTER_PATIENT',
      details: {
        summary: `Re-admitted ${patientName} as ${CLASS_NAME[plan.patientClass]}`,
        items: detailItems([
          ['Patient', patientName],
          ['Class', CLASS_NAME[plan.patientClass]],
          ['Admission date', dayLabel(plan.admissionDate)],
          ['Attending physician', attending],
          ['Additional physicians', consultants.join(', ')],
          ['Room', dto.roomNumber],
          ['Triage level', dto.triageLevel],
          ['Initial assessment', plan.initialAssessment],
        ]),
      },
    });
    await this.announceAdmission(patientName, plan, dto, nurseId, attending, 're-admitted');

    return patient;
  }

  /**
   * 409 when this person is already registered: same first and last name
   * (any case) and the same date of birth, and no differing middle name. The
   * response carries the existing record's id so the nurse can re-admit it.
   */
  private async assertNotRegistered(
    person: { firstName: string; middleName?: string | null; lastName: string },
    dateOfBirth: Date,
    exceptPatientId?: string,
  ) {
    const candidates = await this.prisma.patient.findMany({
      where: {
        ...(exceptPatientId ? { id: { not: exceptPatientId } } : {}),
        firstName: { equals: person.firstName.trim(), mode: 'insensitive' },
        lastName: { equals: person.lastName.trim(), mode: 'insensitive' },
        dateOfBirth: { gte: dateOfBirth, lt: new Date(dateOfBirth.getTime() + DAY_MS) },
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        admissions: { where: { dischargeDate: null }, select: { id: true }, take: 1 },
      },
    });
    const middle = person.middleName?.trim().toLowerCase();
    const match = candidates.find(
      (candidate) => !middle || !candidate.middleName || candidate.middleName.toLowerCase() === middle,
    );
    if (!match) return;

    const admitted = match.admissions.length > 0;
    const who = `${fullName(match)} (born ${dayLabel(dateOfBirth)})`;
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'PATIENT_ALREADY_REGISTERED',
      message: admitted
        ? `${who} is already registered and is still admitted`
        : `${who} is already registered. Re-admit the existing record instead of registering them again`,
      existingPatientId: match.id,
      admitted,
    });
  }

  /**
   * Checks the admission part of a registration / re-admission: the class and
   * its order, and that the care team is active physicians.
   */
  private async planAdmission(dto: ReadmitPatientDto, nurseId: string) {
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
    if (dto.roomNumber && patientClass !== PatientClass.INPATIENT) {
      throw new BadRequestException('A room can only be assigned to an admitted patient');
    }
    // A patient without a room is in the Emergency ward; registering one
    // there would lock out a nurse who does not work in it.
    if (!dto.roomNumber && !(await this.wardAccess.wardsOf(nurseId)).unroomed) {
      throw new BadRequestException(
        'Choose a room in your ward. Patients without a room go to the Emergency ward, which is not one of your wards',
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

    return {
      patientClass,
      orderType,
      registrationOrder,
      additionalPhysicianIds,
      requiredIds,
      admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : new Date(),
      initialAssessment: (dto.notes ?? dto.initialAssessment ?? '').trim() || null,
    };
  }

  private admissionData(
    plan: Awaited<ReturnType<PatientsService['planAdmission']>>,
    dto: ReadmitPatientDto,
    nurseId: string,
    roomId: string | null,
  ) {
    const triage = buildTriage(dto, nurseId);
    return {
      admissionDate: plan.admissionDate,
      patientClass: plan.patientClass,
      classSince: plan.admissionDate,
      initialAssessment: plan.initialAssessment,
      physicianId: dto.physicianId,
      roomId,
      additionalPhysicians: plan.additionalPhysicianIds.length
        ? { create: plan.additionalPhysicianIds.map((physicianId) => ({ physicianId })) }
        : undefined,
      triage: triage ? { create: triage } : undefined,
      // Created in the same write, so an observation / inpatient stay
      // never exists without the order behind it.
      orders: plan.orderType
        ? {
            create: {
              orderContent: plan.registrationOrder!,
              type: plan.orderType,
              orderedById: dto.physicianId,
              encodedById: nurseId,
              enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
              communicationChannel: dto.registrationOrderChannel ?? null,
            },
          }
        : undefined,
    };
  }

  private async careTeamLabels(physicianId: string, additionalPhysicianIds: string[]) {
    const [attending, ...consultants] = await Promise.all(
      [physicianId, ...additionalPhysicianIds].map((id) => this.auditLog.userLabel(id)),
    );
    return { attending, consultants };
  }

  /** Logs the order entered with the admission and tells the admins and the care team. */
  private async announceAdmission(
    patientName: string,
    plan: Awaited<ReturnType<PatientsService['planAdmission']>>,
    dto: ReadmitPatientDto,
    nurseId: string,
    attending: string,
    verb: 'registered' | 're-admitted',
  ) {
    if (plan.orderType) {
      await this.auditLog.record({
        userId: nurseId,
        action: 'ORDER_CREATED',
        details: {
          summary: `Entered ${attending}'s ${ORDER_LABEL[plan.orderType]} for ${patientName}`,
          items: detailItems([
            ['Patient', patientName],
            ['Ordering physician', attending],
            ['Order type', ORDER_LABEL[plan.orderType]],
            ['Order', plan.registrationOrder],
            ['Received via', dto.registrationOrderChannel],
          ]),
        },
      });
    }

    const className = CLASS_NAME[plan.patientClass];
    await Promise.all([
      this.notifications.notifyAdmins({
        title: verb === 'registered' ? 'New patient registered' : 'Patient re-admitted',
        message: `**${patientName}** was ${verb} as ${className}.`,
      }),
      this.notifications.notifyUsers(plan.requiredIds, {
        title: 'New patient assigned to your care',
        message: `**${patientName}** was ${verb} as ${className} and assigned to your care team.`,
      }),
    ]);
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
                  room: roomSelect,
                },
              }
            : {
                select: {
                  id: true,
                  admissionDate: true,
                  dischargeDate: true,
                  patientClass: true,
                  classSince: true,
                  initialAssessment: true,
                  // Lets the physician UI tell attending from consultant.
                  physicianId: true,
                  triage: triageSelect,
                  room: roomSelect,
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
            room: roomSelect,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Active rooms in the nurse's wards, each flagged as occupied while an
   * undischarged admission holds it. A room elsewhere would put the patient
   * out of the nurse's reach.
   */
  async listRooms(nurseId: string) {
    const { wardIds } = await this.wardAccess.wardsOf(nurseId);
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true, wardId: { in: [...wardIds] } },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        ward: { select: { id: true, name: true } },
        admissions: { where: { dischargeDate: null }, select: { id: true }, take: 1 },
      },
    });
    return rooms.map(({ admissions, ...room }) => ({
      ...room,
      occupied: admissions.length > 0,
      occupiedByAdmissionId: admissions[0]?.id ?? null,
    }));
  }

  /** Assigns an admitted patient to a free room, moves them to another, or clears it (`null`). */
  async assignRoom(admissionId: string, roomNumber: string | null, userId: string) {
    const admission = await this.inRoomTransaction(async (tx) => {
      const current = await tx.patientAdmission.findUnique({
        where: { id: admissionId },
        select: { dischargeDate: true, patientClass: true, room: { select: { number: true } } },
      });
      if (!current) throw new NotFoundException('Admission not found');
      if (current.dischargeDate) {
        throw new BadRequestException('Cannot assign a room to a discharged patient');
      }
      if (current.patientClass !== PatientClass.INPATIENT) {
        throw new BadRequestException('A room can only be assigned to an admitted patient');
      }
      const roomId = roomNumber ? await this.freeRoomId(tx, roomNumber, userId, admissionId) : null;
      const updated = await tx.patientAdmission.update({
        where: { id: admissionId },
        data: { roomId },
        select: { id: true, room: roomSelect },
      });
      return { updated, previousRoom: current.room?.number ?? null };
    });

    const patientName = await this.auditLog.patientName({ admissionId });
    const { updated, previousRoom } = admission;
    await this.auditLog.record({
      userId,
      action: 'PATIENT_UPDATED',
      details: {
        summary: roomNumber
          ? previousRoom
            ? `Moved ${patientName} from room ${previousRoom} to room ${roomNumber}`
            : `Assigned ${patientName} to room ${roomNumber}`
          : `Removed ${patientName} from room ${previousRoom ?? '—'}`,
        items: detailItems([['Patient', patientName]]),
        changes: [{ field: 'Room', from: previousRoom ?? 'None', to: roomNumber ?? 'None' }],
      },
    });
    return updated;
  }

  /**
   * The id of room `number`, if it exists, is in one of the nurse's wards and
   * no other undischarged admission holds it.
   */
  private async freeRoomId(
    tx: Prisma.TransactionClient,
    number: string,
    nurseId: string,
    exceptAdmissionId?: string,
  ) {
    const room = await tx.room.findUnique({
      where: { number },
      select: {
        id: true,
        isActive: true,
        ward: { select: { id: true, name: true } },
        admissions: {
          where: {
            dischargeDate: null,
            ...(exceptAdmissionId ? { id: { not: exceptAdmissionId } } : {}),
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!room || !room.isActive) throw new NotFoundException(`Room ${number} does not exist`);
    const { wardIds } = await this.wardAccess.wardsOf(nurseId);
    if (!room.ward || !wardIds.has(room.ward.id)) {
      throw new ForbiddenException(
        `Room ${number} is in ${room.ward?.name ?? 'no ward'}, which is not one of your wards`,
      );
    }
    if (room.admissions.length) throw new ConflictException(`Room ${number} is occupied`);
    return room.id;
  }

  private async inRoomTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await this.prisma.$transaction(fn, ROOM_TX);
    } catch (error) {
      if (isSerializationFailure(error)) {
        throw new ConflictException('That room was just taken by another patient; choose another room');
      }
      throw error;
    }
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

  /** Corrects a registered patient's own details (name, contact, insurance, ...), e.g. a typo at registration. */
  async update(id: string, dto: UpdatePatientDto, userId: string) {
    const existing = await this.prisma.patient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Patient not found');

    const insurance = dto.insurance === undefined ? undefined : dto.insurance ?? null;
    const nextInsurance = insurance === undefined ? existing.insurance : insurance;
    const insuranceOther =
      nextInsurance === InsuranceType.OTHER
        ? blankToNull(dto.insuranceOther)
        : existing.insuranceOther
          ? null
          : undefined;
    if (
      nextInsurance === InsuranceType.OTHER &&
      (insuranceOther === null || (insuranceOther === undefined && !existing.insuranceOther))
    ) {
      throw new BadRequestException('Please specify the insurance when "Other" is selected');
    }

    const data = {
      firstName: dto.firstName?.trim() || undefined,
      middleName: blankToNull(dto.middleName),
      lastName: dto.lastName?.trim() || undefined,
      gender: dto.gender ?? undefined,
      dateOfBirth: dto.dateOfBirth ? parseDateOfBirth(dto.dateOfBirth) : undefined,
      contactNumber: blankToNull(dto.contactNumber),
      address: blankToNull(dto.address),
      insurance,
      insuranceOther,
      religion: blankToNull(dto.religion),
      contactPersonName: blankToNull(dto.contactPersonName),
      contactPersonNumber: blankToNull(dto.contactPersonNumber),
      contactPersonAddress: blankToNull(dto.contactPersonAddress),
    };

    const identityChanged =
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.middleName !== undefined ||
      data.dateOfBirth !== undefined;
    const dateOfBirth = data.dateOfBirth ?? existing.dateOfBirth;
    if (identityChanged && dateOfBirth) {
      await this.assertNotRegistered(
        {
          firstName: data.firstName ?? existing.firstName,
          middleName: data.middleName === undefined ? existing.middleName : data.middleName,
          lastName: data.lastName ?? existing.lastName,
        },
        dateOfBirth,
        id,
      );
    }

    const patient = await this.prisma.patient.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      ) as Prisma.PatientUpdateInput,
    });

    const shown = (value: unknown) =>
      value instanceof Date ? dayLabel(value) : value === null || value === '' ? '—' : String(value);
    const changes = (Object.keys(DETAIL_LABELS) as (keyof typeof DETAIL_LABELS)[])
      .map((key) => ({ field: DETAIL_LABELS[key], from: shown(existing[key]), to: shown(patient[key]) }))
      .filter((change) => change.from !== change.to);
    await this.auditLog.record({
      userId,
      action: 'PATIENT_UPDATED',
      details: {
        summary: changes.length
          ? `Updated ${fullName(patient)}'s ${changes.map((change) => change.field.toLowerCase()).join(', ')}`
          : `Saved ${fullName(patient)}'s details with no changes`,
        items: detailItems([['Patient', fullName(patient)]]),
        changes,
      },
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
    if (admission.patientClass !== PatientClass.OUTPATIENT) {
      const dischargeOrder = await this.prisma.physicianOrder.findFirst({
        where: { admissionId: id, type: OrderType.DISCHARGE, active: true },
        orderBy: { dateCreated: 'desc' },
      });
      if (!dischargeOrder) {
        throw new BadRequestException(
          'A physician must write a discharge order before the patient can be discharged',
        );
      }
      if (dischargeOrder.status !== OrderStatus.FINISHED || !dischargeOrder.nurseComment) {
        throw new BadRequestException(
          'Mark the discharge order done and add a note before discharging this patient',
        );
      }
      const unfinished = await this.prisma.physicianOrder.count({
        where: {
          admissionId: id,
          active: true,
          id: { not: dischargeOrder.id },
          dateCreated: { lte: dischargeOrder.dateCreated },
          status: { not: OrderStatus.FINISHED },
        },
      });
      if (unfinished > 0) {
        throw new BadRequestException(
          'Finish every order written before the discharge order before this patient can be discharged',
        );
      }
    }

    // Guarded so two nurses discharging at once cannot move the date.
    const dischargeDate = new Date();
    const { count } = await this.prisma.patientAdmission.updateMany({
      where: { id, dischargeDate: null },
      data: { dischargeDate },
    });
    if (count === 0) throw new ConflictException('This patient is already discharged');

    const patientName = await this.auditLog.patientName({ patientId: admission.patientId });
    await this.auditLog.record({
      userId,
      action: 'PATIENT_DISCHARGED',
      details: {
        summary:
          admission.patientClass === PatientClass.OUTPATIENT
            ? `Ended ${patientName}'s outpatient visit`
            : `Discharged ${patientName}`,
        items: detailItems([
          ['Patient', patientName],
          ['Class', CLASS_NAME[admission.patientClass]],
          ['Admitted', dayLabel(admission.admissionDate)],
          ['Discharged', dayLabel(dischargeDate)],
        ]),
      },
    });
    // Files the stay's Course in the Ward and sends it to Claims after the
    // discharge is saved, without holding the nurse's request.
    void this.courseInWard.prepareClaimForDischargedAdmission(id, userId);

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

    const patientName = await this.auditLog.patientName({ patientId: admission.patientId });
    await this.auditLog.record({
      userId,
      action: 'PATIENT_UPDATED',
      details: {
        summary:
          target === PatientClass.INPATIENT
            ? `Admitted ${patientName} as an inpatient`
            : `Placed ${patientName} under observation`,
        items: detailItems([
          ['Patient', patientName],
          ['Carried out', `Physician's ${ORDER_LABEL[orderType]}`],
        ]),
        changes: [
          { field: 'Class', from: CLASS_NAME[admission.patientClass], to: CLASS_NAME[target] },
        ],
      },
    });
    return { ...admission, patientClass: target, classSince };
  }

  /**
   * Hands the admission to another attending physician, e.g. when the current
   * one is leaving. Only the attending can write the discharge order, so a
   * patient whose attending is gone would otherwise never be discharged. A
   * consultant who becomes the attending leaves the consultant list.
   */
  async changeAttending(admissionId: string, physicianId: string, nurseId: string) {
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
      throw new BadRequestException('Cannot change the attending physician of a discharged patient');
    }
    if (admission.physicianId === physicianId) {
      throw new BadRequestException('This physician is already the attending physician');
    }
    const physician = await this.prisma.user.findFirst({
      where: { id: physicianId, role: Role.PHYSICIAN, isActive: true },
      select: { id: true },
    });
    if (!physician) throw new BadRequestException('Physician not found or inactive');

    const wasConsultant = admission.additionalPhysicians.some((entry) => entry.physicianId === physicianId);
    const { count } = await this.prisma.patientAdmission.updateMany({
      where: { id: admissionId, physicianId: admission.physicianId, dischargeDate: null },
      data: { physicianId },
    });
    if (count === 0) {
      throw new ConflictException('This patient was updated by someone else; reload and try again');
    }
    if (wasConsultant) {
      await this.prisma.admissionPhysician.deleteMany({ where: { admissionId, physicianId } });
    }

    const patientName = await this.auditLog.patientName({ admissionId });
    const [previous, next] = await Promise.all([
      this.auditLog.userLabel(admission.physicianId),
      this.auditLog.userLabel(physicianId),
    ]);
    await this.auditLog.record({
      userId: nurseId,
      action: 'PATIENT_UPDATED',
      details: {
        summary: `Changed ${patientName}'s attending physician to ${next}`,
        items: detailItems([['Patient', patientName]]),
        changes: [{ field: 'Attending physician', from: previous || '—', to: next }],
      },
    });
    await this.notifications.notifyUsers([physicianId], {
      title: 'You are now the attending physician',
      message: `You are now the attending physician of **${patientName}**.`,
    });
    return { admissionId, physicianId };
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
      select: { createdAt: true, physician: { select: { id: true, firstName: true, lastName: true } } },
    });

    const patientName = await this.auditLog.patientName({ admissionId });
    await this.auditLog.record({
      userId: nurseId,
      action: 'PATIENT_UPDATED',
      details: {
        summary: `Added Dr. ${fullName(entry.physician)} to ${patientName}'s care team`,
        items: detailItems([
          ['Patient', patientName],
          ['Physician added', await this.auditLog.userLabel(physicianId)],
          ['Attending physician', await this.auditLog.userLabel(admission.physicianId)],
        ]),
      },
    });
    return entry;
  }
}
