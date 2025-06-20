import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { PrescriptionsService } from "./prescriptions.service";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";

@ApiTags("prescriptions")
@Controller("prescriptions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("jwt")
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @ApiOperation({
    summary: "创建处方",
    description: "医生创建新的中医处方",
  })
  @ApiResponse({
    status: 201,
    description: "处方创建成功",
  })
  async create(
    @Body() createPrescriptionDto: CreatePrescriptionDto,
    @CurrentUser() user: any,
  ) {
    return this.prescriptionsService.create(createPrescriptionDto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: "获取处方列表",
    description: "获取当前医生的处方列表",
  })
  @ApiResponse({
    status: 200,
    description: "成功获取处方列表",
  })
  async findAll(
    @CurrentUser() user: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.prescriptionsService.findAll(user.id, { page, limit });
  }

  @Get(":id")
  @ApiOperation({
    summary: "获取处方详情",
    description: "根据ID获取具体处方信息",
  })
  @ApiResponse({
    status: 200,
    description: "成功获取处方详情",
  })
  async findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.findOne(id, user.id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "更新处方",
    description: "更新现有处方信息",
  })
  @ApiResponse({
    status: 200,
    description: "处方更新成功",
  })
  async update(
    @Param("id") id: string,
    @Body() updatePrescriptionDto: Partial<CreatePrescriptionDto>,
    @CurrentUser() user: any,
  ) {
    return this.prescriptionsService.update(id, updatePrescriptionDto, user.id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "删除处方",
    description: "删除指定的处方",
  })
  @ApiResponse({
    status: 200,
    description: "处方删除成功",
  })
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.remove(id, user.id);
  }
}
