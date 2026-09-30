import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationInput {
  /** Recipient — the notification only ever shows up on their bell. */
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  /** Summary approval request this notification points at, when any. */
  requestId?: string | null;
}

/**
 * `inbox` is what the bell shows — everything the user has not cleared yet.
 * `history` is the full log, cleared items included.
 */
export type NotificationScope = 'inbox' | 'history';

/** The bell panel shows a short list; older items stay in the database. */
const DEFAULT_TAKE = 20;
const DEFAULT_HISTORY_TAKE = 50;
const MAX_TAKE = 200;

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type ?? NotificationType.GENERAL,
        title: input.title,
        message: input.message,
        requestId: input.requestId ?? null,
      },
    });
  }

  /** Newest first. */
  listForUser(
    userId: string,
    options: { scope?: NotificationScope; take?: number } = {},
  ) {
    const isHistory = options.scope === 'history';
    const fallback = isHistory ? DEFAULT_HISTORY_TAKE : DEFAULT_TAKE;
    const take = Math.min(Math.max(options.take ?? fallback, 1), MAX_TAKE);

    return this.prisma.notification.findMany({
      where: isHistory ? { userId } : { userId, clearedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Number that drives the badge next to the bell. */
  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false, clearedAt: null },
    });
    return { count };
  }

  /**
   * Marks one notification read and returns the fresh unread count, so the
   * badge updates without a second request.
   */
  async markRead(id: string, userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true },
    });

    if (!count) {
      const owned = await this.prisma.notification.count({ where: { id, userId } });
      if (!owned) throw new NotFoundException('Notification not found');
    }

    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false, clearedAt: null },
      data: { isRead: true },
    });
    return { count: 0 };
  }

  /**
   * Empties the bell without losing anything: every inbox row is stamped with
   * `clearedAt` (and marked read), so it leaves the badge and the inbox but
   * stays in the notification history.
   */
  async clear(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, clearedAt: null },
      data: { clearedAt: new Date(), isRead: true },
    });
    return { count: 0 };
  }
}
