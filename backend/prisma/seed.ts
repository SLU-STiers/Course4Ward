import { PatientClass, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  admissionRooms as baseAdmissionRooms,
  admissions as baseAdmissions,
  approvalRequests,
  auditLogs,
  consultingPhysicians as baseConsultingPhysicians,
  coursesInWard,
  DEMO_PASSWORD,
  notes,
  nurseWards,
  orders as baseOrders,
  patientDetails as basePatientDetails,
  patients as basePatients,
  triageNurseUserIds,
  triages as baseTriages,
  userIdCounters,
  users,
} from './seed/data';
import {
  stayAdmissions,
  stayConsultants,
  stayOrders,
  stayPatientDetails,
  stayPatients,
  stayRooms,
  stayTriages,
} from './seed/wardStays';

// Base dataset plus the multi-day ward stays (seed/wardStays.ts).
const patients = [...basePatients, ...stayPatients];
const patientDetails = { ...basePatientDetails, ...stayPatientDetails };
const admissions = [...baseAdmissions, ...stayAdmissions];
const triages = { ...baseTriages, ...stayTriages };
const consultingPhysicians = { ...baseConsultingPhysicians, ...stayConsultants };
const orders = [...baseOrders, ...stayOrders];
const admissionRooms = { ...baseAdmissionRooms, ...stayRooms };

/**
 * Mock-data seed for local development.
 *
 * Runs automatically after `prisma migrate dev` / `prisma migrate reset`
 * (wired in package.json: `"prisma": { "seed": "ts-node prisma/seed.ts" }`),
 * or on demand with `npm run prisma:seed`. Every row is upserted by a fixed,
 * deterministic id, so the seed is idempotent and never wipes existing data.
 */
const prisma = new PrismaClient();

/** Assert a map lookup succeeded (strictNullChecks safety for FK ids). */
function must<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new Error(`Seed data references unknown ${label}`);
  }
  return value;
}

/** `YYYY-MM-DD` of an instant on the hospital's (Manila) calendar. */
function manilaDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1) Users — upsert by unique userId (DOC001 may already exist from older seeds).
  const userIds = new Map<string, string>();
  for (const u of users) {
    const fixedIdOwner = await prisma.user.findUnique({ where: { id: u.id } });
    const record = await prisma.user.upsert({
      where: { userId: u.userId },
      update: {},
      create: {
        ...(fixedIdOwner && fixedIdOwner.userId !== u.userId ? {} : { id: u.id }),
        userId: u.userId,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        passwordHash,
        isActive: true,
        mustResetPassword: false,
      },
    });
    userIds.set(u.userId, record.id);
  }

  // 1b) User-id counters. The migration that creates them runs before any
  // user exists, so it starts every role at 1; move each past the seeded ids
  // (and past any id already in the table) so "Add User" never collides.
  // Counters are only ever raised, keeping the seed safe to re-run.
  for (const c of userIdCounters) {
    const prefix = users.find((u) => u.role === c.role)?.userId.replace(/\d+$/, '');
    const taken = prefix
      ? await prisma.user.findMany({ where: { userId: { startsWith: prefix } }, select: { userId: true } })
      : [];
    const highest = taken.reduce((max, { userId }) => {
      const n = Number(userId.slice(prefix!.length));
      return Number.isInteger(n) ? Math.max(max, n) : max;
    }, 0);
    const current = await prisma.userIdCounter.findUnique({ where: { role: c.role } });
    const nextNumber = Math.max(c.nextNumber, highest + 1, current?.nextNumber ?? 1);
    await prisma.userIdCounter.upsert({
      where: { role: c.role },
      update: { nextNumber },
      create: { role: c.role, nextNumber },
    });
  }

  // 2) Patients — no natural unique key, so upsert by the fixed seed id.
  // Registration details also fill seeded rows from older seeds that lack them.
  const patientIds = new Map<string, string>();
  for (const p of patients) {
    const details = must(patientDetails[p.key], `details for patient '${p.key}'`);
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        dateOfBirth: p.dateOfBirth,
        ...details,
      },
    });
    await prisma.patient.updateMany({ where: { id: p.id, contactNumber: null }, data: details });
    patientIds.set(p.key, p.id);
  }

  // 3) Admissions, each with its triage (chief complaints lead the initial
  // assessment, as the nurse Add Patient form writes it) and consultants.
  const admissionIds = new Map<string, string>();
  for (const [index, a] of admissions.entries()) {
    const triage = must(triages[a.key], `triage for admission '${a.key}'`);
    const initialAssessment = `Chief complaint: ${triage.complaints.join(', ')}.\n\n${a.initialAssessment ?? ''}`.trim();
    await prisma.patientAdmission.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        patientId: must(patientIds.get(a.patientKey), `patient '${a.patientKey}'`),
        physicianId: must(userIds.get(a.physicianUserId), `physician '${a.physicianUserId}'`),
        admissionDate: a.admissionDate,
        dischargeDate: a.dischargeDate ?? null,
        patientClass: a.patientClass ?? PatientClass.INPATIENT,
        classSince: a.classSince ?? a.admissionDate,
        initialAssessment,
      },
    });
    // Older seeds stored the assessment without complaints; only that untouched text is replaced.
    if (a.initialAssessment) {
      await prisma.patientAdmission.updateMany({
        where: { id: a.id, initialAssessment: a.initialAssessment },
        data: { initialAssessment },
      });
    }
    await prisma.triageAssessment.upsert({
      where: { admissionId: a.id },
      update: {},
      create: {
        admissionId: a.id,
        triageLevel: triage.level,
        triageDate: new Date(`${manilaDateKey(a.admissionDate)}T00:00:00.000Z`),
        triageTime: triage.time,
        heartRate: triage.heartRate,
        respRate: triage.respRate,
        spo2: triage.spo2,
        bpSystolic: triage.bp[0],
        bpDiastolic: triage.bp[1],
        temperature: triage.temp,
        painScore: triage.pain,
        recordedById: must(
          userIds.get(triageNurseUserIds[index % triageNurseUserIds.length]),
          'triage nurse',
        ),
        createdAt: a.admissionDate,
      },
    });
    const consultants = consultingPhysicians[a.key] ?? [];
    await prisma.admissionPhysician.createMany({
      data: consultants.map((userId) => ({
        admissionId: a.id,
        physicianId: must(userIds.get(userId), `consultant '${userId}'`),
      })),
      skipDuplicates: true,
    });
    admissionIds.set(a.key, a.id);
  }

  // 4) Course in the Ward summaries (before orders, so orders can link via summarizationId).
  const courseIds = new Map<string, string>();
  for (const c of coursesInWard) {
    const approved = c.status === 'APPROVED';
    await prisma.courseInWard.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        patientId: must(patientIds.get(c.patientKey), `patient '${c.patientKey}'`),
        summaryContent: c.summaryContent,
        summaryDate: c.summaryDate,
        status: c.status,
        approvedStatus: approved ? true : null,
        validatorId: c.validatorUserId
          ? must(userIds.get(c.validatorUserId), `validator '${c.validatorUserId}'`)
          : null,
        validatedAt: c.validatedAt ?? null,
        philhealthCf4Status: c.philhealthCf4Status ?? undefined,
        philhealthCf4DecidedAt: c.philhealthCf4DecidedAt ?? null,
      },
    });
    courseIds.set(c.key, c.id);
  }

  // 5) Physician orders — link to their admission and (optionally) their summary.
  for (const o of orders) {
    await prisma.physicianOrder.upsert({
      where: { id: o.id },
      update: {},
      create: {
        id: o.id,
        orderContent: o.orderContent,
        dateCreated: o.dateCreated,
        type: o.type ?? undefined,
        status: o.status ?? undefined,
        nurseComment: o.nurseComment ?? null,
        executedById: o.executedByUserId
          ? must(userIds.get(o.executedByUserId), `executor '${o.executedByUserId}'`)
          : null,
        executedAt: o.executedAt ?? null,
        admissionId: must(admissionIds.get(o.admissionKey), `admission '${o.admissionKey}'`),
        orderedById: must(userIds.get(o.orderedByUserId), `physician '${o.orderedByUserId}'`),
        encodedById: must(userIds.get(o.encodedByUserId), `encoder '${o.encodedByUserId}'`),
        enteredByRole: o.enteredByRole,
        active: o.active ?? true,
        communicationChannel: o.communicationChannel ?? null,
        summarizationId: o.courseKey ? courseIds.get(o.courseKey) ?? null : null,
      },
    });
  }

  // 5b) One Course in the Ward per day, as the app files them: a seeded summary
  // keeps only its last day's orders and is dated that day. Its stay's earlier
  // days become ordinary "no summary yet" days (Claims and the physician's
  // "days to approve" chip count them; the discharge catch-up drafts them).
  // Read back from the DB so it also repairs rows seeded on an earlier day.
  for (const c of coursesInWard) {
    const linked = await prisma.physicianOrder.findMany({
      where: { summarizationId: c.id },
      select: { id: true, dateCreated: true },
    });
    if (!linked.length) continue;
    const last = linked.reduce((a, b) => (b.dateCreated > a.dateCreated ? b : a)).dateCreated;
    const day = new Date(last.getFullYear(), last.getMonth(), last.getDate());
    await prisma.physicianOrder.updateMany({
      where: { id: { in: linked.filter((o) => o.dateCreated < day).map((o) => o.id) } },
      data: { summarizationId: null },
    });
    // Only while the seeded text is untouched.
    await prisma.courseInWard.updateMany({
      where: { id: c.id, summaryContent: c.summaryContent },
      data: { summaryDate: day },
    });
  }

  // 6) Physician notes.
  for (const n of notes) {
    await prisma.physicianNote.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        notesArray: n.content,
        physicianId: must(userIds.get(n.physicianUserId), `physician '${n.physicianUserId}'`),
        patientId: must(patientIds.get(n.patientKey), `patient '${n.patientKey}'`),
        createdAt: n.createdAt,
        reminderAt: n.reminderAt ?? null,
      },
    });
  }

  // 7) Summary approval requests (claims).
  for (const r of approvalRequests) {
    await prisma.summaryApprovalRequest.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        summaryId: must(courseIds.get(r.courseKey), `summary '${r.courseKey}'`),
        physicianId: must(userIds.get(r.physicianUserId), `physician '${r.physicianUserId}'`),
        processorId: must(userIds.get(r.processorUserId), `processor '${r.processorUserId}'`),
        requestedAt: r.requestedAt,
        status: r.status,
      },
    });
  }

  // 8) Audit logs.
  for (const l of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        action: l.action,
        userId: must(userIds.get(l.userId), `user '${l.userId}'`),
        timeStamp: l.timeStamp,
      },
    });
  }

  // 9) Wards: nurse assignments, and rooms for some current inpatients. Only
  // fills gaps (no room yet, room free), so it never moves a real patient.
  for (const { userId, wardIds } of nurseWards) {
    const nurseId = must(userIds.get(userId), `nurse '${userId}'`);
    await prisma.nurseWard.createMany({
      data: wardIds.map((wardId) => ({ nurseId, wardId })),
      skipDuplicates: true,
    });
  }
  for (const [key, number] of Object.entries(admissionRooms)) {
    const room = await prisma.room.findUnique({
      where: { number },
      select: { id: true, admissions: { where: { dischargeDate: null }, take: 1, select: { id: true } } },
    });
    if (!room || room.admissions.length) continue;
    await prisma.patientAdmission.updateMany({
      where: { id: must(admissionIds.get(key), `admission '${key}'`), roomId: null, dischargeDate: null },
      data: { roomId: room.id },
    });
  }

  // 10) Report.
  const width = Math.max(...users.map((u) => u.role.length), 0) + 2;
  console.log('\nMock data seeded (idempotent — safe to re-run):');
  console.log(`  users=${users.length} patients=${patients.length} admissions=${admissions.length}`);
  console.log(`  orders=${orders.length} notes=${notes.length} coursesInWard=${coursesInWard.length}`);
  console.log(`  approvalRequests=${approvalRequests.length} auditLogs=${auditLogs.length}`);
  console.log(`\nDemo accounts (password: ${DEMO_PASSWORD}):`);
  for (const u of users) {
    console.log(`  ${u.role.padEnd(width)} ${u.userId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
