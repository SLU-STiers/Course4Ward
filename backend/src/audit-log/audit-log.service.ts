import { Injectable } from '@nestjs/common';
import { ActionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RecordAuditInput {
  userId: string;
  action: string;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async record(input: RecordAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: this.toActionType(input.action),
      },
    });
  }

  private toActionType(action: string): ActionType {
    const actionMap: Record<string, ActionType> = {
      LOGIN: ActionType.LOGIN,
      PASSWORD_RESET: ActionType.EDIT_ACCOUNT,
      USER_CREATED: ActionType.ADD_ACCOUNT,
      USER_UPDATED: ActionType.EDIT_ACCOUNT,
      USER_DEACTIVATED: ActionType.DELETE_ACCOUNT,
      PATIENT_CREATED: ActionType.REGISTER_PATIENT,
      PATIENT_UPDATED: ActionType.REGISTER_PATIENT,
      ORDER_CREATED: ActionType.CREATE_ORDER,
      SUMMARY_GENERATED_AI: ActionType.REQUEST_SUMMARY,
      SUMMARY_EDITED_MANUAL: ActionType.EDIT_SUMMARY,
      SUMMARY_REGENERATED_AI: ActionType.REGENERATE_SUMMARY,
      SUMMARY_APPROVED: ActionType.APPROVE_SUMMARY,
      CLAIM_CREATED: ActionType.REQUEST_SUMMARY,
      CLAIM_PHYSICIAN_NOTIFIED: ActionType.REQUEST_SUMMARY,
      CF4_GENERATED: ActionType.CREATE_ORDER,
    };
    return actionMap[action] ?? ActionType.EDIT_ACCOUNT;
  }

  // Used by Admin > "view transaction logs and important analytics"
  async findAll(params: { skip?: number; take?: number }) {
    return this.prisma.auditLog.findMany({
      orderBy: { timeStamp: 'desc' },
      skip: params.skip,
      take: params.take ?? 50,
      include: { user: { select: { userId: true, firstName: true, lastName: true, role: true } } },
    });
  }

  // Orders per day/week/month/year for admin analytics
  async ordersOverTime(bucket: 'day' | 'week' | 'month' | 'year') {
    return this.prisma.$queryRawUnsafe(`
      SELECT date_trunc('${bucket}', "dateCreated") AS period, COUNT(*)::int AS count
      FROM physician_orders
      GROUP BY period
      ORDER BY period DESC
      LIMIT 100;
    `);
  }
}
