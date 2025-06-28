import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  RawBody,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  Req,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiHeader,
} from "@nestjs/swagger";
import { PaymentService } from "../services/payment.service";
import {
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  PractitionerAccountDeductionDto,
  RefundRequestDto,
  PaymentStatusQueryDto,
  PractitionerAccountBalanceQueryDto,
  PaymentIntentResponseDto,
  PaymentConfirmationResponseDto,
  PractitionerAccountDeductionResponseDto,
  RefundResponseDto,
  PractitionerAccountBalanceResponseDto,
} from "../dto/payment.dto";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * 支付控制器
 *
 * 职责范围：
 * - 处理支付相关的HTTP请求
 * - 参数验证和响应格式化
 * - API文档和错误处理
 *
 * 严格禁止：
 * - 包含业务逻辑（委托给PaymentService）
 * - 直接操作数据库
 * - 直接调用外部服务
 */
@ApiTags("支付管理")
@Controller("payments")
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 创建Stripe支付意图
   */
  @Post("stripe/payment-intents")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "创建Stripe支付意图",
    description: "为订单创建Stripe支付意图，用于前端支付流程",
  })
  @ApiResponse({
    status: 201,
    description: "支付意图创建成功",
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "请求参数无效或支付意图创建失败",
  })
  @ApiResponse({
    status: 409,
    description: "检测到重复支付",
  })
  async createPaymentIntent(
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    this.logger.log(
      `Creating payment intent for order: ${createPaymentIntentDto.orderId}`,
    );

    const result = await this.paymentService.createPaymentIntent({
      amount: new Decimal(createPaymentIntentDto.amount / 100),
      currency: createPaymentIntentDto.currency,
      orderId: createPaymentIntentDto.orderId,
      practitionerId: createPaymentIntentDto.practitionerId,
      metadata: createPaymentIntentDto.metadata,
    });

    return result;
  }

  /**
   * 确认支付
   */
  @Post("stripe/payment-intents/:id/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "确认Stripe支付",
    description: "确认支付意图，完成支付流程",
  })
  @ApiParam({
    name: "id",
    description: "支付意图ID",
    example: "pi_1234567890abcdef",
  })
  @ApiResponse({
    status: 200,
    description: "支付确认成功",
    type: PaymentConfirmationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "支付确认失败",
  })
  async confirmPayment(
    @Param("id") paymentIntentId: string,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ): Promise<PaymentConfirmationResponseDto> {
    this.logger.log(`Confirming payment intent: ${paymentIntentId}`);

    return await this.paymentService.confirmPayment({
      paymentIntentId,
      paymentMethodId: confirmPaymentDto.paymentMethodId,
      returnUrl: confirmPaymentDto.returnUrl,
    });
  }

  /**
   * 获取支付状态
   */
  @Get("stripe/payment-intents/:id")
  @ApiOperation({
    summary: "获取支付意图状态",
    description: "查询支付意图的当前状态和详细信息",
  })
  @ApiParam({
    name: "id",
    description: "支付意图ID",
    example: "pi_1234567890abcdef",
  })
  @ApiResponse({
    status: 200,
    description: "支付状态查询成功",
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "支付意图不存在",
  })
  async getPaymentIntent(
    @Param("id") paymentIntentId: string,
  ): Promise<PaymentIntentResponseDto> {
    this.logger.log(`Getting payment intent: ${paymentIntentId}`);

    return await this.paymentService.getPaymentIntent(paymentIntentId);
  }

  /**
   * 取消支付意图
   */
  @Post("stripe/payment-intents/:id/cancel")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "取消支付意图",
    description: "取消未完成的支付意图",
  })
  @ApiParam({
    name: "id",
    description: "支付意图ID",
    example: "pi_1234567890abcdef",
  })
  @ApiResponse({
    status: 204,
    description: "支付意图取消成功",
  })
  @ApiResponse({
    status: 400,
    description: "支付意图无法取消",
  })
  async cancelPaymentIntent(
    @Param("id") paymentIntentId: string,
  ): Promise<void> {
    this.logger.log(`Cancelling payment intent: ${paymentIntentId}`);

    await this.paymentService.cancelPaymentIntent(paymentIntentId);
  }

  /**
   * 医师账户扣款
   */
  @Post("practitioner-account/deduct")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "医师账户扣款",
    description: "从医师账户余额中扣除指定金额",
  })
  @ApiResponse({
    status: 200,
    description: "扣款成功",
    type: PractitionerAccountDeductionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "余额不足或扣款失败",
  })
  async deductFromPractitionerAccount(
    @Body() deductionDto: PractitionerAccountDeductionDto,
  ): Promise<PractitionerAccountDeductionResponseDto> {
    this.logger.log(`Deducting from practitioner account: ${deductionDto.practitionerId}`);

    return await this.paymentService.deductFromPractitionerAccount({
      practitionerId: deductionDto.practitionerId,
      amount: new Decimal(deductionDto.amount / 100),
      orderId: deductionDto.orderId,
      description: deductionDto.description,
      idempotencyKey: deductionDto.idempotencyKey,
    });
  }

  /**
   * 查询医师账户余额
   */
  @Get("practitioner-account/:practitionerId/balance")
  @ApiOperation({
    summary: "查询医师账户余额",
    description: "获取指定医师的账户余额信息",
  })
  @ApiParam({
    name: "practitionerId",
    description: "医师ID",
    example: "practitioner_123456789",
  })
  @ApiResponse({
    status: 200,
    description: "余额查询成功",
    type: PractitionerAccountBalanceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "医师账户不存在",
  })
  async getPractitionerAccountBalance(
    @Param("practitionerId") practitionerId: string,
  ): Promise<PractitionerAccountBalanceResponseDto> {
    this.logger.log(`Getting practitioner account balance: ${practitionerId}`);

    return await this.paymentService.getPractitionerAccountBalance(practitionerId);
  }

  /**
   * 处理退款
   */
  @Post("refunds")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "处理退款",
    description: "处理Stripe支付或诊所账户的退款请求",
  })
  @ApiResponse({
    status: 200,
    description: "退款处理成功",
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "退款处理失败",
  })
  async processRefund(
    @Body() refundDto: RefundRequestDto,
  ): Promise<RefundResponseDto> {
    this.logger.log(`Processing refund for order: ${refundDto.orderId}`);

    // 根据请求类型选择退款方式
    if (refundDto.paymentIntentId) {
      return await this.paymentService.processStripeRefund({
        paymentIntentId: refundDto.paymentIntentId,
        orderId: refundDto.orderId,
        amount: refundDto.amount
          ? new Decimal(refundDto.amount / 100)
          : undefined,
        reason: refundDto.reason,
      });
    } else if (refundDto.transactionId) {
      return await this.paymentService.processPractitionerAccountRefund({
        transactionId: refundDto.transactionId,
        orderId: refundDto.orderId,
        amount: refundDto.amount
          ? new Decimal(refundDto.amount / 100)
          : undefined,
        reason: refundDto.reason,
      });
    } else {
      throw new Error(
        "Either paymentIntentId or transactionId must be provided",
      );
    }
  }

  /**
   * Webhook端点
   */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Stripe Webhook端点",
    description: "接收和处理Stripe的Webhook事件",
  })
  @ApiHeader({
    name: "stripe-signature",
    description: "Stripe webhook签名",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Webhook事件处理成功",
  })
  @ApiResponse({
    status: 400,
    description: "Webhook签名验证失败",
  })
  async handleWebhook(
    @Req() request: any,
    @Headers("stripe-signature") signature: string,
  ): Promise<{ received: boolean }> {
    try {
      this.logger.log("Received Stripe webhook event");
      this.logger.debug(`Request headers: ${JSON.stringify(request.headers)}`);

      // 获取raw body (从express.raw中间件设置的)
      const payload = request.body;

      // 验证payload
      if (!payload) {
        this.logger.error("Webhook payload is empty");
        throw new BadRequestException("Webhook payload is required");
      }

      // 验证signature
      if (!signature) {
        this.logger.error("Webhook signature is missing");
        throw new BadRequestException("Webhook signature is required");
      }

      const payloadString = payload.toString();
      this.logger.debug(`Payload length: ${payloadString.length} bytes`);

      // 验证签名并构造事件
      const event = await this.paymentService.verifyWebhookSignature(
        payloadString,
        signature,
      );

      if (!event) {
        this.logger.error("Webhook signature verification failed");
        throw new BadRequestException("Invalid webhook signature");
      }

      this.logger.log(
        `Processing webhook event: ${event.type} (ID: ${event.id})`,
      );

      // 构造正确的WebhookEventData格式
      const eventData = {
        id: event.id,
        type: event.type,
        data: event.data,
        created: event.created,
        rawPayload: payloadString, // 传递原始payload用于重复验证
      };

      // 处理webhook事件
      await this.paymentService.handleWebhookEvent(eventData, signature);

      this.logger.log(`Webhook event processed successfully: ${event.id}`);
      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook processing failed:`, {
        error: error.message,
        stack: error.stack,
        signature: signature ? signature.substring(0, 20) + "..." : "missing",
        hasPayload: !!request.body,
      });

      // 根据错误类型返回适当的HTTP状态
      if (error instanceof BadRequestException) {
        throw error; // 保持400状态
      }

      // 其他错误返回500
      throw new InternalServerErrorException("Failed to process webhook event");
    }
  }
}
