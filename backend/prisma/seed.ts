import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  admissions,
  approvalRequests,
  auditLogs,
  coursesInWard,
  DEMO_PASSWORD,
  notes,
  orders,
  patients,
  users,
} from './seed/data';

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

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1) Users — upsert by unique userId (DOC001 may already exist from older seeds).
  const userIds = new Map<string, string>();
  for (const u of users) {
    const record = await prisma.user.upsert({
      where: { userId: u.userId },
      update: {},
      create: {
        id: u.id,
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

  // 2) Patients — no natural unique key, so upsert by the fixed seed id.
  const patientIds = new Map<string, string>();
  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        dateOfBirth: p.dateOfBirth,
      },
    });
    patientIds.set(p.key, p.id);
  }

  // 3) Admissions.
  const admissionIds = new Map<string, string>();
  for (const a of admissions) {
    await prisma.patientAdmission.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        patientId: must(patientIds.get(a.patientKey), `patient '${a.patientKey}'`),
        physicianId: must(userIds.get(a.physicianUserId), `physician '${a.physicianUserId}'`),
        admissionDate: a.admissionDate,
        dischargeDate: a.dischargeDate ?? null,
      },
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
        admissionId: must(admissionIds.get(o.admissionKey), `admission '${o.admissionKey}'`),
        orderedById: must(userIds.get(o.orderedByUserId), `physician '${o.orderedByUserId}'`),
        encodedById: must(userIds.get(o.encodedByUserId), `encoder '${o.encodedByUserId}'`),
        enteredByRole: o.enteredByRole,
        active: o.active ?? true,
        summarizationId: o.courseKey ? courseIds.get(o.courseKey) ?? null : null,
      },
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

  // 9) Report.
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
