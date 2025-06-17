import { Decimal } from "@prisma/client/runtime/library";

/**
 * 支付方法类型
 */
export enum PaymentMethod {
  STRIPE_CARD = "stripe_card",
  CLINIC_ACCOUNT = "clinic_account",
}

/**
 * 支付状态
 */
export enum PaymentStatus {
  PENDING = "pending",
  REQUIRES_PAYMENT_METHOD = "requires_payment_method",
  REQUIRES_CONFIRMATION = "requires_confirmation",
  REQUIRES_ACTION = "requires_action",
  PROCESSING = "processing",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELLED = "cancelled",
  CANCELED = "canceled", // Stripe uses 'canceled'
  REFUNDED = "refunded",
  UNKNOWN = "unknown",
}

/**
 * 支付意图创建请求
 */
export interface CreatePaymentIntentRequest {
  amount: Decimal;
  currency: string;
  orderId: string;
  clinicId: string;
  metadata?: Record<string, string>;
}

/**
 * 支付意图响应
 */
export interface PaymentIntentResponse {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  orderId: string;
  createdAt: Date;
}

/**
 * 支付确认请求
 */
export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

/**
 * 支付确认响应
 */
export interface PaymentConfirmationResponse {
  id: string;
  status: PaymentStatus;
  orderId: string;
  amount: number;
  chargeId?: string;
  failureReason?: string;
}

/**
 * 诊所账户扣款请求
 */
export interface ClinicAccountDeductionRequest {
  clinicId: string;
  amount: Decimal;
  orderId: string;
  description: string;
  idempotencyKey: string;
}

/**
 * 诊所账户扣款响应
 */
export interface ClinicAccountDeductionResponse {
  transactionId: string;
  clinicId: string;
  amount: number;
  remainingBalance: number;
  orderId: string;
  status: "success" | "insufficient_funds" | "failed";
}

/**
 * 退款请求
 */
export interface RefundRequest {
  paymentIntentId?: string;
  transactionId?: string;
  amount?: Decimal;
  reason?: string;
  orderId: string;
}

/**
 * 退款响应
 */
export interface RefundResponse {
  id: string;
  amount: number;
  status: "pending" | "succeeded" | "failed";
  orderId: string;
  refundedAt: Date;
}

/**
 * 已处理事件记录接口
 *
 * 用于内存幂等性机制，记录已处理的webhook事件
 * 防止重复处理同一事件，确保业务逻辑幂等性
 *
 * @interface ProcessedEvent
 * @description 内存存储的事件处理记录
 * @version 1.0.0 - MVP版本，简化内存存储
 * @future 企业层将升级为数据库持久化存储
 */
export interface ProcessedEvent {
  /** Stripe事件ID */
  eventId: string;

  /** 事件处理完成时间 */
  processedAt: Date;

  /** 处理状态 */
  status: "success" | "failed";

  /** 可选：失败原因 */
  failureReason?: string;

  /** 可选：处理耗时（毫秒） */
  processingTime?: number;
}

/**
 * Stripe Webhook事件数据接口
 *
 * 基于Stripe官方Webhook事件结构，支持payment_intent相关事件处理
 * 预留扩展字段以支持未来的企业级功能需求
 *
 * @interface WebhookEventData
 * @description 处理Stripe webhook事件的核心数据结构
 * @version 1.0.0 - MVP版本，支持基础事件类型
 * @future 企业层将扩展支持更多事件类型和元数据
 */
export interface WebhookEventData {
  /** Stripe事件唯一标识符，格式: evt_xxx */
  id: string;

  /**
   * 事件类型，当前支持:
   * - payment_intent.succeeded
   * - payment_intent.payment_failed
   * - payment_intent.canceled
   */
  type: string;

  /** 事件数据主体，包含具体的Stripe对象 */
  data: {
    /** 事件关联的Stripe对象（如PaymentIntent） */
    object: any;
    /** 可选：对象变更前的状态（仅update事件） */
    previous_attributes?: Record<string, any>;
  };

  /** 事件创建时间戳（Unix时间戳，秒） */
  created: number;

  /** 是否为测试模式下的事件 */
  livemode?: boolean;

  /** 原始负载数据，用于签名验证 */
  rawPayload?: string;

  /**
   * 扩展性预留字段 - 企业层功能
   * 为未来版本预留，当前MVP版本可选
   */

  /** Stripe API版本号，用于向后兼容 */
  api_version?: string;

  /** 事件请求信息，用于追踪和调试 */
  request?: {
    /** 触发事件的请求ID */
    id: string | null;
    /** 请求的幂等性键 */
    idempotency_key?: string | null;
  };

  /** 等待中的webhook数量，用于重试机制 */
  pending_webhooks?: number;
}

/**
 * 支付引擎核心接口
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
export interface IPaymentEngine {
  /**
   * Stripe支付意图管理
   */
  createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<PaymentIntentResponse>;
  confirmPayment(
    request: ConfirmPaymentRequest,
  ): Promise<PaymentConfirmationResponse>;
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResponse>;
  cancelPaymentIntent(paymentIntentId: string): Promise<void>;

  /**
   * 诊所账户管理
   */
  deductFromClinicAccount(
    request: ClinicAccountDeductionRequest,
  ): Promise<ClinicAccountDeductionResponse>;
  refundToClinicAccount(
    clinicId: string,
    amount: Decimal,
    orderId: string,
    reason?: string,
  ): Promise<RefundResponse>;
  getClinicAccountBalance(
    clinicId: string,
  ): Promise<{ balance: number; currency: string }>;

  /**
   * 退款处理
   */
  processStripeRefund(request: RefundRequest): Promise<RefundResponse>;
  processClinicAccountRefund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Webhook事件处理
   */
  handleWebhookEvent(
    eventData: WebhookEventData,
    signature: string,
  ): Promise<void>;
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * 幂等性和安全
   */
  generateIdempotencyKey(orderId: string, operation: string): string;
  checkDuplicatePayment(orderId: string, amount: Decimal): Promise<boolean>;
}
