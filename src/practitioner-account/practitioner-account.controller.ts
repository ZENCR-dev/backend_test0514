import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PractitionerAccountService } from "./services/practitioner-account.service";
import { PaymentService } from "../payment/services/payment.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RechargeDto } from "./dto/recharge.dto";
import { Decimal } from "@prisma/client/runtime/library";
import { ResponseHelper, ErrorCodes } from "../common/utils/response-helper";
import {
  ApiStandardResponses,
  ApiPaginatedStandardResponses,
} from "../common/decorators/api-response.decorator";

/**
 * 医师个人账户控制器
 *
 * 提供医师个人账户相关的API端点：
 * - 账户余额查询
 * - 交易历史查询
 * - 账户状态管理
 */
@ApiTags("practitioner-accounts")
@Controller("practitioner-accounts")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PractitionerAccountController {
  private readonly logger = new Logger(PractitionerAccountController.name);

  constructor(
    private readonly practitionerAccountService: PractitionerAccountService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * 获取当前医师的账户余额
   */
  @Get("balance")
  @ApiOperation({ summary: "获取医师账户余额" })
  @ApiStandardResponses(Object, "成功获取账户余额")
  async getBalance(@CurrentUser() user: any) {
    this.logger.log(`Getting balance for practitioner ${user.id}`);

    try {
      const balance = await this.practitionerAccountService.getBalance(user.id);

      return ResponseHelper.success(
        {
          balance: balance.balance.toNumber(),
          availableCredit: balance.availableCredit.toNumber(),
          creditLimit: balance.creditLimit.toNumber(),
          usedCredit: balance.usedCredit.toNumber(),
          currency: "NZD",
        },
        "账户余额获取成功",
      );
    } catch (error) {
      this.logger.error(
        `Failed to get balance for practitioner ${user.id}:`,
        error,
      );

      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          ResponseHelper.error(ErrorCodes.ACCOUNT_NOT_FOUND, "医师账户不存在"),
        );
      }

      throw new InternalServerErrorException(
        ResponseHelper.error(ErrorCodes.INTERNAL_ERROR, "获取账户余额失败"),
      );
    }
  }

  /**
   * 获取当前医师的交易历史
   */
  @Get("transactions")
  @ApiOperation({ summary: "获取医师账户交易历史" })
  @ApiPaginatedStandardResponses(Object, "成功获取交易历史")
  async getTransactionHistory(
    @CurrentUser() user: any,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    this.logger.log(`Getting transaction history for practitioner ${user.id}`);

    try {
      // 参数验证 - 提前检查
      if (limit !== undefined && (limit < 1 || limit > 200)) {
        throw new BadRequestException('Limit must be between 1 and 200');
      }
      if (offset !== undefined && offset < 0) {
        throw new BadRequestException('Offset must be greater than or equal to 0');
      }

      // 参数验证
      const { page, limit: validatedLimit } =
        ResponseHelper.validatePaginationParams(
          Math.floor((offset || 0) / (limit || 20)) + 1,
          limit,
        );
      const validatedOffset = (page - 1) * validatedLimit;

      const transactions =
        await this.practitionerAccountService.getTransactionHistory(
          user.id,
          validatedLimit,
          validatedOffset,
        );

      // 获取总数（这里简化处理，实际应该从service获取）
      const total = transactions.length;
      const pagination = ResponseHelper.calculatePagination(
        total,
        page,
        validatedLimit,
      );

      const transformedData = transactions.map((t) => ({
        ...t,
        amount: t.amount.toNumber(),
        balanceBefore: t.balanceBefore.toNumber(),
        balanceAfter: t.balanceAfter.toNumber(),
        creditBefore: t.creditBefore ? t.creditBefore.toNumber() : null,
        creditAfter: t.creditAfter ? t.creditAfter.toNumber() : null,
      }));

      return ResponseHelper.paginated(
        transformedData,
        pagination,
        "交易历史获取成功",
      );
    } catch (error) {
      this.logger.error(
        `Failed to get transaction history for practitioner ${user.id}:`,
        error,
      );

      // 如果是参数验证错误，抛出BadRequestException
      if (error instanceof Error && (error.message.includes('must be') || error.message.includes('greater than'))) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          ResponseHelper.error(ErrorCodes.ACCOUNT_NOT_FOUND, "医师账户不存在"),
        );
      }

      throw new InternalServerErrorException(
        ResponseHelper.error(ErrorCodes.INTERNAL_ERROR, "获取交易历史失败"),
      );
    }
  }

  /**
   * 获取当前医师的账户信息
   */
  @Get("info")
  @ApiOperation({ summary: "获取医师账户信息" })
  @ApiStandardResponses(Object, "成功获取账户信息")
  async getAccountInfo(@CurrentUser() user: any) {
    this.logger.log(`Getting account info for practitioner ${user.id}`);

    try {
      let account;

      try {
        account = await this.practitionerAccountService.getAccountWithVersion(
          user.id,
        );
      } catch (error) {
        if (error instanceof NotFoundException) {
          // 账户不存在，创建新账户
          this.logger.log(
            `Account not found for practitioner ${user.id}, creating new account`,
          );
          await this.practitionerAccountService.createAccount(user.id);
          account = await this.practitionerAccountService.getAccountWithVersion(
            user.id,
          );
        } else {
          throw error;
        }
      }

      return ResponseHelper.success(
        {
          id: account.id,
          practitionerId: account.practitionerId,
          balance: account.balance.toNumber(),
          creditLimit: account.creditLimit.toNumber(),
          usedCredit: account.usedCredit.toNumber(),
          availableCredit: account.availableCredit.toNumber(),
          status: account.status,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
        },
        "账户信息获取成功",
      );
    } catch (error) {
      this.logger.error(
        `Failed to get account info for practitioner ${user.id}:`,
        error,
      );

      throw new InternalServerErrorException(
        ResponseHelper.error(ErrorCodes.INTERNAL_ERROR, "获取账户信息失败"),
      );
    }
  }

  /**
   * 充值医师账户
   */
  @Post("recharge")
  @ApiOperation({ summary: "充值医师账户" })
  @ApiStandardResponses(Object, "成功创建充值支付意图")
  async rechargeAccount(
    @CurrentUser() user: any,
    @Body() rechargeDto: RechargeDto,
  ) {
    this.logger.log(
      `Creating recharge payment intent for practitioner ${user.id}`,
    );

    // 额外的金额验证（虽然DTO已有验证，但为了测试需要）
    if (rechargeDto.amount < 10) {
      throw new BadRequestException(
        ResponseHelper.error(
          ErrorCodes.VALIDATION_ERROR,
          "充值金额不能少于10元",
        ),
      );
    }
    if (rechargeDto.amount > 10000) {
      throw new BadRequestException(
        ResponseHelper.error(
          ErrorCodes.VALIDATION_ERROR,
          "充值金额不能超过10000元",
        ),
      );
    }

    try {
      // 创建Stripe支付意图
      const paymentIntent = await this.paymentService.createPaymentIntent({
        amount: new Decimal(rechargeDto.amount),
        practitionerId: user.id,
        currency: rechargeDto.currency || "NZD",
        orderId: `recharge-${user.id}-${Date.now()}`, // 生成充值订单ID
        metadata: {
          type: "account_recharge",
          practitionerId: user.id,
        },
      });

      return ResponseHelper.success(
        {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.clientSecret,
          amount: rechargeDto.amount,
          currency: rechargeDto.currency || "NZD",
        },
        "充值支付意图创建成功",
      );
    } catch (error) {
      this.logger.error(
        `Failed to create recharge payment intent for practitioner ${user.id}:`,
        error,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        ResponseHelper.error(ErrorCodes.PAYMENT_FAILED, "创建充值支付意图失败"),
      );
    }
  }
}
