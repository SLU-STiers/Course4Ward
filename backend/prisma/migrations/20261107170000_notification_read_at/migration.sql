-- When a notification was marked read, so yesterday's read rows can be removed.
ALTER TABLE "notifications" ADD COLUMN "readAt" TIMESTAMP(3);
