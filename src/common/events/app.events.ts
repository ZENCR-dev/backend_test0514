/**
 * 应用程序核心事件定义
 * 用于服务间的事件驱动通信
 */

/**
 * 订单相关事件
 */
export class OrderSubmittedForPaymentEvent {
  constructor(
    public readonly orderId: string,
    public readonly clinicId: string,
    public readonly totalAmount: number,
    public readonly paymentMethod: "prepaid" | "credit",
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
    public readonly cancelledBy: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * 支付相关事件
 */
export class PaymentInitiatedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly paymentMethod: "prepaid" | "credit",
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PaymentSucceededEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly stripePaymentIntentId?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly reason: string,
    public readonly errorCode?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * 账户相关事件
 */
export class AccountBalanceUpdatedEvent {
  constructor(
    public readonly accountId: string,
    public readonly previousBalance: number,
    public readonly newBalance: number,
    public readonly operation: "debit" | "credit",
    public readonly referenceType: "payment" | "refund" | "adjustment",
    public readonly referenceId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * 事件类型常量
 */
export const APP_EVENTS = {
  // 订单事件
  ORDER_SUBMITTED_FOR_PAYMENT: "order.submitted_for_payment",
  ORDER_CANCELLED: "order.cancelled",

  // 支付事件
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED: "payment.failed",

  // 账户事件
  ACCOUNT_BALANCE_UPDATED: "account.balance_updated",
} as const;

export type AppEventType = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];
