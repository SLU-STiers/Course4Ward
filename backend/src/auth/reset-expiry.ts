import { PrismaService } from '../prisma/prisma.service';

/**
 * Marks password reset requests that timed out while still PENDING as EXPIRED.
 *
 * A request expires an hour after it is made (`RESET_REQUEST_TTL_MS`), but
 * nothing changes its status at that moment. Run this before anything reads
 * reset requests, so the admin list, the sidebar badge, the dashboard and the
 * reports never offer a request that can no longer be approved.
 */
export function expireStaleResetRequests(prisma: PrismaService, now = new Date()) {
  return prisma.passwordResetRequest.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    data: { status: 'EXPIRED', resolvedAt: now },
  });
}
