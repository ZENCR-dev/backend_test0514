import { Test, TestingModule } from "@nestjs/testing";
import { PractitionerAccountController } from "../practitioner-account.controller";
import { PractitionerAccountService } from "../services/practitioner-account.service";
import { PaymentService } from "../../payment/services/payment.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { Decimal } from "@prisma/client/runtime/library";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("PractitionerAccountController", () => {
  let controller: PractitionerAccountController;
  let service: PractitionerAccountService;

  const mockUser = {
    id: "practitioner_123",
    email: "doctor@example.com",
    role: "practitioner",
  };

  const mockBalance = {
    balance: new Decimal(1000),
    availableCredit: new Decimal(500),
    creditLimit: new Decimal(1000),
    usedCredit: new Decimal(500),
  };

  const mockTransactions = [
    {
      id: "trans_1",
      accountId: "acc_123",
      transactionType: "DEBIT",
      amount: new Decimal(100),
      balanceBefore: new Decimal(1100),
      balanceAfter: new Decimal(1000),
      creditBefore: new Decimal(0),
      creditAfter: new Decimal(0),
      referenceType: "ORDER",
      referenceId: "order_123",
      description: "Order payment",
      createdAt: new Date("2025-01-09"),
      createdBy: "practitioner_123",
    },
  ];

  const mockAccount = {
    id: "acc_123",
    practitionerId: "practitioner_123",
    balance: new Decimal(1000),
    creditLimit: new Decimal(1000),
    usedCredit: new Decimal(500),
    availableCredit: new Decimal(500),
    status: "active",
    version: 1,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-09"),
  };

  const mockPractitionerAccountService = {
    getBalance: jest.fn(),
    getTransactionHistory: jest.fn(),
    getAccountWithVersion: jest.fn(),
    createAccount: jest.fn(),
  };

  const mockPaymentService = {
    createPaymentIntent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PractitionerAccountController],
      providers: [
        {
          provide: PractitionerAccountService,
          useValue: mockPractitionerAccountService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PractitionerAccountController>(
      PractitionerAccountController,
    );
    service = module.get<PractitionerAccountService>(
      PractitionerAccountService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /balance", () => {
    it("should return account balance for authenticated practitioner", async () => {
      mockPractitionerAccountService.getBalance.mockResolvedValue(mockBalance);

      const result = await controller.getBalance(mockUser);

      expect(result).toEqual({
        success: true,
        data: {
          balance: 1000,
          availableCredit: 500,
          creditLimit: 1000,
          usedCredit: 500,
          currency: "NZD",
        },
        message: "账户余额获取成功",
        meta: {
          timestamp: expect.any(String),
        },
      });
      expect(service.getBalance).toHaveBeenCalledWith(mockUser.id);
    });

    it("should return 404 if account not found", async () => {
      mockPractitionerAccountService.getBalance.mockRejectedValue(
        new NotFoundException("Practitioner account not found"),
      );

      await expect(controller.getBalance(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should handle decimal precision correctly", async () => {
      const preciseBalance = {
        ...mockBalance,
        balance: new Decimal("1234.56"),
        availableCredit: new Decimal("789.12"),
      };
      mockPractitionerAccountService.getBalance.mockResolvedValue(
        preciseBalance,
      );

      const result = await controller.getBalance(mockUser);

      expect(result.data.balance).toBe(1234.56);
      expect(result.data.availableCredit).toBe(789.12);
    });
  });

  describe("GET /transactions", () => {
    it("should return paginated transaction history", async () => {
      mockPractitionerAccountService.getTransactionHistory.mockResolvedValue(
        mockTransactions,
      );

      const result = await controller.getTransactionHistory(mockUser, 10, 0);

      expect(result).toEqual({
        success: true,
        data: mockTransactions.map((t) => ({
          ...t,
          amount: t.amount.toNumber(),
          balanceBefore: t.balanceBefore.toNumber(),
          balanceAfter: t.balanceAfter.toNumber(),
          creditBefore: t.creditBefore.toNumber(),
          creditAfter: t.creditAfter.toNumber(),
        })),
        message: "交易历史获取成功",
        meta: {
          pagination: {
            limit: 10,
            page: 1,
            total: mockTransactions.length,
            totalPages: 1,
          },
          timestamp: expect.any(String),
        },
      });
      expect(service.getTransactionHistory).toHaveBeenCalledWith(
        mockUser.id,
        10,
        0,
      );
    });

    it("should use default pagination parameters", async () => {
      mockPractitionerAccountService.getTransactionHistory.mockResolvedValue(
        [],
      );

      await controller.getTransactionHistory(mockUser);

      expect(service.getTransactionHistory).toHaveBeenCalledWith(
        mockUser.id,
        20,
        0,
      );
    });

    it("should validate limit parameter", async () => {
      // Mock empty response for validation test
      mockPractitionerAccountService.getTransactionHistory.mockResolvedValue(
        [],
      );

      await expect(
        controller.getTransactionHistory(mockUser, 201, 0),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.getTransactionHistory(mockUser, 0, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it("should validate offset parameter", async () => {
      await expect(
        controller.getTransactionHistory(mockUser, 50, -1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("GET /info", () => {
    it("should return account information", async () => {
      mockPractitionerAccountService.getAccountWithVersion.mockResolvedValue(
        mockAccount,
      );

      const result = await controller.getAccountInfo(mockUser);

      expect(result).toEqual({
        success: true,
        data: {
          id: mockAccount.id,
          practitionerId: mockAccount.practitionerId,
          balance: 1000,
          creditLimit: 1000,
          usedCredit: 500,
          availableCredit: 500,
          status: "active",
          createdAt: mockAccount.createdAt.toISOString(),
          updatedAt: mockAccount.updatedAt.toISOString(),
        },
        message: "账户信息获取成功",
        meta: {
          timestamp: expect.any(String),
        },
      });
      expect(service.getAccountWithVersion).toHaveBeenCalledWith(mockUser.id);
    });

    it("should create account if not exists", async () => {
      mockPractitionerAccountService.getAccountWithVersion.mockRejectedValueOnce(
        new NotFoundException(),
      );
      mockPractitionerAccountService.createAccount.mockResolvedValue(
        mockAccount,
      );
      mockPractitionerAccountService.getAccountWithVersion.mockResolvedValueOnce(
        mockAccount,
      );

      const result = await controller.getAccountInfo(mockUser);

      expect(service.createAccount).toHaveBeenCalledWith(mockUser.id);
      expect(result.data.id).toBe(mockAccount.id);
    });
  });

  describe("POST /recharge", () => {
    it("should create Stripe payment intent for recharge", async () => {
      const rechargeDto = { amount: 100, currency: "NZD" };
      const mockPaymentIntent = {
        id: "pi_123",
        clientSecret: "pi_123_secret",
        amount: 10000,
        currency: "nzd",
        status: "requires_payment_method",
      };

      mockPaymentService.createPaymentIntent.mockResolvedValue(
        mockPaymentIntent,
      );

      const result = await controller.rechargeAccount(mockUser, rechargeDto);

      expect(result).toEqual({
        success: true,
        data: {
          paymentIntentId: mockPaymentIntent.id,
          clientSecret: mockPaymentIntent.clientSecret,
          amount: 100,
          currency: "NZD",
        },
        message: "充值支付意图创建成功",
        meta: {
          timestamp: expect.any(String),
        },
      });
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: "100",
          practitionerId: mockUser.id,
          currency: "NZD",
          orderId: expect.stringMatching(/^recharge-practitioner_123-\d+$/),
          metadata: expect.objectContaining({
            type: "account_recharge",
            practitionerId: mockUser.id,
          }),
        })
      );
    });

    it("should validate minimum amount", async () => {
      const rechargeDto = { amount: 5 }; // Below minimum

      await expect(
        controller.rechargeAccount(mockUser, rechargeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should validate maximum amount", async () => {
      const rechargeDto = { amount: 15000 }; // Above maximum

      await expect(
        controller.rechargeAccount(mockUser, rechargeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should handle Stripe API errors gracefully", async () => {
      const rechargeDto = { amount: 100 };
      mockPaymentService.createPaymentIntent.mockRejectedValue(
        new Error("Stripe API error"),
      );

      await expect(
        controller.rechargeAccount(mockUser, rechargeDto),
      ).rejects.toThrow();
    });
  });
});
