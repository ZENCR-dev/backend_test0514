import { Test, TestingModule } from "@nestjs/testing";
import { MedicinesService } from "./medicines.service";
import { PrismaService } from "../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

describe("MedicinesService", () => {
  let service: MedicinesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicinesService,
        {
          provide: PrismaService,
          useValue: {
            medicine: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MedicinesService>(MedicinesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("should return medicines in v1.2 format", async () => {
      // Mock数据
      const mockMedicines = [
        {
          id: "1",
          name: "当归",
          chineseName: "当归",
          englishName: "Angelica",
          pinyinName: "dang gui",
          sku: "DG001",
          description: "补血活血",
          category: "补益药",
          unit: "克",
          requiresPrescription: false,
          basePrice: new Decimal(10.5),
          metadata: {},
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCount = 1;

      // Mock Prisma调用
      (prismaService.$transaction as jest.Mock).mockResolvedValue([
        mockMedicines,
        mockCount,
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        sortBy: "name",
        sortOrder: "asc",
      });

      // 验证v1.2格式
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("meta");
      expect(result.meta).toHaveProperty("timestamp");
      expect(result.meta).toHaveProperty("pagination");

      // 验证分页信息
      expect(result.meta.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      // 验证数据格式
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty("id", "1");
      expect(result.data[0]).toHaveProperty("basePrice", 10.5);
    });

    it("should handle search query", async () => {
      const mockMedicines = [];
      const mockCount = 0;

      (prismaService.$transaction as jest.Mock).mockResolvedValue([
        mockMedicines,
        mockCount,
      ]);

      const result = await service.findAll({
        search: "当归",
        page: 1,
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.meta.pagination.total).toBe(0);
    });

    it("should handle pagination correctly", async () => {
      const mockMedicines = [];
      const mockCount = 100;

      (prismaService.$transaction as jest.Mock).mockResolvedValue([
        mockMedicines,
        mockCount,
      ]);

      const result = await service.findAll({
        page: 3,
        limit: 20,
      });

      expect(result.meta.pagination).toEqual({
        total: 100,
        page: 3,
        limit: 20,
        totalPages: 5,
      });
    });
  });
});
