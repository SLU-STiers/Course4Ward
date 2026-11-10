import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderType, Prisma, PrismaClient } from '@prisma/client';

/** Room checks and writes run serializably so two nurses cannot take the same room at once. */
const ROOM_TX = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

export async function inRoomTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await prisma.$transaction(fn, ROOM_TX);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ConflictException('That room was just taken by another patient; choose another room');
    }
    throw error;
  }
}

/**
 * A transfer order still waiting for the nurse reserves its room. It stops
 * reserving once finished, retired (`active: false`) or the patient is discharged.
 */
export function pendingTransferWhere(exceptAdmissionId?: string): Prisma.PhysicianOrderWhereInput {
  return {
    type: OrderType.TRANSFER,
    active: true,
    status: { not: OrderStatus.FINISHED },
    admission: { dischargeDate: null },
    ...(exceptAdmissionId ? { admissionId: { not: exceptAdmissionId } } : {}),
  };
}

/**
 * Room `number`, if it exists and no other undischarged admission holds it or
 * has it reserved by a pending transfer. `exceptAdmissionId`'s own room and
 * reservation do not count against it.
 */
export async function freeRoom(tx: Prisma.TransactionClient, number: string, exceptAdmissionId?: string) {
  const room = await tx.room.findUnique({
    where: { number },
    select: {
      id: true,
      number: true,
      isActive: true,
      ward: { select: { id: true, name: true } },
      admissions: {
        where: {
          dischargeDate: null,
          ...(exceptAdmissionId ? { id: { not: exceptAdmissionId } } : {}),
        },
        select: { id: true },
        take: 1,
      },
      transferOrders: { where: pendingTransferWhere(exceptAdmissionId), select: { id: true }, take: 1 },
    },
  });
  if (!room || !room.isActive) throw new NotFoundException(`Room ${number} does not exist`);
  if (room.admissions.length) throw new ConflictException(`Room ${number} is occupied`);
  if (room.transferOrders.length) {
    throw new ConflictException(`Room ${number} is reserved for a pending transfer`);
  }
  return { id: room.id, number: room.number, ward: room.ward };
}
