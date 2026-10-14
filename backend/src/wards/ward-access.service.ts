import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Requester = { id: string; role: Role };

/** The wards a nurse works in; `unroomed` = one of them holds patients without a room (Emergency, `holdsUnroomed`). */
export type NurseWards = { wardIds: Set<string>; unroomed: boolean };

/** Enough of an admission's room to tell which ward it is in. */
type RoomRef = { ward?: { id: string } | null } | null | undefined;

/** Whether an admission in `room` is in one of the nurse's wards. No room = the Emergency ward. */
export function inNurseWard(wards: NurseWards, room: RoomRef) {
  if (!room) return wards.unroomed;
  return !!room.ward && wards.wardIds.has(room.ward.id);
}

const NOT_YOUR_WARD = 'This patient is not in your assigned ward';

/**
 * Nurses see every patient's name, but full details only for patients whose
 * current (latest) admission is in a ward they are assigned to. Other roles
 * are not ward-limited.
 */
@Injectable()
export class WardAccessService {
  constructor(private prisma: PrismaService) {}

  async wardsOf(nurseId: string): Promise<NurseWards> {
    const rows = await this.prisma.nurseWard.findMany({
      where: { nurseId },
      select: { wardId: true, ward: { select: { holdsUnroomed: true } } },
    });
    return {
      wardIds: new Set(rows.map((row) => row.wardId)),
      unroomed: rows.some((row) => row.ward.holdsUnroomed),
    };
  }

  /**
   * Keeps nurse patient lists to names (+ where the patient is) outside the
   * nurse's wards. `admissions` must be newest first, each with its `room.ward`.
   */
  async redactPatients<
    P extends { id: string; firstName: string; lastName: string; admissions: { room?: RoomRef }[] },
  >(user: Requester, patients: P[]) {
    if (user.role !== Role.NURSE) return patients;
    const [wards, unroomedWard] = await Promise.all([
      this.wardsOf(user.id),
      this.prisma.ward.findFirst({ where: { holdsUnroomed: true }, select: { name: true } }),
    ]);
    return patients.map((patient) => {
      const room = patient.admissions[0]?.room as
        | { number: string; ward?: { id: string; name: string } | null }
        | null
        | undefined;
      if (inNurseWard(wards, room)) return { ...patient, restricted: false };
      return {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        restricted: true,
        wardName: room ? room.ward?.name ?? null : unroomedWard?.name ?? null,
        roomNumber: room?.number ?? null,
        admissions: [],
      };
    });
  }

  /** 403 unless a nurse's ward holds the patient's latest admission. */
  async assertPatient(user: Requester, patientId: string) {
    if (user.role !== Role.NURSE) return;
    const latest = await this.prisma.patientAdmission.findFirst({
      where: { patientId },
      orderBy: { admissionDate: 'desc' },
      select: { room: { select: { ward: { select: { id: true } } } } },
    });
    if (!latest) return; // unknown patient / no admission: the handler reports it
    if (!inNurseWard(await this.wardsOf(user.id), latest.room)) {
      throw new ForbiddenException(NOT_YOUR_WARD);
    }
  }

  /** 403 unless a nurse's ward holds this admission. */
  async assertAdmission(user: Requester, admissionId: string) {
    if (user.role !== Role.NURSE) return;
    const admission = await this.prisma.patientAdmission.findUnique({
      where: { id: admissionId },
      select: { room: { select: { ward: { select: { id: true } } } } },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    if (!inNurseWard(await this.wardsOf(user.id), admission.room)) {
      throw new ForbiddenException(NOT_YOUR_WARD);
    }
  }

  /** 403 unless a nurse's ward holds the admission this order belongs to. */
  async assertOrder(user: Requester, orderId: string) {
    if (user.role !== Role.NURSE) return;
    const order = await this.prisma.physicianOrder.findUnique({
      where: { id: orderId },
      select: { admissionId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.assertAdmission(user, order.admissionId);
  }
}
