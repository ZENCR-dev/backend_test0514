import { Controller, Get, Query, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { MedicinesService } from "./medicines.service";
import { FindMedicinesDto } from "./dto/find-medicines.dto";
import { MedicineResponseV12Dto } from "./dto/medicine-response-v12.dto";

@ApiTags("公共药品API")
@Controller("public/medicines")
export class PublicMedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  @ApiOperation({
    summary: "公共药品搜索",
    description: "无需认证的药品搜索接口，支持关键词搜索、分类筛选和分页",
  })
  @ApiQuery({ name: "search", required: false, description: "搜索关键词" })
  @ApiQuery({ name: "category", required: false, description: "药品分类" })
  @ApiQuery({ name: "page", required: false, description: "页码，默认1" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "每页数量，默认20，最大100",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "药品搜索成功",
    type: MedicineResponseV12Dto,
  })
  async findPublicMedicines(@Query() query: FindMedicinesDto) {
    try {
      // 限制公共API的查询参数
      const publicQuery = {
        ...query,
        limit: Math.min(query.limit || 20, 100), // 最大限制100条
        page: query.page || 1,
      };

      const result = await this.medicinesService.findAll(publicQuery);

      return {
        success: true,
        data: {
          medicines: result.data,
          pagination: result.meta.pagination,
        },
        message: "药品搜索成功",
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          version: "v1.2",
          isPublic: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `药品搜索失败: ${error.message}`,
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          error: error.name,
        },
      };
    }
  }

  @Get("categories")
  @ApiOperation({
    summary: "获取药品分类",
    description: "获取所有可用的药品分类列表",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "分类获取成功",
  })
  async getCategories() {
    try {
      const categories = await this.medicinesService.getCategories();

      return {
        success: true,
        data: {
          categories,
        },
        message: "药品分类获取成功",
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          version: "v1.2",
          isPublic: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `分类获取失败: ${error.message}`,
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          error: error.name,
        },
      };
    }
  }

  @Get("popular")
  @ApiOperation({
    summary: "获取热门药品",
    description: "获取搜索频率最高的热门药品列表",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "返回数量，默认10，最大50",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "热门药品获取成功",
  })
  async getPopularMedicines(@Query("limit") limit?: number) {
    try {
      const actualLimit = Math.min(limit || 10, 50);
      const medicines =
        await this.medicinesService.getPopularMedicines(actualLimit);

      return {
        success: true,
        data: {
          medicines,
          count: medicines.length,
        },
        message: "热门药品获取成功",
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          version: "v1.2",
          isPublic: true,
          limit: actualLimit,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `热门药品获取失败: ${error.message}`,
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          error: error.name,
        },
      };
    }
  }

  @Get("search/suggestions")
  @ApiOperation({
    summary: "搜索建议",
    description: "根据输入关键词提供搜索建议",
  })
  @ApiQuery({ name: "q", required: true, description: "搜索关键词" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "建议数量，默认5，最大20",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "搜索建议获取成功",
  })
  async getSearchSuggestions(
    @Query("q") query: string,
    @Query("limit") limit?: number,
  ) {
    try {
      if (!query || query.trim().length < 1) {
        return {
          success: false,
          data: null,
          message: "搜索关键词不能为空",
          meta: {
            timestamp: new Date().toISOString(),
            source: "public-medicines-api",
          },
        };
      }

      const actualLimit = Math.min(limit || 5, 20);
      const suggestions = await this.medicinesService.getSearchSuggestions(
        query.trim(),
        actualLimit,
      );

      return {
        success: true,
        data: {
          suggestions,
          query: query.trim(),
          count: suggestions.length,
        },
        message: "搜索建议获取成功",
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          version: "v1.2",
          isPublic: true,
          limit: actualLimit,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `搜索建议获取失败: ${error.message}`,
        meta: {
          timestamp: new Date().toISOString(),
          source: "public-medicines-api",
          error: error.name,
        },
      };
    }
  }
}
