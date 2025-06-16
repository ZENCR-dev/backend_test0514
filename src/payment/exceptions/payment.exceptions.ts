import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * 支付基础异常类
 */
export abstract class PaymentException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    public readonly errorCode: string,
    public readonly details?: any,
  ) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}

/**
 * Stripe相关异常
 */
export class StripePaymentException extends PaymentException {
  constructor(message: string, stripeError?: any) {
    super(message, HttpStatus.BAD_REQUEST, "STRIPE_PAYMENT_ERROR", {
      stripeErrorType: stripeError?.type,
      stripeErrorCode: stripeError?.code,
      stripeErrorParam: stripeError?.param,
      stripeErrorMessage: stripeError?.message,
    });
  }
}

/**
 * 支付意图创建失败异常
 */
export class PaymentIntentCreationException extends PaymentException {
  constructor(orderId: string, reason: string) {
    super(
      `Failed to create payment intent for order ${orderId}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      "PAYMENT_INTENT_CREATION_FAILED",
      { orderId, reason },
    );
  }
}

/**
 * 支付确认失败异常
 */
export class PaymentConfirmationException extends PaymentException {
  constructor(paymentIntentId: string, reason: string) {
    super(
      `Failed to confirm payment ${paymentIntentId}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      "PAYMENT_CONFIRMATION_FAILED",
      { paymentIntentId, reason },
    );
  }
}

/**
 * 诊所账户余额不足异常
 */
export class InsufficientFundsException extends PaymentException {
  constructor(
    clinicId: string,
    requestedAmount: number,
    availableBalance: number,
  ) {
    super(
      `Insufficient funds in clinic account ${clinicId}. Requested: ${requestedAmount}, Available: ${availableBalance}`,
      HttpStatus.BAD_REQUEST,
      "INSUFFICIENT_FUNDS",
      { clinicId, requestedAmount, availableBalance },
    );
  }
}

/**
 * 诊所账户扣款失败异常
 */
export class ClinicAccountDeductionException extends PaymentException {
  constructor(clinicId: string, amount: number, reason: string) {
    super(
      `Failed to deduct ${amount} from clinic account ${clinicId}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      "CLINIC_ACCOUNT_DEDUCTION_FAILED",
      { clinicId, amount, reason },
    );
  }
}

/**
 * 重复支付检测异常
 */
export class DuplicatePaymentException extends PaymentException {
  constructor(orderId: string, existingPaymentId: string) {
    super(
      `Duplicate payment detected for order ${orderId}. Existing payment: ${existingPaymentId}`,
      HttpStatus.CONFLICT,
      "DUPLICATE_PAYMENT_DETECTED",
      { orderId, existingPaymentId },
    );
  }
}

/**
 * 幂等性键冲突异常
 */
export class IdempotencyKeyConflictException extends PaymentException {
  constructor(idempotencyKey: string, existingOperationId: string) {
    super(
      `Idempotency key conflict: ${idempotencyKey}. Existing operation: ${existingOperationId}`,
      HttpStatus.CONFLICT,
      "IDEMPOTENCY_KEY_CONFLICT",
      { idempotencyKey, existingOperationId },
    );
  }
}

/**
 * 退款处理失败异常
 */
export class RefundProcessingException extends PaymentException {
  constructor(paymentId: string, reason: string) {
    super(
      `Failed to process refund for payment ${paymentId}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      "REFUND_PROCESSING_FAILED",
      { paymentId, reason },
    );
  }
}

/**
 * Webhook签名验证失败异常
 */
export class WebhookSignatureException extends PaymentException {
  constructor(reason: string) {
    super(
      `Webhook signature verification failed: ${reason}`,
      HttpStatus.UNAUTHORIZED,
      "WEBHOOK_SIGNATURE_INVALID",
      { reason },
    );
  }
}

/**
 * Webhook事件处理失败异常
 */
export class WebhookEventProcessingException extends PaymentException {
  constructor(eventId: string, eventType: string, reason: string) {
    super(
      `Failed to process webhook event ${eventId} of type ${eventType}: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      "WEBHOOK_EVENT_PROCESSING_FAILED",
      { eventId, eventType, reason },
    );
  }
}

/**
 * 支付状态无效异常
 */
export class InvalidPaymentStatusException extends PaymentException {
  constructor(
    paymentId: string,
    currentStatus: string,
    expectedStatus: string,
  ) {
    super(
      `Invalid payment status for ${paymentId}. Current: ${currentStatus}, Expected: ${expectedStatus}`,
      HttpStatus.BAD_REQUEST,
      "INVALID_PAYMENT_STATUS",
      { paymentId, currentStatus, expectedStatus },
    );
  }
}

/**
 * 支付金额无效异常
 */
export class InvalidPaymentAmountException extends PaymentException {
  constructor(amount: number, reason: string) {
    super(
      `Invalid payment amount ${amount}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      "INVALID_PAYMENT_AMOUNT",
      { amount, reason },
    );
  }
}

/**
 * 诊所账户不存在异常
 */
export class ClinicAccountNotFoundException extends PaymentException {
  constructor(clinicId: string) {
    super(
      `Clinic account not found: ${clinicId}`,
      HttpStatus.NOT_FOUND,
      "CLINIC_ACCOUNT_NOT_FOUND",
      { clinicId },
    );
  }
}

/**
 * 诊所账户状态无效异常
 */
export class InvalidClinicAccountStatusException extends PaymentException {
  constructor(clinicId: string, currentStatus: string, operation: string) {
    super(
      `Cannot perform ${operation} on clinic account ${clinicId} with status ${currentStatus}`,
      HttpStatus.BAD_REQUEST,
      "INVALID_CLINIC_ACCOUNT_STATUS",
      { clinicId, currentStatus, operation },
    );
  }
}

/**
 * 并发控制异常（乐观锁冲突）
 */
export class ConcurrencyControlException extends PaymentException {
  constructor(resourceType: string, resourceId: string, operation: string) {
    super(
      `Concurrency conflict detected for ${resourceType} ${resourceId} during ${operation}. Please retry.`,
      HttpStatus.CONFLICT,
      "CONCURRENCY_CONFLICT",
      { resourceType, resourceId, operation },
    );
  }
}

/**
 * 支付配置错误异常
 */
export class PaymentConfigurationException extends PaymentException {
  constructor(configKey: string, reason: string) {
    super(
      `Payment configuration error for ${configKey}: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      "PAYMENT_CONFIGURATION_ERROR",
      { configKey, reason },
    );
  }
}

/**
 * 支付超时异常
 */
export class PaymentTimeoutException extends PaymentException {
  constructor(paymentId: string, timeoutDuration: number) {
    super(
      `Payment ${paymentId} timed out after ${timeoutDuration}ms`,
      HttpStatus.REQUEST_TIMEOUT,
      "PAYMENT_TIMEOUT",
      { paymentId, timeoutDuration },
    );
  }
}

/**
 * 支付网络错误异常
 */
export class PaymentNetworkException extends PaymentException {
  constructor(operation: string, reason: string) {
    super(
      `Network error during ${operation}: ${reason}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      "PAYMENT_NETWORK_ERROR",
      { operation, reason },
    );
  }
}

/**
 * 支付意图未找到异常
 */
export class PaymentIntentNotFoundException extends PaymentException {
  constructor(paymentIntentId: string) {
    super(
      `Payment intent not found: ${paymentIntentId}`,
      HttpStatus.NOT_FOUND,
      "PAYMENT_INTENT_NOT_FOUND",
      { paymentIntentId },
    );
  }
}
