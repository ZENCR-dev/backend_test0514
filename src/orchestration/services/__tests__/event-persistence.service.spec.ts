import { Test, TestingModule } from "@nestjs/testing";
import { EventPersistenceService } from "../event-persistence.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { Logger } from "@nestjs/common";
import { EventProcessingStatus } from "@prisma/client";

describe("EventPersistenceService", () => {
  let service: EventPersistenceService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    eventLog: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPersistenceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EventPersistenceService>(EventPersistenceService);
    prismaService = module.get<PrismaService>(PrismaService);

    // 重置所有mock
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("persistEvent", () => {
    it("should persist a single event successfully", async () => {
      const eventData = {
        eventType: "PAYMENT_SUCCEEDED",
        eventId: "payment-123",
        payload: { orderId: "order-123", amount: 100 },
        metadata: { source: "payment-service" },
      };

      const expectedResult = {
        id: "event-log-123",
        ...eventData,
        processingStatus: EventProcessingStatus.PENDING,
        processingAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.eventLog.create.mockResolvedValue(expectedResult);

      const result = await service.persistEvent(eventData);

      expect(mockPrismaService.eventLog.create).toHaveBeenCalledWith({
        data: {
          eventType: eventData.eventType,
          eventId: eventData.eventId,
          payload: eventData.payload,
          metadata: eventData.metadata,
          processingStatus: EventProcessingStatus.PENDING,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it("should handle persistence errors gracefully", async () => {
      const eventData = {
        eventType: "PAYMENT_FAILED",
        payload: { orderId: "order-123" },
      };

      mockPrismaService.eventLog.create.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(service.persistEvent(eventData)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("persistEventsBatch", () => {
    it("should persist multiple events in batch", async () => {
      const eventsData = [
        {
          eventType: "PAYMENT_SUCCEEDED",
          eventId: "payment-123",
          payload: { orderId: "order-123" },
          metadata: { amount: 100 },
        },
        {
          eventType: "ORDER_STATUS_CHANGED",
          eventId: "order-123",
          payload: { status: "PAID" },
          metadata: { previousStatus: "PENDING" },
        },
      ];

      const batchResult = { count: 2 };
      mockPrismaService.eventLog.createMany.mockResolvedValue(batchResult);

      const result = await service.persistEventsBatch(eventsData);

      expect(mockPrismaService.eventLog.createMany).toHaveBeenCalledWith({
        data: eventsData.map((event) => ({
          eventType: event.eventType,
          eventId: event.eventId,
          payload: event.payload,
          metadata: (event as any).metadata || {},
          processingStatus: EventProcessingStatus.PENDING,
        })),
      });
      expect(result).toEqual(batchResult);
    });

    it("should handle empty batch gracefully", async () => {
      const result = await service.persistEventsBatch([]);
      expect(result).toEqual({ count: 0 });
      expect(mockPrismaService.eventLog.createMany).not.toHaveBeenCalled();
    });
  });

  describe("getEvents", () => {
    it("should retrieve events with default pagination", async () => {
      const mockEvents = [
        {
          id: "event-1",
          eventType: "PAYMENT_SUCCEEDED",
          payload: { orderId: "order-123" },
          createdAt: new Date(),
        },
      ];

      mockPrismaService.eventLog.findMany.mockResolvedValue(mockEvents);

      const result = await service.getEvents();

      expect(mockPrismaService.eventLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        take: 100,
        skip: 0,
      });
      expect(result).toEqual(mockEvents);
    });

    it("should retrieve events with custom filters", async () => {
      const filters = {
        eventType: "PAYMENT_SUCCEEDED",
        processingStatus: EventProcessingStatus.COMPLETED,
        startDate: new Date("2023-01-01"),
        endDate: new Date("2023-12-31"),
        page: 2,
        limit: 50,
      };

      const mockEvents = [];
      mockPrismaService.eventLog.findMany.mockResolvedValue(mockEvents);

      await service.getEvents(filters);

      expect(mockPrismaService.eventLog.findMany).toHaveBeenCalledWith({
        where: {
          eventType: filters.eventType,
          processingStatus: filters.processingStatus,
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        },
        orderBy: { createdAt: "desc" },
        take: filters.limit,
        skip: (filters.page - 1) * filters.limit,
      });
    });
  });

  describe("getEventById", () => {
    it("should retrieve a specific event by ID", async () => {
      const eventId = "event-123";
      const mockEvent = {
        id: eventId,
        eventType: "PAYMENT_SUCCEEDED",
        payload: { orderId: "order-123" },
      };

      mockPrismaService.eventLog.findUnique.mockResolvedValue(mockEvent);

      const result = await service.getEventById(eventId);

      expect(mockPrismaService.eventLog.findUnique).toHaveBeenCalledWith({
        where: { id: eventId },
      });
      expect(result).toEqual(mockEvent);
    });

    it("should return null for non-existent event", async () => {
      mockPrismaService.eventLog.findUnique.mockResolvedValue(null);

      const result = await service.getEventById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("updateEventStatus", () => {
    it("should update event processing status successfully", async () => {
      const eventId = "event-123";
      const status = EventProcessingStatus.COMPLETED;
      const error = null;

      const updatedEvent = {
        id: eventId,
        processingStatus: status,
        processedAt: new Date(),
      };

      mockPrismaService.eventLog.update.mockResolvedValue(updatedEvent);

      const result = await service.updateEventStatus(eventId, status, error);

      expect(mockPrismaService.eventLog.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          processingStatus: status,
          lastProcessingError: error,
          processedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedEvent);
    });

    it("should update event with error information", async () => {
      const eventId = "event-123";
      const status = EventProcessingStatus.FAILED;
      const error = "Processing failed due to network error";

      await service.updateEventStatus(eventId, status, error);

      expect(mockPrismaService.eventLog.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          processingStatus: status,
          lastProcessingError: error,
          processedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe("getEventStats", () => {
    it("should return event statistics", async () => {
      const mockStats = [
        { eventType: "PAYMENT_SUCCEEDED", _count: { id: 100 } },
        { eventType: "PAYMENT_FAILED", _count: { id: 10 } },
      ];

      const mockStatusStats = [
        {
          processingStatus: EventProcessingStatus.COMPLETED,
          _count: { id: 90 },
        },
        { processingStatus: EventProcessingStatus.FAILED, _count: { id: 20 } },
      ];

      mockPrismaService.eventLog.groupBy
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(mockStatusStats);

      mockPrismaService.eventLog.count.mockResolvedValue(110);

      const result = await service.getEventStats();

      expect(result).toEqual({
        totalEvents: 110,
        eventsByType: {
          PAYMENT_SUCCEEDED: 100,
          PAYMENT_FAILED: 10,
        },
        eventsByStatus: {
          [EventProcessingStatus.COMPLETED]: 90,
          [EventProcessingStatus.FAILED]: 20,
        },
      });
    });
  });

  describe("cleanupOldEvents", () => {
    it("should cleanup events older than specified days", async () => {
      const olderThanDays = 30;
      const deletedCount = 150;

      mockPrismaService.eventLog.deleteMany.mockResolvedValue({
        count: deletedCount,
      });

      const result = await service.cleanupOldEvents(olderThanDays);

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - olderThanDays);

      expect(mockPrismaService.eventLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toBe(deletedCount);
    });

    it("should validate olderThanDays parameter", async () => {
      await expect(service.cleanupOldEvents(-1)).rejects.toThrow(
        "olderThanDays must be a positive number",
      );
      await expect(service.cleanupOldEvents(0)).rejects.toThrow(
        "olderThanDays must be a positive number",
      );
    });
  });

  describe("retryFailedEvents", () => {
    it("should get failed events for retry", async () => {
      const mockFailedEvents = [
        {
          id: "event-1",
          eventType: "PAYMENT_SUCCEEDED",
          processingAttempts: 2,
        },
      ];

      mockPrismaService.eventLog.findMany.mockResolvedValue(mockFailedEvents);

      const result = await service.retryFailedEvents(5);

      expect(mockPrismaService.eventLog.findMany).toHaveBeenCalledWith({
        where: {
          processingStatus: EventProcessingStatus.FAILED,
          processingAttempts: { lt: 5 },
        },
        take: 100,
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual(mockFailedEvents);
    });
  });

  describe("incrementAttempts", () => {
    it("should increment processing attempts", async () => {
      const eventId = "event-123";
      const updatedEvent = {
        id: eventId,
        processingAttempts: 3,
      };

      mockPrismaService.eventLog.update.mockResolvedValue(updatedEvent);

      const result = await service.incrementAttempts(eventId);

      expect(mockPrismaService.eventLog.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          processingAttempts: { increment: 1 },
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedEvent);
    });
  });
});
