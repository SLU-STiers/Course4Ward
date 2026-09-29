// backend/src/unit-tests/notifications.test.ts
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrismaService = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaService>;

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: typeof mockPrismaService;

  const userId = "user-123";

  const notification = {
    id: "notification-1",
    userId,
    type: "REVIEW_REQUESTED",
    title: "Review requested again",
    message:
      "Ramon Torres (Claims Processor) asked you to review Lucila Domingo's " +
      'summary again: "Please re-check the dosages."',
    requestId: "claim-1",
    isRead: false,
    createdAt: new Date(),
    clearedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should default the type to GENERAL and leave requestId null", async () => {
      (prisma.notification.create as jest.Mock).mockResolvedValue(notification);

      await service.create({ userId, title: "Heads up", message: "Body" });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: "GENERAL",
          title: "Heads up",
          message: "Body",
          requestId: null,
        },
      });
    });

    it("should keep the given type and requestId", async () => {
      (prisma.notification.create as jest.Mock).mockResolvedValue(notification);

      await service.create({
        userId,
        type: "REVIEW_REQUESTED",
        title: "Review requested again",
        message: "Body",
        requestId: "claim-1",
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: "REVIEW_REQUESTED",
          title: "Review requested again",
          message: "Body",
          requestId: "claim-1",
        },
      });
    });
  });

  describe("listForUser", () => {
    it("should return only uncleared rows for the inbox, newest first", async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([notification]);

      const result = await service.listForUser(userId);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId, clearedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      expect(result).toEqual([notification]);
    });

    it("should include cleared rows in the history", async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await service.listForUser(userId, { scope: "history" });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });

    it("should clamp an explicit take between 1 and 200", async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await service.listForUser(userId, { take: 5000 });
      expect(prisma.notification.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 200 }),
      );

      await service.listForUser(userId, { take: -5 });
      expect(prisma.notification.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });
  });

  describe("unreadCount", () => {
    it("should ignore read and cleared rows", async () => {
      (prisma.notification.count as jest.Mock).mockResolvedValue(3);

      await expect(service.unreadCount(userId)).resolves.toEqual({ count: 3 });

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId, isRead: false, clearedAt: null },
      });
    });
  });

  describe("markRead", () => {
    it("should mark the row read and return the fresh unread count", async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await expect(service.markRead("notification-1", userId)).resolves.toEqual({
        count: 0,
      });

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "notification-1", userId, isRead: false },
        data: { isRead: true },
      });
    });

    it("should be a no-op for an already read row", async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(1) // the row belongs to this user
        .mockResolvedValueOnce(2); // two other unread rows

      await expect(service.markRead("notification-1", userId)).resolves.toEqual({
        count: 2,
      });
    });

    it("should throw NotFoundException for another user's notification", async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await expect(service.markRead("notification-1", userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("markAllRead", () => {
    it("should mark every uncleared row read and zero the badge", async () => {
      await expect(service.markAllRead(userId)).resolves.toEqual({ count: 0 });

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, isRead: false, clearedAt: null },
        data: { isRead: true },
      });
    });
  });

  describe("clear", () => {
    it("should archive the inbox instead of deleting it", async () => {
      await expect(service.clear(userId)).resolves.toEqual({ count: 0 });

      expect(prisma.notification.updateMany).toHaveBeenCalledTimes(1);

      const [args] = (prisma.notification.updateMany as jest.Mock).mock.calls[0];
      expect(args.where).toEqual({ userId, clearedAt: null });
      expect(args.data.isRead).toBe(true);
      expect(args.data.clearedAt).toBeInstanceOf(Date);
    });
  });
});
