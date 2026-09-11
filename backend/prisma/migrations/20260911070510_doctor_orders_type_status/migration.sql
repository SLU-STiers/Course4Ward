-- CreateEnum
CREATE TYPE "order_type" AS ENUM ('ADMISSION', 'DISCHARGE', 'DEFAULT');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('TO_ACCOMPLISH', 'ONGOING', 'FINISHED');

-- AlterTable
ALTER TABLE "physician_orders" ADD COLUMN     "status" "order_status" NOT NULL DEFAULT 'TO_ACCOMPLISH',
ADD COLUMN     "type" "order_type" NOT NULL DEFAULT 'DEFAULT';

-- DropEnum
DROP TYPE "OrderType";
