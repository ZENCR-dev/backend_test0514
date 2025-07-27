import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
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
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsDateString,
  ValidateIf,
  IsArray,
  ValidateNested,
  IsNumber,
  IsUUID,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { PurchaseOrderService } from "../services/purchase-order.service";
import { PrescriptionPurchaseOrderService } from "../services/prescription-purchase-order.service";
import { ApiResponse } from "../../common/dto/api-response.dto";

class PrescriptionPOItemDto {
  @ApiProperty({
    description: "药品ID",
    example: "med-123-456",
  })
  @IsString()
  @IsUUID()
  medicineId: string;

  @ApiProperty({
    description: "药品名称",
    example: "阿莫西林胶囊",
  })
  @IsString()
  medicineName: string;

  @ApiProperty({
    description: "数量",
    example: 10,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: "重量/剂量",
    example: 5.5,
  })
  @IsNumber()
  @Min(0.1)
  weight: number;

  @ApiProperty({
    description: "单价",
    example: 12.5,
  })
  @IsNumber()
  @Min(0.01)
  unitPrice: number;

  @ApiProperty({
    description: "总价",
    example: 125.0,
  })
  @IsNumber()
  @Min(0.01)
  totalPrice: number;

  @ApiProperty({
    description: "用药说明",
    example: "每日三次，饭后服用",
  })
  @IsString()
  dosageInstructions: string;

  @ApiProperty({
    description: "附加说明",
    example: "注意过敏反应",
    required: false,
  })
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @ApiProperty({
    description: "GST金额（由系统计算）",
    example: 18.75,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  gstAmount?: number;

  @ApiProperty({
    description: "净金额（由系统计算）",
    example: 106.25,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  netAmount?: number;
}

class CreatePrescriptionPODto {
  @ApiProperty({
    description: "处方ID",
    example: "prescription-123",
  })
  @IsString()
  @IsUUID()
  prescriptionId: string;

  @ApiProperty({
    description: "订单ID（可选）",
    example: "order-456",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  orderId?: string;

  @ApiProperty({
    description: "履行证明ID",
    example: "fulfillment-789",
  })
  @IsString()
  @IsUUID()
  fulfillmentProofId: string;

  @ApiProperty({
    description: "处方药品列表",
    type: [PrescriptionPOItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionPOItemDto)
  prescriptionItems: PrescriptionPOItemDto[];

  @ApiProperty({
    description: "元数据",
    example: { notes: "Special handling required" },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

class UpdatePrescriptionPODto {
  @ApiProperty({
    description: "更新的处方药品列表",
    type: [PrescriptionPOItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionPOItemDto)
  prescriptionItems: PrescriptionPOItemDto[];
}

class PurchaseOrderQueryDto {
  @ApiProperty({
    description: "采购订单状态",
    example: "pending_review",
    enum: ["pending_review", "approved", "rejected", "paid"],
    required: false,
  })
  @IsOptional()
  @IsString({ message: "状态必须是字符串" })
  @IsIn(["pending_review", "approved", "rejected", "paid"], {
    message: "状态必须是pending_review、approved、rejected或paid之一",
  })
  status?: "pending_review" | "approved" | "rejected" | "paid";

  @ApiProperty({
    description: "开始日期（YYYY-MM-DD格式）",
    example: "2024-01-01",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "开始日期格式无效，请使用YYYY-MM-DD格式" })
  @ValidateIf((o) => !o.endDate || o.startDate <= o.endDate, {
    message: "开始日期不能晚于结束日期",
  })
  startDate?: string;

  @ApiProperty({
    description: "结束日期（YYYY-MM-DD格式）",
    example: "2024-12-31",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "结束日期格式无效，请使用YYYY-MM-DD格式" })
  endDate?: string;

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
}

@ApiTags("药房-采购订单")
@Controller("pharmacy/purchase-orders")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("pharmacy_operator")
@ApiBearerAuth()
export class PurchaseOrderController {
  constructor(
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly prescriptionPOService: PrescriptionPurchaseOrderService,
  ) {}

  @Get()
  @ApiOperation({ summary: "获取采购订单列表" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getPurchaseOrders(
    @Query() query: PurchaseOrderQueryDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.purchaseOrderService.getPurchaseOrders(pharmacyId, {
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    });
  }

  @Get("withdrawable")
  @ApiOperation({ summary: "获取可提现的采购订单" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getWithdrawablePurchaseOrders(@CurrentUser() user: any) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.purchaseOrderService.getWithdrawablePurchaseOrders(
      pharmacyId,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "获取采购订单详情" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: "采购订单不存在",
  })
  async getPurchaseOrderDetail(
    @Param("id") poId: string,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.purchaseOrderService.getPurchaseOrderDetail(
      poId,
      pharmacyId,
    );
  }

  @Post("prescription")
  @ApiOperation({ summary: "从处方生成采购订单" })
  @SwaggerApiResponse({
    status: 201,
    description: "生成成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "请求参数错误",
  })
  @SwaggerApiResponse({
    status: 404,
    description: "处方不存在",
  })
  async createPrescriptionPO(
    @Body() createDto: CreatePrescriptionPODto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    const transformedItems = createDto.prescriptionItems.map(item => ({
      ...item,
      gstAmount: item.gstAmount || 0, // Will be recalculated by service
      netAmount: item.netAmount || 0, // Will be recalculated by service
    }));

    return await this.prescriptionPOService.generateFromPrescription({
      pharmacyId,
      prescriptionId: createDto.prescriptionId,
      orderId: createDto.orderId,
      fulfillmentProofId: createDto.fulfillmentProofId,
      prescriptionItems: transformedItems,
      metadata: createDto.metadata,
    });
  }

  @Get("prescription/:prescriptionId")
  @ApiOperation({ summary: "根据处方ID获取相关采购订单" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getPrescriptionPOs(
    @Param("prescriptionId") prescriptionId: string,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.prescriptionPOService.getByPrescriptionId(
      prescriptionId,
      pharmacyId,
    );
  }

  @Put(":id/prescription-items")
  @ApiOperation({ summary: "更新采购订单的处方药品项目" })
  @SwaggerApiResponse({
    status: 200,
    description: "更新成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "请求参数错误",
  })
  @SwaggerApiResponse({
    status: 404,
    description: "采购订单不存在",
  })
  async updatePrescriptionItems(
    @Param("id") poId: string,
    @Body() updateDto: UpdatePrescriptionPODto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    const transformedItems = updateDto.prescriptionItems.map(item => ({
      ...item,
      gstAmount: item.gstAmount || 0, // Will be recalculated by service
      netAmount: item.netAmount || 0, // Will be recalculated by service
    }));

    return await this.prescriptionPOService.updatePrescriptionItems(
      poId,
      transformedItems,
      pharmacyId,
    );
  }

  @Get(":id/gst-summary")
  @ApiOperation({ summary: "获取采购订单GST计算摘要" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getGSTSummary(
    @Param("id") poId: string,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    // First get the PO to extract items
    const poDetail = await this.purchaseOrderService.getPurchaseOrderDetail(
      poId,
      pharmacyId,
    );

    if (!poDetail.success || !poDetail.data) {
      throw new BadRequestException("采购订单不存在");
    }

    const items = poDetail.data.items || [];
    
    // Transform legacy items to PrescriptionPOItem format if needed
    const transformedItems = items.map((item: any) => ({
      medicineId: item.medicineId || '',
      medicineName: item.medicineName || item.description || item.name || '',
      quantity: item.quantity || 1,
      weight: item.weight || item.doses || 1,
      unitPrice: item.unitPrice || item.originalUnitPrice || 0,
      totalPrice: item.totalPrice || 0,
      dosageInstructions: item.dosageInstructions || '',
      additionalNotes: item.additionalNotes || '',
      gstAmount: item.gstAmount || 0,
      netAmount: item.netAmount || 0,
    }));
    
    const gstSummary = this.prescriptionPOService.getGSTSummary(transformedItems);

    return {
      success: true,
      data: gstSummary,
    };
  }
}
