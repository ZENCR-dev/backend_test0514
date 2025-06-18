import { Injectable } from "@nestjs/common";
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
    const allowedSortBy = ["name", "pinyinName", "category", "createdAt"];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : "name";

    // 构建搜索条件
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { englishName: { contains: search, mode: "insensitive" as const } },
            { pinyinName: { contains: search, mode: "insensitive" as const } },
            { chineseName: { contains: search, mode: "insensitive" as const } },
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
}
