import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { PrescriptionScanService } from "../services/prescription-scan.service";
import { ApiResponse } from "../../common/dto/api-response.dto";

class ScanPrescriptionDto {
  @ApiProperty({
    description: "QR码字符串",
    example: "prescription_12345_67890",
    minLength: 10,
    maxLength: 200,
  })
  @IsString({ message: "QR码必须是字符串" })
  @IsNotEmpty({ message: "QR码不能为空" })
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: "QR码格式无效" })
  qrCodeString: string;

  @ApiProperty({
    description: "药房ID（可选，默认使用当前用户关联的药房）",
    example: "pharmacy_123",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "药房ID必须是字符串" })
  @IsNotEmpty({ message: "药房ID不能为空" })
  pharmacyId?: string;
}

class PendingPrescriptionsQueryDto {
  @ApiProperty({
    description: "页码",
    example: 1,
    minimum: 1,
    maximum: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "页码必须是整数" })
  @Min(1, { message: "页码必须大于等于1" })
  @Max(1000, { message: "页码不能超过1000" })
  page?: number = 1;

  @ApiProperty({
    description: "每页数量",
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "每页数量必须是整数" })
  @Min(1, { message: "每页数量必须大于等于1" })
  @Max(100, { message: "每页数量不能超过100" })
  limit?: number = 20;

  @ApiProperty({
    description: "时间范围",
    example: "today",
    enum: ["today", "week", "month"],
    required: false,
  })
  @IsOptional()
  @IsString({ message: "时间范围必须是字符串" })
  @IsIn(["today", "week", "month"], {
    message: "时间范围必须是today、week或month之一",
  })
  timeRange?: "today" | "week" | "month";
}

@ApiTags("药房-处方扫码")
@Controller("pharmacy/prescriptions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("pharmacy_operator")
@ApiBearerAuth()
export class PrescriptionScanController {
  constructor(
    private readonly prescriptionScanService: PrescriptionScanService,
  ) {}

  @Post("scan")
  @ApiOperation({ summary: "扫码获取处方信息" })
  @SwaggerApiResponse({
    status: 200,
    description: "扫码成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "无效的QR码或处方状态不正确",
  })
  @SwaggerApiResponse({
    status: 403,
    description: "处方已被其他药房处理",
  })
  async scanPrescription(
    @Body() scanDto: ScanPrescriptionDto,
    @CurrentUser() user: any,
  ) {
    // 从用户信息中获取药房ID
    const pharmacyId = user.operatedPharmacy?.id || scanDto.pharmacyId;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.prescriptionScanService.scanPrescription(
      scanDto.qrCodeString,
      pharmacyId,
    );
  }

  @Get("pending")
  @ApiOperation({ summary: "获取待履约处方列表" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getPendingPrescriptions(
    @Query() query: PendingPrescriptionsQueryDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.prescriptionScanService.getPendingPrescriptions(
      pharmacyId,
      {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        timeRange: query.timeRange,
      },
    );
  }
}
