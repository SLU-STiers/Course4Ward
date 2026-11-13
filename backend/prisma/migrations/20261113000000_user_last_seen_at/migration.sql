-- One live session per account: login is refused while lastSeenAt is recent.
ALTER TABLE "users" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
