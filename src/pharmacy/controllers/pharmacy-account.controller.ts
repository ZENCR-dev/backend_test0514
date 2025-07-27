import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import {
  PharmacyAccountService,
  WithdrawalRequestDto,
} from "../services/pharmacy-account.service";
import { ApiResponse } from "../../common/dto/api-response.dto";

class TransactionQueryDto {
  type?: "CREDIT" | "DEBIT";
  startDate?: string;
  endDate?: string;
  page?: number = 1;
  limit?: number = 20;
}

class WithdrawalQueryDto {
  status?: "pending_review" | "approved" | "rejected" | "completed";
  page?: number = 1;
  limit?: number = 20;
}

@ApiTags("药房-账户管理")
@Controller("pharmacy/account")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("pharmacy_operator")
@ApiBearerAuth()
export class PharmacyAccountController {
  constructor(
    private readonly pharmacyAccountService: PharmacyAccountService,
  ) {}

  @Get("balance")
  @ApiOperation({ summary: "获取账户余额信息" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getBalance(@CurrentUser() user: any) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.pharmacyAccountService.getBalance(pharmacyId);
  }

  @Get("transactions")
  @ApiOperation({ summary: "获取交易记录" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getTransactionHistory(
    @Query() query: TransactionQueryDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.pharmacyAccountService.getTransactionHistory(pharmacyId, {
      type: query.type,
      startDate: query.startDate,
      endDate: query.endDate,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    });
  }

  @Post("withdrawals")
  @ApiOperation({ summary: "申请提现" })
  @SwaggerApiResponse({
    status: 201,
    description: "提现申请提交成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "采购订单状态不正确或银行信息无效",
  })
  async requestWithdrawal(
    @Body() withdrawalData: WithdrawalRequestDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    // 验证必需字段
    if (
      !withdrawalData.purchaseOrderIds ||
      withdrawalData.purchaseOrderIds.length === 0
    ) {
      throw new BadRequestException("必须选择至少一个采购订单");
    }

    if (
      !withdrawalData.bankDetails ||
      !withdrawalData.bankDetails.accountName ||
      !withdrawalData.bankDetails.accountNumber ||
      !withdrawalData.bankDetails.bankName
    ) {
      throw new BadRequestException("银行信息不完整");
    }

    return await this.pharmacyAccountService.requestWithdrawal(
      pharmacyId,
      withdrawalData,
    );
  }

  @Get("withdrawals")
  @ApiOperation({ summary: "获取提现记录" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getWithdrawalHistory(
    @Query() query: WithdrawalQueryDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.pharmacyAccountService.getWithdrawalHistory(pharmacyId, {
      status: query.status,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    });
  }
}
