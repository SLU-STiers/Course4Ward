import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Opens the claim for a Course in the Ward day unless that day already has one.
 * The advisory lock serialises concurrent requests for the same day (a double
 * click, two processors, or the discharge hand-off), so a day is claimed once.
 * Returns `null` when the day was already claimed.
 */
export function createClaimOnce(
  prisma: PrismaService,
  data: Prisma.SummaryApprovalRequestUncheckedCreateInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.summaryId}))`;
    const existing = await tx.summaryApprovalRequest.count({ where: { summaryId: data.summaryId } });
    if (existing > 0) return null;
    return tx.summaryApprovalRequest.create({ data });
  });
}
