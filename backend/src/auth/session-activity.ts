import { PrismaService } from '../prisma/prisma.service';

export const ALREADY_LOGGED_IN = 'User already logged in';

/**
 * A session that made a request within this window counts as live, and a
 * second sign-in to the same account is refused. Matches the frontend idle
 * timeout, so a browser closed without signing out frees the account after
 * the same 15 minutes an idle tab would have been signed out.
 */
export const ACTIVE_SESSION_WINDOW_MS = 15 * 60 * 1000;

/** `lastSeenAt` is written at most this often, not on every request. */
export const LAST_SEEN_THROTTLE_MS = 60 * 1000;

/** Prisma data that ends a session: older tokens stop working and the account is free to sign in. */
export const END_SESSION = { sessionVersion: { increment: 1 }, lastSeenAt: null };

/**
 * Marks the current session as still in use, so the account keeps counting
 * as signed in. Throttled to one write a minute; a token from an older
 * session (other sessionVersion) never refreshes the newer one's activity.
 */
export async function touchSession(prisma: PrismaService, id: string, sessionVersion: number) {
  await prisma.user.updateMany({
    where: {
      id,
      sessionVersion,
      OR: [
        { lastSeenAt: null },
        { lastSeenAt: { lt: new Date(Date.now() - LAST_SEEN_THROTTLE_MS) } },
      ],
    },
    data: { lastSeenAt: new Date() },
  });
}
