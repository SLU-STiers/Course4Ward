-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('SMS', 'EMAIL', 'CALL', 'VERBAL', 'OTHER');

-- AlterTable
ALTER TABLE "physician_orders" ADD COLUMN     "communicationChannel" "CommunicationChannel";
