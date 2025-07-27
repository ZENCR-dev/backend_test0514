import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  IsPositive,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  PaymentMethod,
  PaymentStatus,
} from "../interfaces/payment-engine.interface";

/**
 * 创建支付意图DTO
 */
export class CreatePaymentIntentDto {
  @ApiProperty({
    description: "支付金额（以分为单位）",
    example: 2500,
    minimum: 1,
    maximum: 999999999,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(999999999)
  @Transform(({ value }) => parseInt(value))
  amount: number;

  @ApiProperty({
    description: "货币代码",
    example: "nzd",
    default: "nzd",
  })
  @IsString()
  @IsOptional()
  currency: string = "nzd";

  @ApiProperty({
    description: "订单ID",
    example: "order_123456789",
  })
  @IsString()
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: "医师ID",
    example: "practitioner_123456789",
  })
  @IsString()
  @IsUUID()
  practitionerId: string;

  @ApiPropertyOptional({
    description: "支付元数据",
    example: { source: "web", version: "1.0" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

/**
 * 确认支付DTO
 */
export class ConfirmPaymentDto {
  @ApiProperty({
    description: "支付意图ID",
    example: "pi_1234567890abcdef",
  })
  @IsString()
  paymentIntentId: string;

  @ApiPropertyOptional({
    description: "支付方法ID",
    example: "pm_1234567890abcdef",
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: "支付完成后的返回URL",
    example: "https://example.com/payment/success",
  })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}

/**
 * 诊所账户扣款DTO
 */
export class PractitionerAccountDeductionDto {
  @ApiProperty({
    description: "医师ID",
    example: "practitioner_123456789",
  })
  @IsString()
  @IsUUID()
  practitionerId: string;

  @ApiProperty({
    description: "扣款金额（以分为单位）",
    example: 2500,
    minimum: 1,
    maximum: 999999999,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(999999999)
  @Transform(({ value }) => parseInt(value))
  amount: number;

  @ApiProperty({
    description: "订单ID",
    example: "order_123456789",
  })
  @IsString()
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: "扣款描述",
    example: "订单支付 - 中药处方费用",
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: "幂等性键",
    example: "idem_order_123456789_deduction",
  })
  @IsString()
  idempotencyKey: string;
}

/**
 * 退款请求DTO
 */
export class RefundRequestDto {
  @ApiPropertyOptional({
    description: "Stripe支付意图ID",
    example: "pi_1234567890abcdef",
  })
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @ApiPropertyOptional({
    description: "诊所账户交易ID",
    example: "txn_1234567890abcdef",
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({
    description: "订单ID",
    example: "order_123456789",
  })
  @IsString()
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({
    description: "退款金额（以分为单位，不填则全额退款）",
    example: 1000,
    minimum: 1,
    maximum: 999999999,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(999999999)
  @Transform(({ value }) => parseInt(value))
  amount?: number;

  @ApiPropertyOptional({
    description: "退款原因",
    example: "客户取消订单",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * 支付状态查询DTO
 */
export class PaymentStatusQueryDto {
  @ApiProperty({
    description: "支付意图ID",
    example: "pi_1234567890abcdef",
  })
  @IsString()
  paymentIntentId: string;
}

/**
 * 诊所账户余额查询DTO
 */
export class PractitionerAccountBalanceQueryDto {
  @ApiProperty({
    description: "医师ID",
    example: "practitioner_123456789",
  })
  @IsString()
  @IsUUID()
  practitionerId: string;
}

/**
 * Webhook事件DTO
 */
export class WebhookEventDto {
  @ApiProperty({
    description: "事件ID",
    example: "evt_1234567890abcdef",
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: "事件类型",
    example: "payment_intent.succeeded",
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: "事件数据",
  })
  @IsObject()
  data: {
    object: any;
  };

  @ApiProperty({
    description: "事件创建时间戳",
    example: 1640995200,
  })
  @IsNumber()
  created: number;
}

/**
 * 支付意图响应DTO
 */
export class PaymentIntentResponseDto {
  @ApiProperty({
    description: "支付意图ID",
    example: "pi_1234567890abcdef",
  })
  id: string;

  @ApiProperty({
    description: "客户端密钥",
    example: "pi_1234567890abcdef_secret_1234567890abcdef",
  })
  clientSecret: string;

  @ApiProperty({
    description: "支付金额",
    example: 2500,
  })
  amount: number;

  @ApiProperty({
    description: "货币代码",
    example: "nzd",
  })
  currency: string;

  @ApiProperty({
    description: "支付状态",
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: "关联订单ID",
    example: "order_123456789",
  })
  orderId: string;

  @ApiProperty({
    description: "创建时间",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;
}

/**
 * 支付确认响应DTO
 */
export class PaymentConfirmationResponseDto {
  @ApiProperty({
    description: "支付ID",
    example: "pi_1234567890abcdef",
  })
  id: string;

  @ApiProperty({
    description: "支付状态",
    enum: PaymentStatus,
    example: PaymentStatus.SUCCEEDED,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: "关联订单ID",
    example: "order_123456789",
  })
  orderId: string;

  @ApiProperty({
    description: "支付金额",
    example: 2500,
  })
  amount: number;

  @ApiPropertyOptional({
    description: "Stripe收费ID",
    example: "ch_1234567890abcdef",
  })
  chargeId?: string;

  @ApiPropertyOptional({
    description: "失败原因",
    example: "insufficient_funds",
  })
  failureReason?: string;
}

/**
 * 诊所账户扣款响应DTO
 */
export class PractitionerAccountDeductionResponseDto {
  @ApiProperty({
    description: "交易ID",
    example: "txn_1234567890abcdef",
  })
  transactionId: string;

  @ApiProperty({
    description: "医师ID",
    example: "practitioner_123456789",
  })
  practitionerId: string;

  @ApiProperty({
    description: "扣款金额",
    example: 2500,
  })
  amount: number;

  @ApiProperty({
    description: "剩余余额",
    example: 47500,
  })
  remainingBalance: number;

  @ApiProperty({
    description: "关联订单ID",
    example: "order_123456789",
  })
  orderId: string;

  @ApiProperty({
    description: "扣款状态",
    enum: ["success", "insufficient_funds", "failed"],
    example: "success",
  })
  status: "success" | "insufficient_funds" | "failed";
}

/**
 * 退款响应DTO
 */
export class RefundResponseDto {
  @ApiProperty({
    description: "退款ID",
    example: "re_1234567890abcdef",
  })
  id: string;

  @ApiProperty({
    description: "退款金额",
    example: 1000,
  })
  amount: number;

  @ApiProperty({
    description: "退款状态",
    enum: ["pending", "succeeded", "failed"],
    example: "succeeded",
  })
  status: "pending" | "succeeded" | "failed";

  @ApiProperty({
    description: "关联订单ID",
    example: "order_123456789",
  })
  orderId: string;

  @ApiProperty({
    description: "退款时间",
    example: "2024-01-01T00:00:00.000Z",
  })
  refundedAt: Date;
}

/**
 * 诊所账户余额响应DTO
 */
export class PractitionerAccountBalanceResponseDto {
  @ApiProperty({
    description: "账户余额",
    example: 50000,
  })
  balance: number;

  @ApiProperty({
    description: "货币代码",
    example: "nzd",
  })
  currency: string;
}
