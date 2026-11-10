-- AlterEnum
ALTER TYPE "order_type" ADD VALUE 'TRANSFER';

-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'TRANSFER_PATIENT';

-- AlterTable
ALTER TABLE "physician_orders" ADD COLUMN     "transferRoomId" TEXT;

-- CreateIndex
CREATE INDEX "physician_orders_transferRoomId_idx" ON "physician_orders"("transferRoomId");

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_transferRoomId_fkey" FOREIGN KEY ("transferRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
