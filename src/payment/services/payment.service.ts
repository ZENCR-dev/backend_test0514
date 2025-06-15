import { Injectable, Inject, Logger } from "@nestjs/common";
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
export class PaymentService implements IPaymentEngine {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe;

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

    this.logger.log("PaymentService initialized successfully");
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
    // TODO: 实现获取支付意图逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 取消支付意图
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    // TODO: 实现取消支付意图逻辑
    throw new Error("Method not implemented.");
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
    // TODO: 实现获取诊所账户余额逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 处理Stripe退款
   */
  async processStripeRefund(request: RefundRequest): Promise<RefundResponse> {
    // TODO: 实现Stripe退款逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 处理诊所账户退款
   */
  async processClinicAccountRefund(
    request: RefundRequest,
  ): Promise<RefundResponse> {
    // TODO: 实现诊所账户退款逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 处理Webhook事件
   */
  async handleWebhookEvent(
    eventData: WebhookEventData,
    signature: string,
  ): Promise<void> {
    // TODO: 实现Webhook事件处理逻辑
    throw new Error("Method not implemented.");
  }

  /**
   * 验证Webhook签名
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.stripeConfig.webhookSecret,
      );
      return true;
    } catch (error) {
      this.logger.error("Webhook signature verification failed:", error);
      return false;
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
   * 映射Stripe状态到支付状态
   */
  private mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
        return PaymentStatus.PENDING;
      case "processing":
        return PaymentStatus.PROCESSING;
      case "succeeded":
        return PaymentStatus.SUCCEEDED;
      case "canceled":
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }
}
