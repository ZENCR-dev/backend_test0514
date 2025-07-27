import { Test, TestingModule } from "@nestjs/testing";
import { PaymentService } from "../payment.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { PractitionerAccountService } from "../../../practitioner-account/services/practitioner-account.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Decimal } from "@prisma/client/runtime/library";
import { BadRequestException } from "@nestjs/common";

describe("PaymentService - Duplicate Check", () => {
  let service: PaymentService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    payment: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPractitionerAccountService = {
    deductBalance: jest.fn(),
    refundBalance: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockStripeConfig = {
    apiKey: "test_api_key",
    secretKey: "sk_test_123456789",
  };

  const mockPaymentConfig = {
    minPaymentAmount: 100,
    maxPaymentAmount: 1000000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PractitionerAccountService,
          useValue: mockPractitionerAccountService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: "STRIPE_CONFIG",
          useValue: mockStripeConfig,
        },
        {
          provide: "PAYMENT_CONFIG",
          useValue: mockPaymentConfig,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("checkDuplicatePayment", () => {
    const orderId = "order-123";
    const amount = new Decimal(100.5);

    it("should return false when no existing payments found", async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      const result = await service.checkDuplicatePayment(orderId, amount);

      expect(result).toBe(false);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: {
          orderId: orderId,
          status: {
            in: ["pending", "processing", "completed"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    it("should return true when exact duplicate payment exists", async () => {
      const existingPayment = {
        id: "payment-123",
        orderId: orderId,
        amount: new Decimal(100.5),
        status: "pending",
        createdAt: new Date(),
      };

      mockPrismaService.payment.findMany.mockResolvedValue([existingPayment]);

      const result = await service.checkDuplicatePayment(orderId, amount);

      expect(result).toBe(true);
    });

    it("should return true when completed payment exists (any amount)", async () => {
      const existingPayment = {
        id: "payment-123",
        orderId: orderId,
        amount: new Decimal(200.0),
        status: "completed",
        createdAt: new Date(),
      };

      mockPrismaService.payment.findMany.mockResolvedValue([existingPayment]);

      const result = await service.checkDuplicatePayment(orderId, amount);

      expect(result).toBe(true);
    });

    it("should return true when too many pending payments exist", async () => {
      const existingPayments = [
        {
          id: "payment-1",
          orderId: orderId,
          amount: new Decimal(50.0),
          status: "pending",
          createdAt: new Date(),
        },
        {
          id: "payment-2",
          orderId: orderId,
          amount: new Decimal(75.0),
          status: "processing",
          createdAt: new Date(),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(existingPayments);

      const result = await service.checkDuplicatePayment(orderId, amount);

      expect(result).toBe(true);
    });

    it("should return false for different amount with single pending payment", async () => {
      const existingPayment = {
        id: "payment-123",
        orderId: orderId,
        amount: new Decimal(200.0),
        status: "pending",
        createdAt: new Date(),
      };

      mockPrismaService.payment.findMany.mockResolvedValue([existingPayment]);

      const result = await service.checkDuplicatePayment(orderId, amount);

      expect(result).toBe(false);
    });

    it("should return true on database error (conservative approach)", async () => {
      mockPrismaService.payment.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.checkDuplicatePayment(orderId, amount);

      expect(result).toBe(true);
    });
  });

  describe("checkDuplicateRefund", () => {
    const orderId = "order-123";
    const transactionId = "transaction-123";
    const amount = new Decimal(50.0);

    it("should return null when no existing refunds found", async () => {
      mockPrismaService.payment.findMany
        .mockResolvedValueOnce([]) // For refunds check
        .mockResolvedValueOnce([
          // For original payments check
          {
            id: "payment-123",
            orderId: orderId,
            amount: new Decimal(100.0),
            paymentMethod: "stripe",
            status: "completed",
          },
        ]);

      const result = await service.checkDuplicateRefund(
        orderId,
        transactionId,
        amount,
      );

      expect(result).toBe(null);
    });

    it("should return existing refund when exact match found", async () => {
      const existingRefund = {
        id: "refund-123",
        orderId: orderId,
        amount: new Decimal(50.0),
        paymentMethod: "refund",
        status: "completed",
        providerTransactionId: transactionId,
        updatedAt: new Date("2025-07-13T10:00:00Z"),
        createdAt: new Date("2025-07-13T09:00:00Z"),
      };

      mockPrismaService.payment.findMany.mockResolvedValue([existingRefund]);

      const result = await service.checkDuplicateRefund(
        orderId,
        transactionId,
        amount,
      );

      expect(result).toEqual({
        id: transactionId,
        amount: 50.0,
        status: "succeeded",
        orderId: orderId,
        refundedAt: existingRefund.updatedAt,
      });
    });

    it("should throw error when refund amount exceeds total paid", async () => {
      const existingRefunds = [
        {
          id: "refund-1",
          orderId: orderId,
          amount: new Decimal(60.0),
          paymentMethod: "refund",
          status: "completed",
          createdAt: new Date(),
        },
      ];

      const originalPayments = [
        {
          id: "payment-123",
          orderId: orderId,
          amount: new Decimal(100.0),
          paymentMethod: "stripe",
          status: "completed",
        },
      ];

      mockPrismaService.payment.findMany
        .mockResolvedValueOnce(existingRefunds) // For refunds check
        .mockResolvedValueOnce(originalPayments); // For original payments check

      const largeRefundAmount = new Decimal(50.0); // 60 + 50 = 110 > 100

      await expect(
        service.checkDuplicateRefund(orderId, transactionId, largeRefundAmount),
      ).rejects.toThrow(BadRequestException);
    });

    it("should return recent duplicate refund within 5 minutes", async () => {
      const fiveMinutesAgo = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      const recentRefund = {
        id: "refund-recent",
        orderId: orderId,
        amount: new Decimal(50.0),
        paymentMethod: "refund",
        status: "pending",
        providerTransactionId: "other-transaction",
        updatedAt: fiveMinutesAgo,
        createdAt: fiveMinutesAgo,
      };

      const originalPayments = [
        {
          id: "payment-123",
          orderId: orderId,
          amount: new Decimal(100.0),
          paymentMethod: "stripe",
          status: "completed",
        },
      ];

      mockPrismaService.payment.findMany
        .mockResolvedValueOnce([recentRefund]) // For refunds check
        .mockResolvedValueOnce(originalPayments); // For original payments check

      const result = await service.checkDuplicateRefund(
        orderId,
        transactionId,
        amount,
      );

      expect(result).toEqual({
        id: "other-transaction",
        amount: 50.0,
        status: "pending",
        orderId: orderId,
        refundedAt: fiveMinutesAgo,
      });
    });

    it("should return null for old refunds with same amount", async () => {
      const oldRefund = {
        id: "refund-old",
        orderId: orderId,
        amount: new Decimal(50.0),
        paymentMethod: "refund",
        status: "completed",
        providerTransactionId: "old-transaction",
        updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      };

      const originalPayments = [
        {
          id: "payment-123",
          orderId: orderId,
          amount: new Decimal(200.0),
          paymentMethod: "stripe",
          status: "completed",
        },
      ];

      mockPrismaService.payment.findMany
        .mockResolvedValueOnce([oldRefund]) // For refunds check
        .mockResolvedValueOnce(originalPayments); // For original payments check

      const result = await service.checkDuplicateRefund(
        orderId,
        transactionId,
        amount,
      );

      expect(result).toBe(null);
    });
  });

  describe("mapPaymentStatusToRefundStatus", () => {
    it("should map payment statuses correctly", () => {
      // Access private method via service instance
      const mapMethod = (service as any).mapPaymentStatusToRefundStatus.bind(
        service,
      );

      expect(mapMethod("pending")).toBe("pending");
      expect(mapMethod("processing")).toBe("pending");
      expect(mapMethod("completed")).toBe("succeeded");
      expect(mapMethod("failed")).toBe("failed");
      expect(mapMethod("cancelled")).toBe("failed");
      expect(mapMethod("unknown")).toBe("pending");
    });
  });
});
