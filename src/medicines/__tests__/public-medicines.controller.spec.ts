import { Test, TestingModule } from "@nestjs/testing";
import { PublicMedicinesController } from "../public-medicines.controller";
import { MedicinesService } from "../medicines.service";

describe("PublicMedicinesController", () => {
  let controller: PublicMedicinesController;
  let medicinesService: MedicinesService;

  const mockMedicinesService = {
    findAll: jest.fn(),
    getCategories: jest.fn(),
    getPopularMedicines: jest.fn(),
    getSearchSuggestions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicMedicinesController],
      providers: [
        {
          provide: MedicinesService,
          useValue: mockMedicinesService,
        },
      ],
    }).compile();

    controller = module.get<PublicMedicinesController>(
      PublicMedicinesController,
    );
    medicinesService = module.get<MedicinesService>(MedicinesService);

    jest.clearAllMocks();
  });

  describe("findPublicMedicines", () => {
    it("应该返回标准化的药品搜索结果", async () => {
      const mockResult = {
        success: true,
        data: [
          {
            id: "med-1",
            name: "阿司匹林",
            sku: "ASP001",
            category: "解热镇痛药",
            description: "用于解热镇痛",
          },
        ],
        meta: {
          timestamp: "2025-01-09T10:30:00.000Z",
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        },
      };

      mockMedicinesService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findPublicMedicines({
        search: "阿司匹林",
        page: 1,
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data.medicines).toEqual(mockResult.data);
      expect(result.data.pagination).toEqual(mockResult.meta.pagination);
      expect(result.message).toBe("药品搜索成功");
      expect(result.meta.isPublic).toBe(true);
      expect(result.meta.source).toBe("public-medicines-api");
    });

    it("应该限制查询参数的最大值", async () => {
      const mockResult = {
        success: true,
        data: [],
        meta: {
          timestamp: "2025-01-09T10:30:00.000Z",
          pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
        },
      };

      mockMedicinesService.findAll.mockResolvedValue(mockResult);

      await controller.findPublicMedicines({
        search: "test",
        page: 1,
        limit: 200, // 超过最大限制
      });

      expect(mockMedicinesService.findAll).toHaveBeenCalledWith({
        search: "test",
        page: 1,
        limit: 100, // 应该被限制为100
      });
    });

    it("应该处理搜索错误", async () => {
      mockMedicinesService.findAll.mockRejectedValue(
        new Error("数据库连接失败"),
      );

      const result = await controller.findPublicMedicines({
        search: "test",
      });

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.message).toContain("药品搜索失败");
      expect(result.meta.error).toBe("Error");
    });
  });

  describe("getCategories", () => {
    it("应该返回药品分类列表", async () => {
      const mockCategories = ["解热镇痛药", "抗生素", "维生素", "心血管药物"];

      mockMedicinesService.getCategories.mockResolvedValue(mockCategories);

      const result = await controller.getCategories();

      expect(result.success).toBe(true);
      expect(result.data.categories).toEqual(mockCategories);
      expect(result.message).toBe("药品分类获取成功");
      expect(result.meta.isPublic).toBe(true);
    });

    it("应该处理分类获取错误", async () => {
      mockMedicinesService.getCategories.mockRejectedValue(
        new Error("查询失败"),
      );

      const result = await controller.getCategories();

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.message).toContain("分类获取失败");
    });
  });

  describe("getPopularMedicines", () => {
    it("应该返回热门药品列表", async () => {
      const mockPopularMedicines = [
        {
          id: "med-1",
          name: "阿司匹林",
          sku: "ASP001",
          searchCount: 150,
        },
        {
          id: "med-2",
          name: "布洛芬",
          sku: "IBU001",
          searchCount: 120,
        },
      ];

      mockMedicinesService.getPopularMedicines.mockResolvedValue(
        mockPopularMedicines,
      );

      const result = await controller.getPopularMedicines(10);

      expect(result.success).toBe(true);
      expect(result.data.medicines).toEqual(mockPopularMedicines);
      expect(result.data.count).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(mockMedicinesService.getPopularMedicines).toHaveBeenCalledWith(10);
    });

    it("应该限制返回数量的最大值", async () => {
      mockMedicinesService.getPopularMedicines.mockResolvedValue([]);

      await controller.getPopularMedicines(100); // 超过最大限制

      expect(mockMedicinesService.getPopularMedicines).toHaveBeenCalledWith(50); // 应该被限制为50
    });

    it("应该使用默认限制值", async () => {
      mockMedicinesService.getPopularMedicines.mockResolvedValue([]);

      await controller.getPopularMedicines();

      expect(mockMedicinesService.getPopularMedicines).toHaveBeenCalledWith(10); // 默认值
    });
  });

  describe("getSearchSuggestions", () => {
    it("应该返回搜索建议", async () => {
      const mockSuggestions = ["阿司匹林", "阿莫西林", "阿奇霉素"];

      mockMedicinesService.getSearchSuggestions.mockResolvedValue(
        mockSuggestions,
      );

      const result = await controller.getSearchSuggestions("阿", 5);

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toEqual(mockSuggestions);
      expect(result.data.query).toBe("阿");
      expect(result.data.count).toBe(3);
      expect(result.meta.limit).toBe(5);
      expect(mockMedicinesService.getSearchSuggestions).toHaveBeenCalledWith(
        "阿",
        5,
      );
    });

    it("应该拒绝空的搜索关键词", async () => {
      const result = await controller.getSearchSuggestions("", 5);

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.message).toBe("搜索关键词不能为空");
      expect(mockMedicinesService.getSearchSuggestions).not.toHaveBeenCalled();
    });

    it("应该拒绝只有空格的搜索关键词", async () => {
      const result = await controller.getSearchSuggestions("   ", 5);

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.message).toBe("搜索关键词不能为空");
    });

    it("应该限制建议数量的最大值", async () => {
      mockMedicinesService.getSearchSuggestions.mockResolvedValue([]);

      await controller.getSearchSuggestions("test", 50); // 超过最大限制

      expect(mockMedicinesService.getSearchSuggestions).toHaveBeenCalledWith(
        "test",
        20,
      ); // 应该被限制为20
    });

    it("应该使用默认建议数量", async () => {
      mockMedicinesService.getSearchSuggestions.mockResolvedValue([]);

      await controller.getSearchSuggestions("test");

      expect(mockMedicinesService.getSearchSuggestions).toHaveBeenCalledWith(
        "test",
        5,
      ); // 默认值
    });

    it("应该处理搜索建议错误", async () => {
      mockMedicinesService.getSearchSuggestions.mockRejectedValue(
        new Error("搜索失败"),
      );

      const result = await controller.getSearchSuggestions("test", 5);

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.message).toContain("搜索建议获取失败");
    });

    it("应该去除搜索关键词的前后空格", async () => {
      mockMedicinesService.getSearchSuggestions.mockResolvedValue(["test"]);

      await controller.getSearchSuggestions("  test  ", 5);

      expect(mockMedicinesService.getSearchSuggestions).toHaveBeenCalledWith(
        "test",
        5,
      );
    });
  });

  describe("响应格式验证", () => {
    it("所有成功响应应该包含标准字段", async () => {
      mockMedicinesService.findAll.mockResolvedValue({
        success: true,
        data: [],
        meta: {
          timestamp: "2025-01-09T10:30:00.000Z",
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
      });

      const result = await controller.findPublicMedicines({});

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("meta");
      expect(result.meta).toHaveProperty("timestamp");
      expect(result.meta).toHaveProperty("source");
      expect(result.meta).toHaveProperty("version");
      expect(result.meta).toHaveProperty("isPublic");
    });

    it("所有错误响应应该包含标准字段", async () => {
      mockMedicinesService.findAll.mockRejectedValue(new Error("测试错误"));

      const result = await controller.findPublicMedicines({});

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("data", null);
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("meta");
      expect(result.meta).toHaveProperty("timestamp");
      expect(result.meta).toHaveProperty("source");
      expect(result.meta).toHaveProperty("error");
    });
  });
});
