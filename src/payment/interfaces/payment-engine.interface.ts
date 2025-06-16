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
 * Webhook事件数据
 */
export interface WebhookEventData {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
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
