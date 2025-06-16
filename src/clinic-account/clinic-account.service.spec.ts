import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ClinicAccountService } from "./services/clinic-account.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClinicAccountDto } from "./dto/create-clinic-account.dto";
import { AccountStatus } from "@prisma/client";
import { UpdateClinicAccountDto } from "./dto/update-clinic-account.dto";
import { QueryClinicAccountDto } from "./dto/query-clinic-account.dto";

describe("ClinicAccountService", () => {
  let service: ClinicAccountService;
  let prismaService: PrismaService;

  const mockAccount = {
    id: "test-account-id",
    clinicId: "test-clinic-id",
    balance: 1000,
    creditLimit: 500,
    usedCredit: 0,
    availableCredit: 500,
    status: AccountStatus.active,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    clinic: { name: "测试诊所", ownerId: "user-1" }, // 模拟关联的clinic数据
  };

  const mockPrismaService = {
    clinicAccount: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
    },
    accountTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicAccountService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClinicAccountService>(ClinicAccountService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createDto: CreateClinicAccountDto = {
      clinicId: "test-clinic-id",
      initialPrepaidAmount: 1000,
      creditLimit: 500,
      status: AccountStatus.active,
    };

    it("应该成功创建诊所账户", async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.clinicAccount.create.mockResolvedValue(mockAccount);

      const result = await service.create(createDto);

      expect(mockPrismaService.clinicAccount.findFirst).toHaveBeenCalledWith({
        where: {
          clinicId: createDto.clinicId,
          status: {
            not: AccountStatus.frozen,
          },
        },
      });

      expect(mockPrismaService.clinicAccount.create).toHaveBeenCalledWith({
        data: {
          clinicId: createDto.clinicId,
          balance: createDto.initialPrepaidAmount,
          creditLimit: createDto.creditLimit,
          status: createDto.status,
          version: 1,
        },
        include: {
          clinic: true,
        },
      });

      expect(result.id).toBe(mockAccount.id);
      expect(result.clinicName).toBe("测试诊所");
    });

    it("当诊所已存在账户时应该抛出错误", async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.clinicAccount.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    const queryDto: QueryClinicAccountDto = {
      page: 1,
      limit: 10,
      search: "测试",
      status: AccountStatus.active,
    };

    it("应该返回分页的诊所账户列表", async () => {
      const mockAccounts = [mockAccount];
      const mockTotal = 1;

      mockPrismaService.clinicAccount.findMany.mockResolvedValue(mockAccounts);
      mockPrismaService.clinicAccount.count.mockResolvedValue(mockTotal);

      const result = await service.findAll(queryDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(mockTotal);
      expect(result.meta.page).toBe(queryDto.page);
      expect(result.meta.limit).toBe(queryDto.limit);
      expect(result.meta.totalPages).toBe(1);
    });

    it("应该支持搜索功能", async () => {
      mockPrismaService.clinicAccount.findMany.mockResolvedValue([]);
      mockPrismaService.clinicAccount.count.mockResolvedValue(0);

      await service.findAll(queryDto);

      expect(mockPrismaService.clinicAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: queryDto.status,
            clinic: {
              name: {
                contains: queryDto.search,
                mode: "insensitive",
              },
            },
          },
        }),
      );
    });
  });

  describe("findOne", () => {
    it("应该返回指定的诊所账户", async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);

      const result = await service.findOne(mockAccount.id);

      expect(mockPrismaService.clinicAccount.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockAccount.id,
          status: {
            not: AccountStatus.frozen,
          },
        },
        include: {
          clinic: true,
        },
      });

      expect(result.id).toBe(mockAccount.id);
    });

    it("当账户不存在时应该抛出NotFoundException", async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(null);

      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    const updateDto: UpdateClinicAccountDto = {
      creditLimit: 1000,
    };

    it("应该成功更新诊所账户", async () => {
      const updatedAccount = { ...mockAccount, ...updateDto };

      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);
      mockPrismaService.clinicAccount.update.mockResolvedValue(updatedAccount);

      const result = await service.update(mockAccount.id, updateDto);

      expect(mockPrismaService.clinicAccount.update).toHaveBeenCalledWith({
        where: {
          id: mockAccount.id,
          version: 1,
        },
        data: {
          ...updateDto,
          updatedAt: expect.any(Date),
          version: { increment: 1 },
        },
        include: {
          clinic: true,
        },
      });

      expect(result.creditLimit).toBe(updateDto.creditLimit);
    });
  });

  describe("remove", () => {
    it("应该成功软删除诊所账户", async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);
      mockPrismaService.clinicAccount.update.mockResolvedValue({
        ...mockAccount,
        status: AccountStatus.frozen,
      });

      const result = await service.remove(mockAccount.id);

      expect(mockPrismaService.clinicAccount.update).toHaveBeenCalledWith({
        where: {
          id: mockAccount.id,
          version: 1,
        },
        data: {
          status: AccountStatus.frozen,
          updatedAt: expect.any(Date),
          version: { increment: 1 },
        },
      });

      expect(result.message).toBe("诊所账户删除成功");
    });
  });

  describe("getBalance", () => {
    it("应该返回账户余额信息", async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);

      const result = await service.getBalance(mockAccount.id);

      expect(result.accountId).toBe(mockAccount.id);
      expect(result.prepaidBalance).toBe(1000);
      expect(result.creditLimit).toBe(500);
      expect(result.availableBalance).toBe(1500);
    });
  });

  describe("checkAccountAccess", () => {
    it("admin应该能访问所有账户", async () => {
      const result = await service.checkAccountAccess(
        "any-account-id",
        "user-id",
        "admin",
      );
      expect(result).toBe(true);
    });

    it("practitioner应该只能访问自己诊所的账户", async () => {
      const mockAccountWithClinic = {
        ...mockAccount,
        clinic: { ownerId: "user-id" },
      };

      mockPrismaService.clinicAccount.findUnique.mockResolvedValue(
        mockAccountWithClinic,
      );

      const result = await service.checkAccountAccess(
        mockAccount.id,
        "user-id",
        "practitioner",
      );
      expect(result).toBe(true);
    });

    it("practitioner不应该能访问其他诊所的账户", async () => {
      const mockAccountWithClinic = {
        ...mockAccount,
        clinic: { ownerId: "other-user-id" },
      };

      mockPrismaService.clinicAccount.findUnique.mockResolvedValue(
        mockAccountWithClinic,
      );

      const result = await service.checkAccountAccess(
        mockAccount.id,
        "user-id",
        "practitioner",
      );
      expect(result).toBe(false);
    });
  });

  // A1前置修复：支付相关方法的测试用例
  describe("Payment-related methods (A1 prerequisite fix)", () => {
    describe("updateBalance", () => {
      it("should update balance successfully with positive amount", async () => {
        const mockUpdatedAccount = {
          ...mockAccount,
          balance: 1500, // 1000 + 500
          version: 2,
        };

        mockPrismaService.$transaction.mockImplementation(async (callback) => {
          return await callback({
            clinicAccount: {
              findFirst: jest.fn().mockResolvedValue(mockAccount),
              update: jest.fn().mockResolvedValue(mockUpdatedAccount),
            },
            accountTransaction: {
              create: jest.fn().mockResolvedValue({}),
            },
          });
        });

        const result = await service.updateBalance(
          "clinic-1",
          500,
          "deposit",
          "ref-123",
          "Test deposit",
        );

        expect(result).toBeDefined();
        expect(mockPrismaService.$transaction).toHaveBeenCalled();
      });

      it("should update balance successfully with negative amount (deduction)", async () => {
        const mockUpdatedAccount = {
          ...mockAccount,
          balance: 800, // 1000 - 200
          version: 2,
        };

        mockPrismaService.$transaction.mockImplementation(async (callback) => {
          return await callback({
            clinicAccount: {
              findFirst: jest.fn().mockResolvedValue(mockAccount),
              update: jest.fn().mockResolvedValue(mockUpdatedAccount),
            },
            accountTransaction: {
              create: jest.fn().mockResolvedValue({}),
            },
          });
        });

        const result = await service.updateBalance(
          "clinic-1",
          -200,
          "deduct",
          "order-456",
          "Order payment",
        );

        expect(result).toBeDefined();
        expect(mockPrismaService.$transaction).toHaveBeenCalled();
      });

      it("should throw BadRequestException for invalid parameters", async () => {
        await expect(service.updateBalance("", 0, "test")).rejects.toThrow(
          BadRequestException,
        );
      });

      it("should throw BadRequestException for insufficient balance", async () => {
        mockPrismaService.$transaction.mockImplementation(async (callback) => {
          return await callback({
            clinicAccount: {
              findFirst: jest.fn().mockResolvedValue(mockAccount),
              update: jest.fn(),
            },
            accountTransaction: {
              create: jest.fn(),
            },
          });
        });

        await expect(
          service.updateBalance("clinic-1", -2000, "deduct"),
        ).rejects.toThrow(BadRequestException);
      });

      it("should handle optimistic lock conflict", async () => {
        const prismaError = new Error("Optimistic lock conflict");
        (prismaError as any).code = "P2034";

        mockPrismaService.$transaction.mockImplementation(async (callback) => {
          return await callback({
            clinicAccount: {
              findFirst: jest.fn().mockResolvedValue(mockAccount),
              update: jest.fn().mockRejectedValue(prismaError),
            },
            accountTransaction: {
              create: jest.fn(),
            },
          });
        });

        await expect(
          service.updateBalance("clinic-1", 100, "deposit"),
        ).rejects.toThrow();
      });
    });

    describe("deductBalance", () => {
      it("should deduct balance successfully", async () => {
        const mockUpdatedAccount = {
          ...mockAccount,
          balance: 700, // 1000 - 300
          version: 2,
        };

        jest.spyOn(service, "updateBalance").mockResolvedValue({
          id: mockUpdatedAccount.id,
          clinicName: mockAccount.clinic.name,
          clinicId: mockUpdatedAccount.clinicId,
          prepaidBalance: parseFloat(mockUpdatedAccount.balance.toString()),
          creditLimit: parseFloat(mockUpdatedAccount.creditLimit.toString()),
          availableBalance:
            parseFloat(mockUpdatedAccount.balance.toString()) +
            parseFloat(mockUpdatedAccount.creditLimit.toString()),
          status: mockUpdatedAccount.status,
          version: mockUpdatedAccount.version,
          notes: "",
          createdAt: mockUpdatedAccount.createdAt,
          updatedAt: mockUpdatedAccount.updatedAt,
        });

        const result = await service.deductBalance(
          "clinic-1",
          300,
          "order-789",
          "Order payment deduction",
        );

        expect(result).toBeDefined();
        expect(service.updateBalance).toHaveBeenCalledWith(
          "clinic-1",
          -300,
          "deduct",
          "order-789",
          "Order payment deduction",
        );
      });

      it("should throw BadRequestException for negative or zero amount", async () => {
        await expect(service.deductBalance("clinic-1", -100)).rejects.toThrow(
          "扣款金额必须大于0",
        );

        await expect(service.deductBalance("clinic-1", 0)).rejects.toThrow(
          "扣款金额必须大于0",
        );
      });
    });

    describe("refundBalance", () => {
      it("should refund balance successfully", async () => {
        const mockUpdatedAccount = {
          ...mockAccount,
          balance: 1200, // 1000 + 200
          version: 2,
        };

        jest.spyOn(service, "updateBalance").mockResolvedValue({
          id: mockUpdatedAccount.id,
          clinicName: mockAccount.clinic.name,
          clinicId: mockUpdatedAccount.clinicId,
          prepaidBalance: parseFloat(mockUpdatedAccount.balance.toString()),
          creditLimit: parseFloat(mockUpdatedAccount.creditLimit.toString()),
          availableBalance:
            parseFloat(mockUpdatedAccount.balance.toString()) +
            parseFloat(mockUpdatedAccount.creditLimit.toString()),
          status: mockUpdatedAccount.status,
          version: mockUpdatedAccount.version,
          notes: "",
          createdAt: mockUpdatedAccount.createdAt,
          updatedAt: mockUpdatedAccount.updatedAt,
        });

        const result = await service.refundBalance(
          "clinic-1",
          200,
          "refund-456",
          "Order refund",
        );

        expect(result).toBeDefined();
        expect(service.updateBalance).toHaveBeenCalledWith(
          "clinic-1",
          200,
          "refund",
          "refund-456",
          "Order refund",
        );
      });

      it("should throw BadRequestException for negative or zero amount", async () => {
        await expect(service.refundBalance("clinic-1", -50)).rejects.toThrow(
          "退款金额必须大于0",
        );

        await expect(service.refundBalance("clinic-1", 0)).rejects.toThrow(
          "退款金额必须大于0",
        );
      });
    });

    describe("getTransactionHistory", () => {
      it("should return transaction history with pagination", async () => {
        const mockTransactions = [
          {
            id: "tx-1",
            amount: -300,
            transactionType: "DEBIT",
            referenceId: "order-123",
            referenceType: "ORDER",
            description: "订单支付扣款",
            balanceBefore: 1000,
            balanceAfter: 700,
            creditBefore: 0,
            creditAfter: 0,
            createdAt: new Date("2025-01-01T10:00:00Z"),
          },
          {
            id: "tx-2",
            amount: 500,
            transactionType: "CREDIT",
            referenceId: "deposit-456",
            referenceType: "RECHARGE",
            description: "账户充值",
            balanceBefore: 500,
            balanceAfter: 1000,
            creditBefore: 0,
            creditAfter: 0,
            createdAt: new Date("2025-01-01T09:00:00Z"),
          },
        ];

        mockPrismaService.accountTransaction.findMany.mockResolvedValue(
          mockTransactions,
        );
        mockPrismaService.accountTransaction.count.mockResolvedValue(2);

        const result = await service.getTransactionHistory("account-1", 1, 10);

        expect(result).toBeDefined();
        expect(result.data).toHaveLength(2);
        expect(result.meta.total).toBe(2);
        expect(
          mockPrismaService.accountTransaction.findMany,
        ).toHaveBeenCalledWith({
          where: {
            accountId: "account-1",
          },
          skip: 0,
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
        });
      });

      it("should use default pagination parameters", async () => {
        mockPrismaService.accountTransaction.findMany.mockResolvedValue([]);
        mockPrismaService.accountTransaction.count.mockResolvedValue(0);

        const result = await service.getTransactionHistory("account-1");

        expect(result).toBeDefined();
        expect(result.data).toHaveLength(0);
        expect(result.meta.total).toBe(0);
        expect(
          mockPrismaService.accountTransaction.findMany,
        ).toHaveBeenCalledWith({
          where: {
            accountId: "account-1",
          },
          skip: 0,
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
        });
      });
    });
  });
});
