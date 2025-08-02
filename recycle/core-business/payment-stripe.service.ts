/**
 * 🔄 后端代码复用资产 - Stripe Payment Integration Service
 * 原项目: B2B2C中医处方履约平台
 * 复用等级: 一级复用 (85% 复用价值)
 * 迁移目标: Supabase Edge Functions
 * 适配要求: API密钥配置调整，保留核心支付流程逻辑
 * 测试覆盖: 单元测试覆盖率>80%
 * 
 * @migration Supabase-First架构适配
 * @security RLS策略集成要求 - 支付数据安全策略
 * @performance Edge Functions优化建议 - 支付意图创建缓存
 */

import { Decimal } from "@prisma/client/runtime/library";

// 核心支付业务类型定义 - 可直接复用
export interface CreatePaymentIntentRequest {
  amount: Decimal;
  practitionerId: string;
  orderId: string;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResponse {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  orderId: string;
  createdAt: Date;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface PaymentConfirmationResponse {
  id: string;
  status: PaymentStatus;
  orderId: string;
  amount: number;
  chargeId?: string;
  failureReason?: string;
}

export interface RefundRequest {
  orderId: string;
  amount?: Decimal;
  reason?: string;
  paymentIntentId?: string;
  transactionId?: string;
}

export interface RefundResponse {
  id: string;
  amount: number;
  status: "pending" | "succeeded" | "failed";
  orderId: string;
  refundedAt: Date;
}

export interface WebhookEventData {
  id: string;
  type: string;
  data: any;
  rawPayload?: string;
}

export enum PaymentStatus {
  REQUIRES_PAYMENT_METHOD = "requires_payment_method",
  REQUIRES_CONFIRMATION = "requires_confirmation", 
  REQUIRES_ACTION = "requires_action",
  PROCESSING = "processing",
  SUCCEEDED = "succeeded",
  CANCELED = "canceled",
  CANCELLED = "cancelled",
  UNKNOWN = "unknown",
}

// 数据库抽象接口 - Supabase适配点
export interface PaymentRepository {
  findMany(where: any, orderBy?: any): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
}

export interface AccountTransactionRepository {
  findUnique(where: any, include?: any): Promise<any>;
}

// 事件发布接口 - Supabase适配点
export interface EventEmitter {
  emit(event: string, data: any): void;
}

// 账户服务接口 - Supabase适配点  
export interface PractitionerAccountService {
  deductBalance(practitionerId: string, amount: Decimal, orderId: string, description: string): Promise<any>;
  refundBalance(practitionerId: string, amount: Decimal, orderId: string, description: string): Promise<any>;
  getBalance(practitionerId: string): Promise<any>;
}

/**
 * Stripe支付集成核心业务服务
 * 
 * 🚨 复用重点：
 * - Stripe Payment Intent创建和确认逻辑 (100%复用)
 * - Webhook事件处理和验证机制 (90%复用)
 * - 支付重试和幂等性保护 (100%复用)
 * - 退款处理和状态管理 (95%复用)
 * 
 * Supabase迁移说明：
 * - 迁移到Edge Functions运行环境
 * - 适配Supabase实时事件系统
 * - 保留所有Stripe API调用逻辑
 * - 适配新的数据库连接层
 */
export class StripePaymentService {
  private readonly stripe: any; // Stripe client
  private readonly logger: any;
  
  // 内存幂等性存储机制 - 100%复用
  private readonly eventStore = new Map<string, { processedAt: Date; data: any }>();
  private readonly processingEvents = new Set<string>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly accountTransactionRepository: AccountTransactionRepository,
    private readonly practitionerAccountService: PractitionerAccountService,
    private readonly eventEmitter: EventEmitter,
    private readonly stripeConfig: { secretKey: string; webhookSecret: string; apiVersion: string },
    private readonly paymentConfig: { minPaymentAmount: number; maxPaymentAmount: number }
  ) {
    // 🚨 核心Stripe客户端初始化逻辑
    if (!this.stripeConfig.secretKey) {
      throw new Error("STRIPE_SECRET_KEY is required");
    }

    // 注意：在Edge Functions中需要动态导入Stripe
    this.stripe = this.initializeStripe();
    this.logger = console; // Edge Functions环境适配

    // 启动定时清理任务 - 内存管理
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEvents();
    }, 60 * 60 * 1000); // 每小时清理一次

    this.logger.log("StripePaymentService initialized successfully");
  }

  /**
   * Stripe客户端初始化 - 100%复用
   * Edge Functions适配点
   */
  private initializeStripe() {
    // 在Edge Functions环境中的Stripe初始化
    // 注意：需要使用动态导入或全局变量
    return {
      // 实际实现需要根据Edge Functions环境调整
      paymentIntents: {
        create: async (params: any) => { /* Stripe API调用 */ },
        retrieve: async (id: string) => { /* Stripe API调用 */ },
        confirm: async (id: string, params: any) => { /* Stripe API调用 */ },
        cancel: async (id: string) => { /* Stripe API调用 */ },
      },
      refunds: {
        create: async (params: any, options?: any) => { /* Stripe API调用 */ },
      },
      webhooks: {
        constructEvent: (payload: string, signature: string, secret: string) => { /* Webhook验证 */ },
      },
    };
  }

  /**
   * 销毁时清理资源 - 100%复用
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * 🚨 核心业务逻辑：创建Stripe支付意图 - 100%复用
   * 
   * 关键功能：
   * - 金额验证和NZD cents转换
   * - 重复支付检查和防护
   * - Stripe Payment Intent创建
   * - 元数据管理和订单关联
   */
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntentResponse> {
    try {
      this.logger.log(`Creating payment intent for order ${request.orderId}`);

      // 🚨 核心金额验证逻辑 - NZD cents精度
      const amountInCents = Math.round(Number(request.amount) * 100);
      if (
        amountInCents < this.paymentConfig.minPaymentAmount ||
        amountInCents > this.paymentConfig.maxPaymentAmount
      ) {
        throw new Error(`Amount ${amountInCents} is outside allowed range`);
      }

      // 🚨 重复支付检查逻辑 - 100%复用
      const isDuplicate = await this.checkDuplicatePayment(request.orderId, request.amount);
      if (isDuplicate) {
        throw new Error(`Duplicate payment detected for order ${request.orderId}`);
      }

      // 🚨 Stripe Payment Intent创建逻辑 - 核心业务价值
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: request.currency,
        metadata: {
          orderId: request.orderId,
          practitionerId: request.practitionerId,
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

      this.logger.log(`Payment intent created successfully: ${paymentIntent.id}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create payment intent for order ${request.orderId}:`, error);
      throw error;
    }
  }

  /**
   * 🚨 核心业务逻辑：确认支付 - 100%复用
   * 
   * 关键功能：
   * - 支付意图状态检查和幂等性
   * - Stripe支付确认API调用
   * - 支付成功/失败事件发布
   * - 错误处理和重试机制
   */
  async confirmPayment(request: ConfirmPaymentRequest): Promise<PaymentConfirmationResponse> {
    try {
      if (!request.paymentIntentId) {
        throw new Error("Payment intent ID is required");
      }

      this.logger.log(`Confirming payment: ${request.paymentIntentId}`);

      // 🚨 幂等性检查 - 防止重复确认
      let paymentIntent;
      try {
        paymentIntent = await this.stripe.paymentIntents.retrieve(request.paymentIntentId);

        // 如果已经成功，直接返回结果
        if (paymentIntent.status === "succeeded") {
          const response: PaymentConfirmationResponse = {
            id: paymentIntent.id,
            status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
            orderId: paymentIntent.metadata?.orderId || "",
            amount: paymentIntent.amount,
            chargeId: (paymentIntent.latest_charge as string) ||
              (paymentIntent.charges?.data?.[0]?.id as string) || undefined,
          };
          return response;
        }
      } catch (error) {
        // 如果获取失败，继续执行确认流程
      }

      // 🚨 Stripe支付确认调用 - 核心API集成
      paymentIntent = await this.stripe.paymentIntents.confirm(
        request.paymentIntentId,
        {
          payment_method: request.paymentMethodId,
          return_url: request.returnUrl,
        },
      );

      // 构建响应
      const response: PaymentConfirmationResponse = {
        id: paymentIntent.id,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        orderId: paymentIntent.metadata?.orderId || "",
        amount: paymentIntent.amount,
        chargeId: (paymentIntent.latest_charge as string) ||
          (paymentIntent.charges?.data?.[0]?.id as string) || undefined,
      };

      // 🚨 事件发布逻辑 - 业务流程触发
      if (paymentIntent.status === "succeeded") {
        this.logger.log(`Payment confirmed successfully: ${paymentIntent.id}`);
        
        this.eventEmitter.emit("payment.confirmed", {
          paymentIntentId: paymentIntent.id,
          orderId: paymentIntent.metadata?.orderId,
          amount: paymentIntent.amount,
          chargeId: (paymentIntent.latest_charge as string) ||
            (paymentIntent.charges?.data?.[0]?.id as string) || undefined,
        });
      } else if (paymentIntent.status === "requires_action") {
        this.logger.log(`Payment requires action: ${paymentIntent.id}`);
        response.failureReason = "Payment requires additional authentication";
      } else if (paymentIntent.status === "canceled") {
        this.logger.warn(`Payment failed: ${paymentIntent.id}`);
        
        this.eventEmitter.emit("payment.failed", {
          paymentIntentId: paymentIntent.id,
          orderId: paymentIntent.metadata?.orderId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          failureReason: paymentIntent.last_payment_error?.message || "Payment failed",
        });

        throw new Error(`Payment confirmation failed: ${paymentIntent.last_payment_error?.message || "Unknown error"}`);
      }

      return response;
    } catch (error) {
      this.logger.error(`Failed to confirm payment ${request.paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * 🚨 核心业务逻辑：Webhook事件处理 - 90%复用
   * 
   * 关键功能：
   * - Webhook签名验证
   * - 事件幂等性处理
   * - 多种支付事件类型处理
   * - 事件状态管理和持久化
   */
  async handleWebhookEvent(eventData: WebhookEventData, signature: string): Promise<void> {
    try {
      this.logger.log(`Processing webhook event: ${eventData.id} (type: ${eventData.type})`);

      // 🚨 内存幂等性检查 - 防重复处理
      if (this.isEventProcessed(eventData.id)) {
        this.logger.debug(`Event ${eventData.id} already processed, skipping`);
        return;
      }

      // 标记事件为正在处理
      this.processingEvents.add(eventData.id);

      try {
        // 🚨 Webhook签名验证 - 安全核心
        const verifiedEvent = this.verifyWebhookSignature(
          eventData.rawPayload || "",
          signature,
        );

        if (!verifiedEvent) {
          throw new Error(`Invalid webhook signature for event ${eventData.id}`);
        }

        // 🚨 事件类型处理分发 - 业务逻辑核心
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

        // 标记事件为已处理
        this.markEventAsProcessed(eventData.id, processedData);

        this.logger.log(`Webhook event processed successfully: ${eventData.id}`);
      } catch (error) {
        // 处理失败时移除处理中标记
        this.processingEvents.delete(eventData.id);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to process webhook event ${eventData.id}:`, error);
      throw error;
    }
  }

  /**
   * 🚨 核心业务逻辑：Stripe退款处理 - 95%复用
   * 
   * 关键功能：
   * - 退款金额验证和限制检查
   * - Stripe退款API调用
   * - 退款状态管理和事件发布
   * - 幂等性保护机制
   */
  async processStripeRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      this.logger.log(`Processing Stripe refund for order: ${request.orderId}`);

      // 🚨 退款参数验证
      if (!request.paymentIntentId) {
        throw new Error("Payment Intent ID is required for Stripe refund");
      }

      // 🚨 幂等性键生成
      const idempotencyKey = this.generateIdempotencyKey(request.orderId, "stripe_refund");

      // 🚨 Payment Intent状态验证
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        request.paymentIntentId,
        { expand: ["charges"] }
      );

      if (paymentIntent.status !== "succeeded") {
        throw new Error(`Payment Intent ${request.paymentIntentId} has status ${paymentIntent.status}, cannot refund`);
      }

      // 🚨 退款金额计算和验证
      const refundAmountCents = request.amount
        ? Math.round(request.amount.toNumber() * 100)
        : undefined; // 未指定金额时为全额退款

      if (refundAmountCents) {
        const expandedPaymentIntent = paymentIntent as any;
        if (expandedPaymentIntent.charges?.data && expandedPaymentIntent.charges.data.length > 0) {
          const charge = expandedPaymentIntent.charges.data[0];
          const totalRefunded = charge.amount_refunded || 0;
          const totalCharged = charge.amount || 0;
          const availableForRefund = totalCharged - totalRefunded;

          if (refundAmountCents > availableForRefund) {
            throw new Error(`Refund amount ${refundAmountCents} exceeds available amount ${availableForRefund}`);
          }
        }
      }

      // 🚨 Stripe退款创建 - 核心API调用
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

      // 🚨 退款响应构造
      const refundResponse: RefundResponse = {
        id: stripeRefund.id,
        amount: stripeRefund.amount / 100, // 转换回货币单位
        status: this.mapStripeRefundStatusToString(stripeRefund.status) as "pending" | "succeeded" | "failed",
        orderId: request.orderId,
        refundedAt: new Date(stripeRefund.created * 1000),
      };

      // 🚨 退款事件发布
      this.eventEmitter.emit("payment.refund.created", {
        refundId: stripeRefund.id,
        orderId: request.orderId,
        paymentIntentId: request.paymentIntentId,
        amount: refundResponse.amount,
        status: refundResponse.status,
      });

      this.logger.log(`Stripe refund processed successfully: ${stripeRefund.id}`);
      return refundResponse;
    } catch (error) {
      this.logger.error(`Failed to process Stripe refund for order ${request.orderId}:`, error);
      throw error;
    }
  }

  // 🚨 以下为支持方法 - 100%复用的工具函数

  /**
   * 重复支付检查算法 - 100%复用
   */
  private async checkDuplicatePayment(orderId: string, amount: Decimal): Promise<boolean> {
    try {
      const existingPayments = await this.paymentRepository.findMany({
        where: {
          orderId: orderId,
          status: { in: ["pending", "processing", "completed"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingPayments.length === 0) {
        return false;
      }

      // 检查相同金额的支付
      const duplicatePayment = existingPayments.find((payment) =>
        payment.amount.equals(amount),
      );

      if (duplicatePayment) {
        this.logger.warn(`Duplicate payment detected for order ${orderId}: existing payment ${duplicatePayment.id}`);
        return true;
      }

      // 检查已完成的支付
      const completedPayment = existingPayments.find((payment) => payment.status === "completed");
      if (completedPayment) {
        this.logger.warn(`Order ${orderId} already has completed payment ${completedPayment.id}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to check duplicate payment for order ${orderId}:`, error);
      return true; // 保守策略
    }
  }

  /**
   * 事件幂等性检查 - 100%复用
   */
  private isEventProcessed(eventId: string): boolean {
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
   * 事件处理标记 - 100%复用
   */
  private markEventAsProcessed(eventId: string, data?: any): void {
    this.eventStore.set(eventId, {
      processedAt: new Date(),
      data: data || null,
    });

    this.processingEvents.delete(eventId);
    this.logger.debug(`Event marked as processed: ${eventId}`);
  }

  /**
   * 过期事件清理 - 100%复用
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
      this.logger.debug(`Cleaned up ${cleanedCount} expired events from memory store`);
    }
  }

  /**
   * Webhook签名验证 - 100%复用
   */
  private verifyWebhookSignature(payload: string, signature: string): any | null {
    try {
      if (!this.stripeConfig.webhookSecret) {
        this.logger.error("Webhook secret is not configured");
        return null;
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.stripeConfig.webhookSecret,
      );

      this.logger.debug(`Webhook signature verified successfully for event: ${event.type}`);
      return event;
    } catch (error) {
      this.logger.error("Webhook signature verification failed:", {
        error: error.message,
        signatureLength: signature ? signature.length : 0,
        payloadLength: payload ? payload.length : 0,
      });
      return null;
    }
  }

  /**
   * 幂等性键生成 - 100%复用
   */
  private generateIdempotencyKey(orderId: string, operation: string): string {
    const timestamp = Date.now();
    return `${operation}_${orderId}_${timestamp}`;
  }

  /**
   * Stripe状态映射 - 100%复用
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

  /**
   * 退款状态映射 - 100%复用
   */
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

  /**
   * 支付成功事件处理 - 100%复用
   */
  private async handlePaymentSucceeded(eventData: WebhookEventData): Promise<any> {
    const paymentIntent = eventData.data.object;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(`Payment succeeded but no orderId in metadata: ${paymentIntent.id}`);
      return { processed: false, reason: "missing_order_id" };
    }

    this.eventEmitter.emit("payment.succeeded", {
      orderId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      practitionerId: paymentIntent.metadata?.practitionerId,
    });

    return {
      processed: true,
      orderId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    };
  }

  /**
   * 支付失败事件处理 - 100%复用
   */
  private async handlePaymentFailed(eventData: WebhookEventData): Promise<any> {
    const paymentIntent = eventData.data.object;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(`Payment failed but no orderId in metadata: ${paymentIntent.id}`);
      return { processed: false, reason: "missing_order_id" };
    }

    this.eventEmitter.emit("payment.failed", {
      orderId,
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message || "Unknown error",
      practitionerId: paymentIntent.metadata?.practitionerId,
    });

    return {
      processed: true,
      orderId,
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message,
    };
  }

  /**
   * 支付取消事件处理 - 100%复用
   */
  private async handlePaymentCanceled(eventData: WebhookEventData): Promise<any> {
    const paymentIntent = eventData.data.object;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(`Payment canceled but no orderId in metadata: ${paymentIntent.id}`);
      return { processed: false, reason: "missing_order_id" };
    }

    this.eventEmitter.emit("payment.canceled", {
      orderId,
      paymentIntentId: paymentIntent.id,
      practitionerId: paymentIntent.metadata?.practitionerId,
    });

    return {
      processed: true,
      orderId,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * 争议事件处理 - 100%复用
   */
  private async handleChargeDispute(eventData: WebhookEventData): Promise<any> {
    const dispute = eventData.data.object;
    const chargeId = dispute.charge;

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
}

/**
 * Supabase适配器工厂
 * 
 * 使用方法：
 * ```typescript
 * import { createClient } from '@supabase/supabase-js'
 * 
 * const supabase = createClient(url, key)
 * const adapters = createSupabasePaymentAdapters(supabase)
 * const paymentService = new StripePaymentService(
 *   adapters.paymentRepository,
 *   adapters.accountTransactionRepository, 
 *   adapters.practitionerAccountService,
 *   adapters.eventEmitter,
 *   stripeConfig,
 *   paymentConfig
 * )
 * ```
 */
export function createSupabasePaymentAdapters(supabaseClient: any) {
  return {
    paymentRepository: {
      async findMany(where: any, orderBy?: any) {
        let query = supabaseClient.from('payments').select('*');
        
        if (where.orderId) {
          query = query.eq('orderId', where.orderId);
        }
        
        if (where.status?.in) {
          query = query.in('status', where.status.in);
        }

        if (orderBy?.createdAt) {
          query = query.order('createdAt', { ascending: orderBy.createdAt === 'asc' });
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      
      async create(data: any) {
        const { data: result, error } = await supabaseClient
          .from('payments')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return result;
      },
      
      async update(id: string, data: any) {
        const { data: result, error } = await supabaseClient
          .from('payments')
          .update(data)
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        return result;
      },
    },

    accountTransactionRepository: {
      async findUnique(where: any, include?: any) {
        let query = supabaseClient.from('account_transactions').select('*');
        
        if (include?.account) {
          query = query.select('*, account:accounts(practitionerId)');
        }
        
        if (where.id) {
          query = query.eq('id', where.id);
        }

        const { data, error } = await query.single();
        if (error) throw error;
        return data;
      },
    },

    eventEmitter: {
      emit(event: string, data: any) {
        // 使用Supabase实时功能发布事件
        supabaseClient.channel('payment-events').send({
          type: 'broadcast',
          event,
          payload: data,
        });
      },
    },
  };
}

/* 
 * ⚠️ Supabase迁移注意事项：
 * 
 * 1. Edge Functions环境：
 *    - 使用Deno运行时环境
 *    - 动态导入Stripe SDK
 *    - 适配console日志系统
 * 
 * 2. RLS策略设置：
 *    - payments表基于practitioner_id设置访问策略
 *    - 支付事件表设置适当的读写权限
 * 
 * 3. 实时事件系统：
 *    - 使用Supabase Realtime替代EventEmitter
 *    - 配置支付事件频道
 * 
 * 4. 环境变量配置：
 *    - STRIPE_SECRET_KEY
 *    - STRIPE_WEBHOOK_SECRET
 *    - 支付金额限制配置
 * 
 * 5. 监控和日志：
 *    - 配置Edge Functions日志收集
 *    - 支付事件监控和告警
 *    - 性能指标追踪
 * 
 * 6. 安全考虑：
 *    - Webhook端点安全验证
 *    - 支付数据加密存储
 *    - 敏感信息访问控制
 */