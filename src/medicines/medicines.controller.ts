import { Controller, Get, Query, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { MedicinesService } from "./medicines.service";
import { FindMedicinesDto } from "./dto/find-medicines.dto";
import { MedicineResponseV12Dto } from "./dto/medicine-response-v12.dto";

@ApiTags("medicines")
@Controller("medicines")
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  @ApiOperation({
    summary: "获取药品列表",
    description: "支持分页、搜索和排序的药品列表查询",
  })
  @ApiResponse({
    status: 200,
    description: "成功获取药品列表",
    type: MedicineResponseV12Dto,
  })
  async findAll(
    @Query() query: FindMedicinesDto,
  ): Promise<MedicineResponseV12Dto> {
    return this.medicinesService.findAll(query);
  }

  @Get("categories")
  @ApiOperation({
    summary: "获取药品分类列表",
    description: "获取所有药品的分类信息",
  })
  @ApiResponse({
    status: 200,
    description: "成功获取分类列表",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", example: "补益药" },
              count: { type: "number", example: 12 },
            },
          },
        },
      },
    },
  })
  async getCategories() {
    return this.medicinesService.getCategories();
  }

  @Get(":id")
  @ApiOperation({
    summary: "获取药品详情",
    description: "根据ID获取单个药品的详细信息",
  })
  @ApiParam({
    name: "id",
    description: "药品ID",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "成功获取药品详情",
  })
  @ApiResponse({
    status: 404,
    description: "药品不存在",
  })
  async findOne(@Param("id") id: string) {
    return this.medicinesService.findOne(id);
  }
}
