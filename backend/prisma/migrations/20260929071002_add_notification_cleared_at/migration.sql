-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "clearedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_userId_clearedAt_idx" ON "notifications"("userId", "clearedAt");
