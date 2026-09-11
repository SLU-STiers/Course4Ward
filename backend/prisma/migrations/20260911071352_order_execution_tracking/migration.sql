-- AlterTable
ALTER TABLE "physician_orders" ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "executedById" TEXT,
ADD COLUMN     "nurseComment" TEXT;

-- CreateIndex
CREATE INDEX "physician_orders_executedById_idx" ON "physician_orders"("executedById");

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
