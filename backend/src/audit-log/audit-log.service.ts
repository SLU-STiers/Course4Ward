import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RecordAuditInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async record(input: RecordAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as any,
        ipAddress: input.ipAddress,
      },
    });
  }

  // Used by Admin > "view transaction logs and important analytics"
  async findAll(params: { skip?: number; take?: number; entityType?: string }) {
    return this.prisma.auditLog.findMany({
      where: params.entityType ? { entityType: params.entityType } : undefined,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take ?? 50,
      include: { user: { select: { userId: true, firstName: true, lastName: true, role: true } } },
    });
  }

  // Orders per day/week/month/year for admin analytics
  async ordersOverTime(bucket: 'day' | 'week' | 'month' | 'year') {
    return this.prisma.$queryRawUnsafe(`
      SELECT date_trunc('${bucket}', "orderDate") AS period, COUNT(*)::int AS count
      FROM physician_orders
      GROUP BY period
      ORDER BY period DESC
      LIMIT 100;
    `);
  }
}
