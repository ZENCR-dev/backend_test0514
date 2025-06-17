import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Decimal } from "@prisma/client/runtime/library";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { ClinicAccountService } from "../../clinic-account/services/clinic-account.service";
import {
  IPaymentEngine,
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  ConfirmPaymentRequest,
  PaymentConfirmationResponse,
  ClinicAccountDeductionRequest,
  ClinicAccountDeductionResponse,
  RefundRequest,
  RefundResponse,
  WebhookEventData,
  PaymentStatus,
} from "../interfaces/payment-engine.interface";
import {
  StripePaymentException,
  PaymentIntentCreationException,
  PaymentConfirmationException,
  InsufficientFundsException,
  ClinicAccountDeductionException,
  DuplicatePaymentException,
  PaymentIntentNotFoundException,
  RefundProcessingException,
  WebhookSignatureException,
  WebhookEventProcessingException,
  PaymentConfigurationException,
} from "../exceptions/payment.exceptions";

/**
 * 支付引擎服务实现
 *
 * 职责范围：
 * - Stripe支付集成和状态管理
 * - 诊所账户余额操作和事务记录
 * - 支付安全机制和并发控制
 * - Webhook事件处理和验证
 *
 * 严格禁止：
 * - 直接操作订单状态（Task 5C职责）
 * - 包含业务流程逻辑（Task 5C职责）
 * - 直接调用订单管理接口（通过事件通信）
 */
@Injectable()
export class PaymentService implements IPaymentEngine, OnModuleDestroy {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe;

  // 内存幂等性存储机制
  private readonly eventStore = new Map<
    string,
    {
      processedAt: Date;
      data: any;
    }
  >();
  private readonly processingEvents = new Set<string>(); // 正在处理的事件ID
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clinicAccountService: ClinicAccountService,
    private readonly eventEmitter: EventEmitter2,
    @Inject("STRIPE_CONFIG") private readonly stripeConfig: any,
    @Inject("PAYMENT_CONFIG") private readonly paymentConfig: any,
  ) {
    // 初始化Stripe客户端
    if (!this.stripeConfig.secretKey) {
      throw new PaymentConfigurationException(
        "STRIPE_SECRET_KEY",
        "Secret key is required",
      );
    }

    this.stripe = new Stripe(this.stripeConfig.secretKey, {
      apiVersion: this.stripeConfig.apiVersion,
      typescript: true,
    });

    // 启动定时清理任务
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredEvents();
      },
      60 * 60 * 1000,
    ); // 每小时清理一次

    this.logger.log("PaymentService initialized successfully");
  }

  /**
   * 销毁时清理资源
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * 检查事件是否已被处理（内存幂等性检查）
   */
  private isEventProcessed(eventId: string): boolean {
    // 如果事件正在处理中，也视为已处理
    if (this.processingEvents.has(eventId)) {
      return true;
    }

    const event = this.eventStore.get(eventId);
    if (!event) {
      return false;
    }

    // 检查事件是否已过期（24小时）
    const now = new Date();
    const eventAge = now.getTime() - event.processedAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    if (eventAge > maxAge) {
      this.eventStore.delete(eventId);
      return false;
    }

    return true;
  }

  /**
   * 记录已处理的事件（内存幂等性记录）
   */
  private markEventAsProcessed(eventId: string, data?: any): void {
    this.eventStore.set(eventId, {
      processedAt: new Date(),
      data: data || null,
    });

    // 移除处理中标记
    this.processingEvents.delete(eventId);

    this.logger.debug(`Event marked as processed: ${eventId}`);
  }

  /**
   * 获取已处理事件的数据
   */
  private getProcessedEventData(eventId: string): any {
    const event = this.eventStore.get(eventId);
    return event?.data || null;
  }

  /**
   * 清理过期的事件记录
   */
  private cleanupExpiredEvents(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    let cleanedCount = 0;

    for (const [eventId, event] of this.eventStore.entries()) {
      const eventAge = now.getTime() - event.processedAt.getTime();
      if (eventAge > maxAge) {
        this.eventStore.delete(eventId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedCount} expired events from memory store`,
      );
    }
  }

  /**
   * 创建Stripe支付意图
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<PaymentIntentResponse> {
    try {
      this.logger.log(`Creating payment intent for order ${request.orderId}`);

      // 验证金额
      const amountInCents = Math.round(Number(request.amount) * 100);
      if (
        amountInCents < this.paymentConfig.minPaymentAmount ||
        amountInCents > this.paymentConfig.maxPaymentAmount
      ) {
        throw new PaymentIntentCreationException(
          request.orderId,
          `Amount ${amountInCents} is outside allowed range`,
        );
      }

      // 检查重复支付
      const isDuplicate = await this.checkDuplicatePayment(
        request.orderId,
        request.amount,
      );
      if (isDuplicate) {
        throw new DuplicatePaymentException(
          request.orderId,
          "existing_payment_found",
        );
      }

      // 创建Stripe支付意图
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: request.currency,
        metadata: {
          orderId: request.orderId,
          clinicId: request.clinicId,
          ...request.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      const response: PaymentIntentResponse = {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        orderId: request.orderId,
        createdAt: new Date(paymentIntent.created * 1000),
      };

      this.logger.log(
        `Payment intent created successfully: ${paymentIntent.id}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent for order ${request.orderId}:`,
        error,
      );

      if (error instanceof Stripe.errors.StripeError) {
        throw new StripePaymentException(
          "Failed to create payment intent",
          error,
        );
      }

      if (
        error instanceof PaymentIntentCreationException ||
        error instanceof DuplicatePaymentException
      ) {
        throw error;
      }

      throw new PaymentIntentCreationException(request.orderId, error.message);
    }
  }

  /**
   * 确认支付
   */
  async confirmPayment(
    request: ConfirmPaymentRequest,
  ): Promise<PaymentConfirmationResponse> {
    // TODO: 实现支付确认逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 获取支付意图
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<PaymentIntentResponse> {
    try {
      // 验证支付意图ID
      this.validatePaymentIntentId(paymentIntentId);

      this.logger.log(`Retrieving payment intent: ${paymentIntentId}`);

      // 从Stripe获取支付意图
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      const response: PaymentIntentResponse = {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        orderId: paymentIntent.metadata?.orderId || "",
        createdAt: new Date(paymentIntent.created * 1000),
      };

      this.logger.log(
        `Payment intent retrieved successfully: ${paymentIntentId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve payment intent ${paymentIntentId}:`,
        error,
      );

      if (error instanceof Stripe.errors.StripeError) {
        if (
          error.code === "resource_missing" ||
          error instanceof Stripe.errors.StripeInvalidRequestError
        ) {
          throw new PaymentIntentNotFoundException(paymentIntentId);
        }
        throw new StripePaymentException(
          "Failed to retrieve payment intent",
          error,
        );
      }

      if (error instanceof PaymentIntentNotFoundException) {
        throw error;
      }

      // 如果是验证错误，直接重新抛出
      if (
        error.message.includes("Payment intent ID is required") ||
        error.message.includes("Invalid payment intent ID format")
      ) {
        throw error;
      }

      throw new PaymentIntentNotFoundException(paymentIntentId);
    }
  }

  /**
   * 取消支付意图
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      // 验证支付意图ID
      this.validatePaymentIntentId(paymentIntentId);

      this.logger.log(`Cancelling payment intent: ${paymentIntentId}`);

      // 先获取当前状态以验证是否可以取消
      const currentPaymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      // 检查是否可以取消
      if (currentPaymentIntent.status === "succeeded") {
        throw new Error(
          "Payment intent is already succeeded and cannot be canceled",
        );
      }

      if (currentPaymentIntent.status === "canceled") {
        throw new Error(
          "Payment intent is already canceled or cannot be canceled",
        );
      }

      // 检查状态是否允许取消
      const cancelableStatuses = [
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
      ];
      if (!cancelableStatuses.includes(currentPaymentIntent.status)) {
        throw new Error("Payment intent cannot be canceled in current status");
      }

      // 取消支付意图
      await this.stripe.paymentIntents.cancel(paymentIntentId);

      this.logger.log(
        `Payment intent cancelled successfully: ${paymentIntentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to cancel payment intent ${paymentIntentId}:`,
        error,
      );

      if (error instanceof Stripe.errors.StripeError) {
        if (
          error.code === "resource_missing" ||
          error instanceof Stripe.errors.StripeInvalidRequestError
        ) {
          throw new PaymentIntentNotFoundException(paymentIntentId);
        }
        throw new StripePaymentException(
          "Failed to cancel payment intent",
          error,
        );
      }

      // 如果是验证错误，直接重新抛出
      if (
        error.message.includes("Payment intent ID is required") ||
        error.message.includes("Invalid payment intent ID format")
      ) {
        throw error;
      }

      // 重新抛出我们自定义的错误消息
      if (
        error.message.includes("already succeeded") ||
        error.message.includes("already canceled") ||
        error.message.includes("cannot be canceled")
      ) {
        throw error;
      }

      throw new StripePaymentException(
        "Failed to cancel payment intent",
        error,
      );
    }
  }

  /**
   * 从诊所账户扣款
   */
  async deductFromClinicAccount(
    request: ClinicAccountDeductionRequest,
  ): Promise<ClinicAccountDeductionResponse> {
    // TODO: 实现诊所账户扣款逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 退款到诊所账户
   */
  async refundToClinicAccount(
    clinicId: string,
    amount: Decimal,
    orderId: string,
    reason?: string,
  ): Promise<RefundResponse> {
    // TODO: 实现诊所账户退款逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 获取诊所账户余额
   */
  async getClinicAccountBalance(
    clinicId: string,
  ): Promise<{ balance: number; currency: string }> {
    try {
      this.logger.log(`Getting clinic account balance for clinic: ${clinicId}`);

      // 委托给ClinicAccountService获取余额
      const balanceInfo = await this.clinicAccountService.getBalance(clinicId);

      return {
        balance: balanceInfo.availableBalance, // 使用availableBalance字段
        currency: "USD", // 默认货币
      };
    } catch (error) {
      this.logger.error(
        `Failed to get clinic account balance for clinic ${clinicId}:`,
        error,
      );

      if (error.message?.includes("诊所账户不存在")) {
        throw new NotFoundException(
          `Clinic account not found for clinic: ${clinicId}`,
        );
      }

      throw new InternalServerErrorException(
        "Failed to retrieve clinic account balance",
      );
    }
  }

  /**
   * 处理Stripe退款
   */
  async processStripeRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      this.logger.log(`Processing Stripe refund for order: ${request.orderId}`);

      // 1. 验证退款请求参数
      if (!request.paymentIntentId) {
        throw new BadRequestException(
          "Payment Intent ID is required for Stripe refund",
        );
      }

      // 2. 检查是否已处理过相同的退款请求
      const idempotencyKey = this.generateIdempotencyKey(
        request.orderId,
        "stripe_refund",
      );

      // 3. 获取PaymentIntent并验证状态
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        request.paymentIntentId,
        {
          expand: ["charges"], // 展开charges字段
        },
      );

      if (paymentIntent.status !== "succeeded") {
        throw new BadRequestException(
          `Payment Intent ${request.paymentIntentId} has status ${paymentIntent.status}, cannot refund`,
        );
      }

      // 4. 计算退款金额（分为单位）
      const refundAmountCents = request.amount
        ? Math.round(request.amount.toNumber() * 100)
        : undefined; // 未指定金额时为全额退款

      // 5. 验证退款金额不超过可退款金额
      if (refundAmountCents) {
        // 由于使用了expand，需要进行类型断言
        const expandedPaymentIntent = paymentIntent as any;
        if (
          expandedPaymentIntent.charges?.data &&
          expandedPaymentIntent.charges.data.length > 0
        ) {
          const charge = expandedPaymentIntent.charges.data[0];
          const totalRefunded = charge.amount_refunded || 0;
          const totalCharged = charge.amount || 0;
          const availableForRefund = totalCharged - totalRefunded;

          if (refundAmountCents > availableForRefund) {
            throw new BadRequestException(
              `Refund amount ${refundAmountCents} exceeds available amount ${availableForRefund}`,
            );
          }
        }
      }

      // 6. 创建Stripe Refund
      const refundParams: any = {
        payment_intent: request.paymentIntentId,
        reason: request.reason || "requested_by_customer",
        metadata: {
          orderId: request.orderId,
          refundedAt: new Date().toISOString(),
        },
      };

      if (refundAmountCents) {
        refundParams.amount = refundAmountCents;
      }

      const stripeRefund = await this.stripe.refunds.create(refundParams, {
        idempotencyKey, // 幂等性保护
      });

      this.logger.log(`Stripe refund created: ${stripeRefund.id}`);

      // 7. 构造响应对象
      const refundResponse: RefundResponse = {
        id: stripeRefund.id,
        amount: stripeRefund.amount / 100, // 转换回货币单位，使用number类型
        status: this.mapStripeRefundStatusToString(stripeRefund.status) as
          | "pending"
          | "succeeded"
          | "failed", // 明确类型转换
        orderId: request.orderId,
        refundedAt: new Date(stripeRefund.created * 1000),
      };

      // 8. 发射退款事件
      this.eventEmitter.emit("payment.refund.created", {
        refundId: stripeRefund.id,
        orderId: request.orderId,
        paymentIntentId: request.paymentIntentId,
        amount: refundResponse.amount,
        status: refundResponse.status,
      });

      this.logger.log(
        `Stripe refund processed successfully: ${stripeRefund.id}`,
      );
      return refundResponse;
    } catch (error) {
      this.logger.error(
        `Failed to process Stripe refund for order ${request.orderId}:`,
        error,
      );

      // 处理Stripe特定错误
      if (error.type === "StripeCardError") {
        throw new BadRequestException(`Card error: ${error.message}`);
      } else if (error.type === "StripeInvalidRequestError") {
        throw new BadRequestException(`Invalid request: ${error.message}`);
      } else if (error.type === "StripeAPIError") {
        throw new InternalServerErrorException("Stripe API error occurred");
      } else if (error.type === "StripeConnectionError") {
        throw new ServiceUnavailableException(
          "Payment service temporarily unavailable",
        );
      } else if (error.type === "StripeAuthenticationError") {
        throw new InternalServerErrorException(
          "Payment service authentication error",
        );
      }

      // 重新抛出其他错误
      throw error;
    }
  }

  /**
   * 处理诊所账户退款
   */
  async processClinicAccountRefund(
    request: RefundRequest,
  ): Promise<RefundResponse> {
    try {
      this.logger.log(
        `Processing clinic account refund for order: ${request.orderId}`,
      );

      // 1. 验证退款请求参数
      if (!request.transactionId) {
        throw new BadRequestException(
          "Transaction ID is required for clinic account refund",
        );
      }

      if (!request.amount || request.amount.lte(0)) {
        throw new BadRequestException(
          "Valid refund amount is required for clinic account refund",
        );
      }

      // 2. 从事务ID中提取诊所ID (假设事务ID包含诊所信息)
      // 这里需要根据实际业务逻辑调整，可能需要查询数据库获取诊所ID
      let clinicId: string;

      try {
        // 查询原始扣款事务获取诊所ID
        // 这里使用Prisma查询account_transactions表
        const originalTransaction =
          await this.prisma.accountTransaction.findUnique({
            where: { id: request.transactionId },
            include: {
              account: {
                select: { clinicId: true },
              },
            },
          });

        if (!originalTransaction) {
          throw new BadRequestException(
            `Transaction ${request.transactionId} not found`,
          );
        }

        if (originalTransaction.transactionType !== "DEBIT") {
          throw new BadRequestException(
            `Transaction ${request.transactionId} is not a debit transaction`,
          );
        }

        clinicId = originalTransaction.account.clinicId;
      } catch (error) {
        this.logger.error(
          `Failed to find transaction ${request.transactionId}:`,
          error,
        );
        throw new BadRequestException(
          `Invalid transaction ID: ${request.transactionId}`,
        );
      }

      // 3. 生成幂等性键
      const idempotencyKey = this.generateIdempotencyKey(
        request.orderId,
        "clinic_refund",
      );

      // 4. 检查是否已处理过相同的退款请求
      const existingRefund = await this.checkDuplicateRefund(
        request.orderId,
        request.transactionId,
        request.amount,
      );

      if (existingRefund) {
        this.logger.warn(
          `Duplicate refund request detected for order ${request.orderId}`,
        );
        return existingRefund;
      }

      // 5. 调用ClinicAccountService进行退款
      const refundResult = await this.clinicAccountService.refundBalance(
        clinicId,
        request.amount.toNumber(),
        request.transactionId,
        request.reason || `Refund for order ${request.orderId}`,
      );

      this.logger.log(`Clinic account refund processed for clinic ${clinicId}`);

      // 6. 构造响应对象
      const refundResponse: RefundResponse = {
        id: `ref_${idempotencyKey}`, // 生成退款ID
        amount: request.amount.toNumber(), // 转换为number类型
        status: "succeeded" as const, // 诊所账户退款通常是即时的，使用const断言
        orderId: request.orderId,
        refundedAt: new Date(),
      };

      // 7. 发射退款事件
      this.eventEmitter.emit("payment.clinic_refund.created", {
        refundId: refundResponse.id,
        orderId: request.orderId,
        transactionId: request.transactionId,
        clinicId,
        amount: refundResponse.amount,
        newBalance: refundResult.availableBalance, // 使用availableBalance字段
      });

      this.logger.log(
        `Clinic account refund processed successfully: ${refundResponse.id}`,
      );
      return refundResponse;
    } catch (error) {
      this.logger.error(
        `Failed to process clinic account refund for order ${request.orderId}:`,
        error,
      );

      // 处理特定的业务错误
      if (error.message?.includes("乐观锁")) {
        throw new ConflictException("Account update conflict, please retry");
      } else if (error.message?.includes("Account does not exist")) {
        throw new NotFoundException("Clinic account not found");
      } else if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        // 重新抛出已知的业务异常
        throw error;
      }

      // 重新抛出未知错误
      throw new InternalServerErrorException(
        "Failed to process clinic account refund",
      );
    }
  }

  /**
   * 处理Webhook事件
   */
  async handleWebhookEvent(
    eventData: WebhookEventData,
    signature: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing webhook event: ${eventData.id} (type: ${eventData.type})`,
      );

      // 1. 内存幂等性检查
      if (this.isEventProcessed(eventData.id)) {
        this.logger.debug(
          `Event ${eventData.id} already processed or being processed, skipping`,
        );
        return;
      }

      // 2. 标记事件为正在处理
      this.processingEvents.add(eventData.id);

      try {
        // 3. 验证Webhook签名
        const verifiedEvent = this.verifyWebhookSignature(
          eventData.rawPayload || "",
          signature,
        );

        if (!verifiedEvent) {
          throw new WebhookSignatureException(
            `Invalid webhook signature for event ${eventData.id}`,
          );
        }

        // 4. 根据事件类型处理
        let processedData: any = null;

        switch (eventData.type) {
          case "payment_intent.succeeded":
            processedData = await this.handlePaymentSucceeded(eventData);
            break;
          case "payment_intent.payment_failed":
            processedData = await this.handlePaymentFailed(eventData);
            break;
          case "payment_intent.canceled":
            processedData = await this.handlePaymentCanceled(eventData);
            break;
          case "charge.dispute.created":
            processedData = await this.handleChargeDispute(eventData);
            break;
          default:
            this.logger.warn(`Unhandled webhook event type: ${eventData.type}`);
            processedData = { ignored: true, reason: "unhandled_event_type" };
        }

        // 5. 标记事件为已处理
        this.markEventAsProcessed(eventData.id, processedData);

        this.logger.log(
          `Webhook event processed successfully: ${eventData.id}`,
        );
      } catch (error) {
        // 处理失败时移除处理中标记
        this.processingEvents.delete(eventData.id);
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Failed to process webhook event ${eventData.id}:`,
        error,
      );

      if (error instanceof WebhookSignatureException) {
        throw error;
      }

      throw new WebhookEventProcessingException(
        eventData.id,
        eventData.type,
        error.message,
      );
    }
  }

  /**
   * 处理支付成功事件
   */
  private async handlePaymentSucceeded(
    eventData: WebhookEventData,
  ): Promise<any> {
    const paymentIntent = eventData.data.object;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(
        `Payment succeeded but no orderId in metadata: ${paymentIntent.id}`,
      );
      return { processed: false, reason: "missing_order_id" };
    }

    // 发出支付成功事件
    this.eventEmitter.emit("payment.succeeded", {
      orderId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      clinicId: paymentIntent.metadata?.clinicId,
    });

    return {
      processed: true,
      orderId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    };
  }

  /**
   * 处理支付失败事件
   */
  private async handlePaymentFailed(eventData: WebhookEventData): Promise<any> {
    const paymentIntent = eventData.data.object;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(
        `Payment failed but no orderId in metadata: ${paymentIntent.id}`,
      );
      return { processed: false, reason: "missing_order_id" };
    }

    // 发出支付失败事件
    this.eventEmitter.emit("payment.failed", {
      orderId,
      paymentIntentId: paymentIntent.id,
      failureReason:
        paymentIntent.last_payment_error?.message || "Unknown error",
      clinicId: paymentIntent.metadata?.clinicId,
    });

    return {
      processed: true,
      orderId,
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message,
    };
  }

  /**
   * 处理支付取消事件
   */
  private async handlePaymentCanceled(
    eventData: WebhookEventData,
  ): Promise<any> {
    const paymentIntent = eventData.data.object;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(
        `Payment canceled but no orderId in metadata: ${paymentIntent.id}`,
      );
      return { processed: false, reason: "missing_order_id" };
    }

    // 发出支付取消事件
    this.eventEmitter.emit("payment.canceled", {
      orderId,
      paymentIntentId: paymentIntent.id,
      clinicId: paymentIntent.metadata?.clinicId,
    });

    return {
      processed: true,
      orderId,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * 处理争议事件
   */
  private async handleChargeDispute(eventData: WebhookEventData): Promise<any> {
    const dispute = eventData.data.object;
    const chargeId = dispute.charge;

    // 发出争议创建事件
    this.eventEmitter.emit("payment.dispute.created", {
      disputeId: dispute.id,
      chargeId,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    });

    return {
      processed: true,
      disputeId: dispute.id,
      chargeId,
      amount: dispute.amount,
    };
  }

  /**
   * 验证Webhook签名并返回构造的事件
   */
  verifyWebhookSignature(payload: string, signature: string): any | null {
    try {
      this.logger.debug(
        `Verifying webhook signature with payload length: ${payload.length}`,
      );

      if (!this.stripeConfig.webhookSecret) {
        this.logger.error("Webhook secret is not configured");
        return null;
      }

      // 使用Stripe SDK验证签名并构造事件
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.stripeConfig.webhookSecret,
      );

      this.logger.debug(
        `Webhook signature verified successfully for event: ${event.type}`,
      );
      return event;
    } catch (error) {
      this.logger.error("Webhook signature verification failed:", {
        error: error.message,
        signatureLength: signature ? signature.length : 0,
        payloadLength: payload ? payload.length : 0,
        webhookSecretConfigured: !!this.stripeConfig.webhookSecret,
      });
      return null;
    }
  }

  /**
   * 生成幂等性键
   */
  generateIdempotencyKey(orderId: string, operation: string): string {
    const timestamp = Date.now();
    return `${operation}_${orderId}_${timestamp}`;
  }

  /**
   * 检查重复支付
   */
  async checkDuplicatePayment(
    orderId: string,
    amount: Decimal,
  ): Promise<boolean> {
    // TODO: 实现重复支付检查逻辑
    // 这里应该查询数据库中是否已存在相同订单的支付记录
    return false;
  }

  /**
   * 检查重复退款
   */
  async checkDuplicateRefund(
    orderId: string,
    transactionId: string,
    amount: Decimal,
  ): Promise<RefundResponse | null> {
    try {
      // 查询是否已存在相同的退款记录
      // 这里可以根据业务需求实现，比如查询退款记录表
      // 当前返回null表示没有重复退款
      return null;
    } catch (error) {
      this.logger.warn(`Failed to check duplicate refund: ${error.message}`);
      return null;
    }
  }

  /**
   * 验证支付意图ID格式
   */
  private validatePaymentIntentId(paymentIntentId: string): void {
    if (!paymentIntentId || paymentIntentId.trim() === "") {
      throw new Error("Payment intent ID is required");
    }

    // Stripe支付意图ID格式：pi_开头，后跟字母数字字符
    if (!paymentIntentId.startsWith("pi_") || paymentIntentId.length < 10) {
      throw new Error("Invalid payment intent ID format");
    }
  }

  /**
   * 映射Stripe状态到支付状态
   */
  private mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case "requires_payment_method":
        return PaymentStatus.REQUIRES_PAYMENT_METHOD;
      case "requires_confirmation":
        return PaymentStatus.REQUIRES_CONFIRMATION;
      case "requires_action":
        return PaymentStatus.REQUIRES_ACTION;
      case "processing":
        return PaymentStatus.PROCESSING;
      case "succeeded":
        return PaymentStatus.SUCCEEDED;
      case "canceled":
        return PaymentStatus.CANCELED;
      case "cancelled":
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.UNKNOWN;
    }
  }

  private mapStripeRefundStatusToString(stripeStatus: string): string {
    switch (stripeStatus) {
      case "succeeded":
        return "succeeded";
      case "processing":
        return "pending";
      case "failed":
        return "failed";
      default:
        return "pending";
    }
  }
}
