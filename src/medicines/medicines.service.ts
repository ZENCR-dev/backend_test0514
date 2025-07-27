import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FindMedicinesDto } from "./dto/find-medicines.dto";
import { MedicineDto } from "./dto/medicine.dto";
import { MedicineResponseV12Dto } from "./dto/medicine-response-v12.dto";
import { transformToMedicineResponseV12 } from "./medicine-response-transformer";

@Injectable()
export class MedicinesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindMedicinesDto): Promise<MedicineResponseV12Dto> {
    const {
      search,
      page = 1,
      limit = 20,
      sortBy = "name",
      sortOrder = "asc",
    } = query;

    // 服务端验证 sortBy 字段
    const allowedSortBy = [
      "name",
      "pinyinName",
      "category",
      "createdAt",
      "updatedAt",
      "basePrice",
    ];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : "name";

    // 构建搜索条件
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { englishName: { contains: search, mode: "insensitive" as const } },
            { pinyinName: { contains: search, mode: "insensitive" as const } },
            { chineseName: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // 添加活跃状态过滤
    const whereClause = {
      ...where,
      status: "active",
    };

    // 计算分页参数
    const skip = (page - 1) * limit;
    const take = limit;

    // 构建排序参数
    const orderBy = { [safeSortBy]: sortOrder };

    // 并行执行查询和计数
    const [rawData, total] = await this.prisma.$transaction([
      this.prisma.medicine.findMany({
        where: whereClause,
        orderBy,
        skip,
        take,
      }),
      this.prisma.medicine.count({
        where: whereClause,
      }),
    ]);

    // 转换数据格式，特别是将Decimal转换为number
    const data: MedicineDto[] = rawData.map((medicine) => ({
      ...medicine,
      basePrice: medicine.basePrice.toNumber(),
    }));

    // 计算总页数
    const totalPages = Math.ceil(total / limit);

    // 使用transformer转换为v1.2格式
    return transformToMedicineResponseV12(data, total, page, limit, totalPages);
  }

  async getCategories() {
    const categories = await this.prisma.medicine.groupBy({
      by: ["category"],
      where: {
        status: "active",
      },
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: "desc",
        },
      },
    });

    return categories.map((item) => item.category);
  }

  async getPopularMedicines(limit: number = 10) {
    // 基于搜索频率或创建时间获取热门药品
    // 这里使用创建时间作为热门度指标，实际项目中可以基于搜索统计
    const medicines = await this.prisma.medicine.findMany({
      where: {
        status: "active",
      },
      orderBy: [
        { createdAt: "desc" }, // 最新创建的药品
        { name: "asc" }, // 按名称排序作为次要条件
      ],
      take: limit,
      select: {
        id: true,
        name: true,
        englishName: true,
        chineseName: true,
        pinyinName: true,
        sku: true,
        category: true,
        description: true,
        // 不包含价格等敏感信息
      },
    });

    return medicines;
  }

  async getSearchSuggestions(query: string, limit: number = 5) {
    // 获取搜索建议，基于药品名称匹配
    const suggestions = await this.prisma.medicine.findMany({
      where: {
        status: "active",
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { englishName: { contains: query, mode: "insensitive" as const } },
          { pinyinName: { contains: query, mode: "insensitive" as const } },
          { chineseName: { contains: query, mode: "insensitive" as const } },
        ],
      },
      select: {
        name: true,
        englishName: true,
        chineseName: true,
        category: true,
      },
      take: limit,
      orderBy: {
        name: "asc",
      },
    });

    // 返回去重的建议列表
    const suggestionSet = new Set<string>();

    suggestions.forEach((medicine) => {
      if (medicine.name) suggestionSet.add(medicine.name);
      if (medicine.englishName) suggestionSet.add(medicine.englishName);
      if (medicine.chineseName) suggestionSet.add(medicine.chineseName);
    });

    return Array.from(suggestionSet)
      .filter((suggestion) =>
        suggestion.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, limit);
  }

  async findOne(id: string) {
    const medicine = await this.prisma.medicine.findFirst({
      where: {
        id: id,
        status: "active",
      },
    });

    if (!medicine) {
      throw new NotFoundException(`药品 ID ${id} 不存在或已下架`);
    }

    // 转换数据格式，特别是将Decimal转换为number
    const formattedMedicine = {
      ...medicine,
      basePrice: medicine.basePrice.toNumber(),
    };

    return {
      success: true,
      data: formattedMedicine,
    };
  }
}
