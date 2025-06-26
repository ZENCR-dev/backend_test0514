/**
 * 业务编排服务事件类型定义
 * 用于统一前后端事件格式和类型
 */

import { OrderStatus } from '@prisma/client';

/**
 * 连接状态事件接口
 * 
 * 用于表示WebSocket连接状态变更
 */
export interface ConnectionStatusEvent {
  /** 连接状态 */
  connected: boolean;
  
  /** 用户ID */
  userId: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 连接元数据 */
  metadata?: Record<string, any>;
}

/**
 * 支付成功事件接口
 * 
 * 用于表示支付成功的事件数据
 */
export interface PaymentSucceededEvent {
  /** 订单ID */
  orderId: string;
  
  /** 支付ID */
  paymentId: string;
  
  /** 支付金额 */
  amount: number;
  
  /** 支付货币 */
  currency: string;
  
  /** 支付方式 */
  paymentMethod: string;
  
  /** 诊所ID（可选） */
  clinicId?: string;
  
  /** 用户ID（可选） */
  userId?: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 支付元数据 */
  metadata?: Record<string, any>;
}

/**
 * 支付失败事件接口
 * 
 * 用于表示支付失败的事件数据
 */
export interface PaymentFailedEvent {
  /** 订单ID */
  orderId: string;
  
  /** 支付ID */
  paymentId: string;
  
  /** 失败原因 */
  reason: string;
  
  /** 错误代码 */
  errorCode: string;
  
  /** 诊所ID（可选） */
  clinicId?: string;
  
  /** 用户ID（可选） */
  userId?: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 失败元数据 */
  metadata?: Record<string, any>;
}

/**
 * 支付取消事件
 */
export interface PaymentCanceledEvent {
  orderId: string;
  paymentIntentId: string;
  clinicId?: string;
  timestamp: string;
}

/**
 * 订单创建事件
 */
export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  clinicId?: string;
  totalAmount: number;
  items: Array<any>;
  timestamp: string;
}

/**
 * 订单状态变更事件接口
 * 
 * 用于表示订单状态变更的事件数据
 */
export interface OrderStatusChangedEvent {
  /** 订单ID */
  orderId: string;
  
  /** 新状态 */
  newStatus: OrderStatus;
  
  /** 旧状态 */
  oldStatus?: OrderStatus;
  
  /** 诊所ID（可选） */
  clinicId?: string;
  
  /** 用户ID（可选） */
  userId?: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 状态变更元数据 */
  metadata?: Record<string, any>;
}

/**
 * 订单补偿事件
 */
export interface OrderCompensationEvent {
  /** 订单ID */
  orderId: string;
  
  /** 原始事件 */
  originalEvent: any;
  
  /** 错误信息 */
  error: string | { message: string; code: string };
  
  /** 补偿原因 */
  reason?: string;
  
  /** 错误消息 */
  errorMessage?: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 补偿元数据 */
  metadata?: Record<string, any>;
}

/**
 * 错误事件
 */
export interface ErrorEvent {
  /** 错误代码 */
  code: string;
  
  /** 错误信息 */
  message: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 订单ID（可选） */
  orderId?: string;
  
  /** 支付ID（可选） */
  paymentId?: string;
  
  /** 错误元数据 */
  [key: string]: any;
}

/**
 * 退款请求事件
 */
export interface RefundRequiredEvent {
  /** 订单ID */
  orderId: string;
  
  /** 支付ID（可选） */
  paymentId?: string;
  
  /** 退款原因 */
  reason: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 退款元数据 */
  metadata?: Record<string, any>;
}

/**
 * 服务启动事件
 */
export interface ServiceStartedEvent {
  /** 服务名称 */
  service: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 服务配置 */
  config?: Record<string, any>;
}

/**
 * 订单就绪事件
 */
export interface OrderReadyEvent {
  /** 订单ID */
  orderId: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 消息 */
  message: string;
  
  /** 取货地点（可选） */
  pickupLocation?: string;
  
  /** 就绪元数据 */
  metadata?: Record<string, any>;
}

/**
 * 订单处理中事件
 */
export interface OrderProcessingEvent {
  /** 订单ID */
  orderId: string;
  
  /** 事件时间戳 */
  timestamp: string;
  
  /** 消息 */
  message: string;
  
  /** 预计完成时间（可选） */
  estimatedCompletionTime?: string;
  
  /** 处理元数据 */
  metadata?: Record<string, any>;
}

/**
 * 事件名称常量
 */
export const ORCHESTRATION_EVENTS = {
  // 支付事件
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELED: 'payment.canceled',
  
  // 订单事件
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_UPDATED: 'order.status.updated',
  ORDER_COMPENSATION: 'order.compensation',
  
  // 连接事件
  CONNECTION_STATUS: 'connection_status',
  ERROR: 'error',
  
  // 新增事件
  SERVICE_STARTED: 'service.started',
  REFUND_REQUIRED: 'refund.required',
  ORDER_PROCESSING: 'order.processing',
  ORDER_READY: 'order.ready'
} as const;

export type OrchestrationEventType = typeof ORCHESTRATION_EVENTS[keyof typeof ORCHESTRATION_EVENTS];

/**
 * 支付服务事件常量
 * 
 * 用于定义支付服务的事件类型
 */
export const PAYMENT_EVENTS = {
  /** 支付成功事件 */
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  
  /** 支付失败事件 */
  PAYMENT_FAILED: 'payment.failed',
  
  /** 退款处理事件 */
  REFUND_PROCESSED: 'payment.refund.processed',
} as const;

/**
 * 订单服务事件常量
 * 
 * 用于定义订单服务的事件类型
 */
export const ORDER_EVENTS = {
  /** 订单状态变更事件 */
  ORDER_STATUS_CHANGED: 'order.status.changed',
  
  /** 订单创建事件 */
  ORDER_CREATED: 'order.created',
  
  /** 订单更新事件 */
  ORDER_UPDATED: 'order.updated',
} as const;

/**
 * 所有业务编排事件类型联合
 */
export type OrchestrationEvent = 
  | ConnectionStatusEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | OrderStatusChangedEvent
  | OrderCompensationEvent
  | ErrorEvent
  | RefundRequiredEvent
  | ServiceStartedEvent
  | OrderReadyEvent
  | OrderProcessingEvent;

/**
 * 所有业务编排事件名称联合
 */
export type OrchestrationEventName = 
  | typeof ORCHESTRATION_EVENTS[keyof typeof ORCHESTRATION_EVENTS]
  | typeof PAYMENT_EVENTS[keyof typeof PAYMENT_EVENTS]
  | typeof ORDER_EVENTS[keyof typeof ORDER_EVENTS]; 