import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
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
}
