/*
  Warnings:

  - You are about to drop the column `dosage` on the `physician_orders` table. All the data in the column will be lost.
  - You are about to drop the column `frequency` on the `physician_orders` table. All the data in the column will be lost.
  - You are about to drop the column `patientId` on the `physician_orders` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `physician_orders` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "physician_orders" DROP CONSTRAINT "physician_orders_patientId_fkey";

-- AlterTable
ALTER TABLE "physician_orders" DROP COLUMN "dosage",
DROP COLUMN "frequency",
DROP COLUMN "patientId",
DROP COLUMN "type";
