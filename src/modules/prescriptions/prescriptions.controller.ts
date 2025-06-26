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
  ApiParam,
  ApiQuery,
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
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { type: "object" },
        message: { type: "string", example: "处方创建成功" },
      },
    },
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
  @ApiQuery({ name: "page", required: false, type: Number, description: "页码" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "每页数量" })
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
  @ApiParam({ name: "id", description: "处方ID" })
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
  @ApiParam({ name: "id", description: "处方ID" })
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
  @ApiParam({ name: "id", description: "处方ID" })
  @ApiResponse({
    status: 200,
    description: "处方删除成功",
  })
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.remove(id, user.id);
  }

  @Post(":id/issue")
  @ApiOperation({
    summary: "开具处方",
    description: "将草稿状态的处方正式开具，生成QR码",
  })
  @ApiParam({ name: "id", description: "处方ID" })
  @ApiResponse({
    status: 200,
    description: "处方开具成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            qrCodeString: { type: "string", description: "QR码字符串" },
          },
        },
        message: { type: "string", example: "处方开具成功" },
      },
    },
  })
  async issuePrescription(@Param("id") id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.issuePrescription(id, user.id);
  }

  @Post("verify")
  @ApiOperation({
    summary: "验证处方",
    description: "通过QR码验证处方的真实性和有效性",
  })
  @ApiResponse({
    status: 200,
    description: "处方验证成功",
  })
  async verifyPrescription(@Body() body: { qrCodeString: string }) {
    return this.prescriptionsService.verifyPrescription(body.qrCodeString);
  }

  @Patch(":id/status")
  @ApiOperation({
    summary: "更新处方状态",
    description: "更新处方的状态（如：已配药、已完成等）",
  })
  @ApiParam({ name: "id", description: "处方ID" })
  @ApiResponse({
    status: 200,
    description: "处方状态更新成功",
  })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { status: string },
    @CurrentUser() user: any,
  ) {
    return this.prescriptionsService.updateStatus(id, body.status, user.id);
  }

  @Get("categories/summary")
  @ApiOperation({
    summary: "获取处方分类统计",
    description: "获取医生处方的状态分类统计",
  })
  @ApiResponse({
    status: 200,
    description: "成功获取分类统计",
  })
  async getCategorySummary(@CurrentUser() user: any) {
    // 简单的统计实现
    const prescriptions = await this.prescriptionsService.findAll(user.id, { page: 1, limit: 1000 });
    
    const summary = {
      total: prescriptions.data.length,
      draft: prescriptions.data.filter(p => p.status === 'DRAFT').length,
      issued: prescriptions.data.filter(p => p.status === 'PAID').length, // PAID对应已开具
      dispensed: prescriptions.data.filter(p => p.status === 'FULFILLED').length,
    };

    return {
      success: true,
      data: summary,
      message: "获取分类统计成功",
    };
  }
}
