import {
  Controller,
  Get,
  Post,
  Param,
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
  IsArray,
  IsUUID,
} from "class-validator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { InvoiceWithdrawalService } from "../services/invoice-withdrawal.service";
import { ApiResponse } from "../../common/dto/api-response.dto";

class CreateInvoiceDto {
  @ApiProperty({
    description: "采购订单ID列表",
    example: ["po-123", "po-456"],
  })
  @IsArray()
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  purchaseOrderIds: string[];

  @ApiProperty({
    description: "发票元数据",
    example: { notes: "Quarterly invoice", department: "Pharmacy" },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

@ApiTags("药房-发票管理")
@Controller("pharmacy/invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("pharmacy_operator")
@ApiBearerAuth()
export class InvoiceController {
  constructor(
    private readonly invoiceWithdrawalService: InvoiceWithdrawalService,
  ) {}

  @Post()
  @ApiOperation({ summary: "创建发票（多PO合并）" })
  @SwaggerApiResponse({
    status: 201,
    description: "发票创建成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "请求参数错误",
  })
  async createInvoice(
    @Body() createDto: CreateInvoiceDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.invoiceWithdrawalService.createInvoiceFromPurchaseOrders({
      pharmacyId,
      purchaseOrderIds: createDto.purchaseOrderIds,
      bankDetails: {}, // Use default bank details for now
      notes: createDto.metadata?.notes || "",
    });
  }

  @Get()
  @ApiOperation({ summary: "获取发票列表" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getInvoices(@CurrentUser() user: any) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.invoiceWithdrawalService.getPharmacyInvoices(pharmacyId);
  }

  @Get(":id")
  @ApiOperation({ summary: "获取发票详情" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: "发票不存在",
  })
  async getInvoiceDetail(
    @Param("id") invoiceId: string,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.invoiceWithdrawalService.getInvoiceDetails(
      invoiceId,
      pharmacyId,
    );
  }
}