import { Injectable } from '@nestjs/common';
import { OrderEnteredBy, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async create(dto: CreateOrderDto, enteredById: string, enteredByRole: Role) {
    const enteredByFlag =
      enteredByRole === Role.NURSE ? OrderEnteredBy.NURSE_ON_BEHALF : OrderEnteredBy.PHYSICIAN;

    const order = await this.prisma.physicianOrder.create({
      data: {
        patientId: dto.patientId,
        orderingPhysicianId: dto.orderingPhysicianId,
        enteredById,
        enteredByRole: enteredByFlag,
        type: dto.type,
        description: dto.description,
        frequency: dto.frequency,
        dosage: dto.dosage,
      },
    });

    await this.auditLog.record({
      userId: enteredById,
      action: 'ORDER_CREATED',
      entityType: 'PhysicianOrder',
      entityId: order.id,
      metadata: { enteredByRole: enteredByFlag, type: dto.type },
    });

    return order;
  }

  findForPatient(patientId: string) {
    return this.prisma.physicianOrder.findMany({
      where: { patientId },
      orderBy: { orderDate: 'desc' },
      include: {
        orderingPhysician: { select: { firstName: true, lastName: true } },
        enteredBy: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  // Orders placed "today" for a patient -- input to the AI summarization step
  findTodaysOrders(patientId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.physicianOrder.findMany({
      where: { patientId, orderDate: { gte: startOfDay } },
      orderBy: { orderDate: 'asc' },
    });
  }
}
