import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { OrderService } from "../../orders/services/order.service";
import { OrchestrationGateway } from "../gateways/orchestration.gateway";
import { EventPersistenceService } from "./event-persistence.service";
import {
  ORCHESTRATION_EVENTS,
  PAYMENT_EVENTS,
  ORDER_EVENTS,
  PaymentSucceededEvent,
  PaymentFailedEvent,
  OrderStatusChangedEvent,
  OrderCompensationEvent,
  ErrorEvent,
} from "../../common/events/types";
import { OrderStatus, EventProcessingStatus } from "@prisma/client";
import { IUpdateOrderStatusRequest } from "../../orders/interfaces/order-management.interface";

/**
 * 增强的监控指标接口
 */
interface ServiceMetrics {
  eventProcessing: {
    totalEventsProcessed: number;
    eventProcessingTimes: number[];
    averageProcessingTime: number;
    successRate: number;
    failureRate: number;
  };
  eventTypeDistribution: Record<string, number>;
  compensationMetrics: {
    totalCompensationsTriggered: number;
    compensationsByReason: Record<string, number>;
  };
  performanceAnalysis: {
    p50ProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
    slowestEventType: string;
    fastestEventType: string;
  };
  healthMetrics: {
    isHealthy: boolean;
    uptime: number;
    lastErrorTime: number | null;
    errorCount: number;
  };
}

/**
 * 业务编排服务
 *
 * 职责：
 * 1. 监听支付服务和订单服务的事件
 * 2. 协调支付服务和订单服务之间的业务流程
 * 3. 通过WebSocket向客户端广播事件
 *
 * 设计模式：观察者模式 + 中介者模式
 */
@Injectable()
export class OrchestrationService implements OnModuleInit {
  private readonly logger = new Logger(OrchestrationService.name);
  private isInitialized = false;
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000; // 2秒

  // 增强的监控指标
  private serviceStartTime = Date.now();
  private totalEventsProcessed = 0;
  private eventProcessingTimes: number[] = [];
  private eventSuccessCount = 0;
  private eventFailureCount = 0;
  private eventTypeDistribution = new Map<string, number>();
  private eventTypeProcessingTimes = new Map<string, number[]>();
  private totalCompensationsTriggered = 0;
  private compensationsByReason = new Map<string, number>();
  private lastErrorTime: number | null = null;
  private errorCount = 0;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly orderService: OrderService,
    private readonly orchestrationGateway: OrchestrationGateway,
    private readonly eventPersistenceService: EventPersistenceService,
  ) {}

  /**
   * 模块初始化时的钩子
   * 执行初始化逻辑
   */
  async onModuleInit() {
    try {
      this.logger.log("Initializing OrchestrationService...");

      // 确保事件监听器正确设置
      this.setupEventListeners();

      // 发布服务启动事件
      this.eventEmitter.emit(ORCHESTRATION_EVENTS.SERVICE_STARTED, {
        service: "orchestration",
        timestamp: new Date().toISOString(),
      });

      this.isInitialized = true;
      this.logger.log("OrchestrationService initialized successfully");
    } catch (error) {
      this.logger.error(
        `Failed to initialize OrchestrationService: ${error.message}`,
        error.stack,
      );

      // 重试初始化
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.logger.log(
          `Retrying initialization (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay}ms...`,
        );
        setTimeout(() => this.onModuleInit(), this.retryDelay);
      } else {
        this.logger.error(
          `Failed to initialize OrchestrationService after ${this.maxRetries} attempts`,
        );
        throw error;
      }
    }
  }

  /**
   * 设置事件监听器
   * 注册所有需要监听的事件
   */
  private setupEventListeners() {
    this.logger.log("Setting up event listeners");

    // 这些是通过装饰器监听的事件，不需要在这里显式注册
    this.logger.log(
      `Listening for payment events: ${PAYMENT_EVENTS.PAYMENT_SUCCEEDED}, ${PAYMENT_EVENTS.PAYMENT_FAILED}`,
    );
    this.logger.log(
      `Listening for order events: ${ORDER_EVENTS.ORDER_STATUS_CHANGED}`,
    );
  }

  /**
   * 处理支付成功事件
   *
   * 流程：
   * 1. 接收支付成功事件
   * 2. 更新订单状态为已支付
   * 3. 广播支付成功事件到客户端
   *
   * @param payload 支付成功事件数据
   */
  @OnEvent(PAYMENT_EVENTS.PAYMENT_SUCCEEDED)
  async handlePaymentSucceeded(payload: PaymentSucceededEvent) {
    const startTime = Date.now();
    const eventType = "PAYMENT_SUCCEEDED";

    // 在处理前持久化事件
    let eventLog;
    try {
      eventLog = await this.eventPersistenceService.persistEvent({
        eventType: PAYMENT_EVENTS.PAYMENT_SUCCEEDED,
        eventId: payload.paymentId,
        payload: payload,
        metadata: {
          orderId: payload.orderId,
          amount: payload.amount,
          timestamp: payload.timestamp,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist payment succeeded event: ${error.message}`,
        error.stack,
      );
      // 持久化失败不应阻止业务流程，继续处理
    }

    try {
      this.logger.log(
        `Payment succeeded for order ${payload.orderId}: ${JSON.stringify(payload)}`,
      );

      // 记录事件处理开始
      this.recordEventStart(eventType);

      // 验证事件数据
      if (!payload.orderId) {
        throw new Error("Invalid payment success event: missing orderId");
      }

      // 更新订单状态
      const updateData: IUpdateOrderStatusRequest = {
        status: OrderStatus.PAID,
        metadata: {
          paymentId: payload.paymentId,
          paymentMethod: payload.paymentMethod,
          paymentAmount: payload.amount,
          paymentTimestamp: payload.timestamp,
        },
      };

      // 调用订单服务更新状态
      const updatedOrder = await this.orderService
        .updateOrderStatus(payload.orderId, updateData)
        .catch((error) => {
          this.logger.error(
            `Failed to update order status for ${payload.orderId}: ${error.message}`,
            error.stack,
          );

          // 发布错误事件
          this.emitErrorEvent(
            "ORDER_UPDATE_FAILED",
            `Failed to update order status: ${error.message}`,
            {
              orderId: payload.orderId,
              paymentId: payload.paymentId,
            },
          );

          throw error;
        });

      this.logger.log(`Order ${payload.orderId} status updated to PAID`);

      // 广播支付成功事件到客户端
      this.orchestrationGateway.broadcastPaymentSucceeded(payload);

      // 记录事件处理成功
      this.recordEventSuccess(eventType, startTime);

      // 更新事件状态为成功
      if (eventLog) {
        try {
          await this.eventPersistenceService.updateEventStatus(
            eventLog.id,
            EventProcessingStatus.COMPLETED,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update event status: ${error.message}`,
            error.stack,
          );
        }
      }

      return updatedOrder;
    } catch (error) {
      this.logger.error(
        `Error handling payment success for order ${payload.orderId}: ${error.message}`,
        error.stack,
      );

      // 更新事件状态为失败
      if (eventLog) {
        try {
          await this.eventPersistenceService.updateEventStatus(
            eventLog.id,
            EventProcessingStatus.FAILED,
            error.message,
          );
        } catch (updateError) {
          this.logger.error(
            `Failed to update event status: ${updateError.message}`,
            updateError.stack,
          );
        }
      }

      // 记录事件处理失败
      this.recordEventFailure(eventType, startTime);

      // 尝试触发补偿机制
      this.triggerCompensation(
        payload.orderId,
        "PAYMENT_SUCCESS_HANDLING_FAILED",
        error.message,
      );

      throw error;
    }
  }

  /**
   * 处理支付失败事件
   *
   * 流程：
   * 1. 接收支付失败事件
   * 2. 更新订单状态为支付失败
   * 3. 广播支付失败事件到客户端
   *
   * @param payload 支付失败事件数据
   */
  @OnEvent(PAYMENT_EVENTS.PAYMENT_FAILED)
  async handlePaymentFailed(payload: PaymentFailedEvent) {
    const startTime = Date.now();
    const eventType = "PAYMENT_FAILED";

    // 在处理前持久化事件
    let eventLog;
    try {
      eventLog = await this.eventPersistenceService.persistEvent({
        eventType: PAYMENT_EVENTS.PAYMENT_FAILED,
        eventId: payload.paymentId,
        payload: payload,
        metadata: {
          orderId: payload.orderId,
          reason: payload.reason,
          errorCode: payload.errorCode,
          timestamp: payload.timestamp,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist payment failed event: ${error.message}`,
        error.stack,
      );
      // 持久化失败不应阻止业务流程，继续处理
    }

    try {
      this.logger.log(
        `Payment failed for order ${payload.orderId}: ${JSON.stringify(payload)}`,
      );

      // 记录事件处理开始
      this.recordEventStart(eventType);

      // 验证事件数据
      if (!payload.orderId) {
        throw new Error("Invalid payment failed event: missing orderId");
      }

      // 更新订单状态
      const updateData: IUpdateOrderStatusRequest = {
        status: OrderStatus.PAYMENT_FAILED,
        metadata: {
          paymentId: payload.paymentId,
          failureReason: payload.reason,
          failureCode: payload.errorCode,
          failureTimestamp: payload.timestamp,
        },
      };

      // 调用订单服务更新状态
      const updatedOrder = await this.orderService
        .updateOrderStatus(payload.orderId, updateData)
        .catch((error) => {
          this.logger.error(
            `Failed to update order status for ${payload.orderId}: ${error.message}`,
            error.stack,
          );

          // 发布错误事件
          this.emitErrorEvent(
            "ORDER_UPDATE_FAILED",
            `Failed to update order status: ${error.message}`,
            {
              orderId: payload.orderId,
              paymentId: payload.paymentId,
            },
          );

          throw error;
        });

      this.logger.log(
        `Order ${payload.orderId} status updated to PAYMENT_FAILED`,
      );

      // 广播支付失败事件到客户端
      this.orchestrationGateway.broadcastPaymentFailed(payload);

      // 记录事件处理成功
      this.recordEventSuccess(eventType, startTime);

      // 更新事件状态为成功
      if (eventLog) {
        try {
          await this.eventPersistenceService.updateEventStatus(
            eventLog.id,
            EventProcessingStatus.COMPLETED,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update event status: ${error.message}`,
            error.stack,
          );
        }
      }

      return updatedOrder;
    } catch (error) {
      this.logger.error(
        `Error handling payment failure for order ${payload.orderId}: ${error.message}`,
        error.stack,
      );

      // 更新事件状态为失败
      if (eventLog) {
        try {
          await this.eventPersistenceService.updateEventStatus(
            eventLog.id,
            EventProcessingStatus.FAILED,
            error.message,
          );
        } catch (updateError) {
          this.logger.error(
            `Failed to update event status: ${updateError.message}`,
            updateError.stack,
          );
        }
      }

      // 记录事件处理失败
      this.recordEventFailure(eventType, startTime);

      throw error;
    }
  }

  /**
   * 处理订单状态变更事件
   *
   * 流程：
   * 1. 接收订单状态变更事件
   * 2. 广播订单状态变更事件到客户端
   *
   * @param payload 订单状态变更事件数据
   */
  @OnEvent(ORDER_EVENTS.ORDER_STATUS_CHANGED)
  async handleOrderStatusChanged(payload: OrderStatusChangedEvent) {
    const startTime = Date.now();
    const eventType = "ORDER_STATUS_CHANGED";

    // 在处理前持久化事件
    let eventLog;
    try {
      eventLog = await this.eventPersistenceService.persistEvent({
        eventType: ORDER_EVENTS.ORDER_STATUS_CHANGED,
        eventId: payload.orderId,
        payload: payload,
        metadata: {
          orderId: payload.orderId,
          oldStatus: payload.oldStatus,
          newStatus: payload.newStatus,
          timestamp: payload.timestamp,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist order status changed event: ${error.message}`,
        error.stack,
      );
      // 持久化失败不应阻止业务流程，继续处理
    }

    try {
      this.logger.log(`Order status changed: ${JSON.stringify(payload)}`);

      // 记录事件处理开始
      this.recordEventStart(eventType);

      // 验证事件数据
      if (!payload.orderId || !payload.newStatus) {
        throw new Error(
          "Invalid order status change event: missing required fields",
        );
      }

      // 广播订单状态变更事件到客户端
      this.orchestrationGateway.broadcastOrderStatusChanged(payload);

      // 根据订单状态执行特定逻辑
      await this.processOrderStatusChange(payload);

      // 记录事件处理成功
      this.recordEventSuccess(eventType, startTime);

      // 更新事件状态为成功
      if (eventLog) {
        try {
          await this.eventPersistenceService.updateEventStatus(
            eventLog.id,
            EventProcessingStatus.COMPLETED,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update event status: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error handling order status change for order ${payload.orderId}: ${error.message}`,
        error.stack,
      );

      // 更新事件状态为失败
      if (eventLog) {
        try {
          await this.eventPersistenceService.updateEventStatus(
            eventLog.id,
            EventProcessingStatus.FAILED,
            error.message,
          );
        } catch (updateError) {
          this.logger.error(
            `Failed to update event status: ${updateError.message}`,
            updateError.stack,
          );
        }
      }

      // 记录事件处理失败
      this.recordEventFailure(eventType, startTime);

      // 发布错误事件
      this.emitErrorEvent(
        "ORDER_STATUS_HANDLING_FAILED",
        `Failed to process order status change: ${error.message}`,
        {
          orderId: payload.orderId,
          status: payload.newStatus,
        },
      );
    }
  }

  /**
   * 处理订单状态变更的特定业务逻辑
   *
   * @param payload 订单状态变更事件数据
   */
  private async processOrderStatusChange(payload: OrderStatusChangedEvent) {
    const { orderId, newStatus, oldStatus } = payload;

    try {
      switch (newStatus) {
        case OrderStatus.PROCESSING:
          // 订单开始处理，可能需要通知药房或医生
          if (payload.clinicId) {
            this.orchestrationGateway.sendToClinic(
              payload.clinicId,
              ORCHESTRATION_EVENTS.ORDER_PROCESSING,
              {
                orderId,
                timestamp: new Date().toISOString(),
                message: "Order is now being processed",
              },
            );
          }
          break;

        case OrderStatus.READY_FOR_PICKUP:
          // 订单准备好取货，通知患者
          if (payload.userId) {
            this.orchestrationGateway.sendToUser(
              payload.userId,
              ORCHESTRATION_EVENTS.ORDER_READY,
              {
                orderId,
                timestamp: new Date().toISOString(),
                message: "Your order is ready for pickup",
              },
            );
          }
          break;

        case OrderStatus.COMPLETED:
          // 订单完成，可能需要触发后续流程（如评价提醒）
          this.logger.log(`Order ${orderId} completed successfully`);
          break;

        case OrderStatus.CANCELLED:
          // 订单取消，可能需要触发退款流程
          this.logger.log(
            `Order ${orderId} was cancelled, may need refund processing`,
          );

          // 如果之前已支付，触发退款流程
          if (
            oldStatus === OrderStatus.PAID ||
            oldStatus === OrderStatus.PROCESSING
          ) {
            this.eventEmitter.emit(ORCHESTRATION_EVENTS.REFUND_REQUIRED, {
              orderId,
              timestamp: new Date().toISOString(),
              reason: payload.metadata?.cancellationReason || "Order cancelled",
            });
          }
          break;

        default:
          this.logger.log(`No special handling for order status: ${newStatus}`);
      }
    } catch (error) {
      this.logger.error(
        `Error in processOrderStatusChange for order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 触发补偿机制
   * 当业务流程出现异常时，尝试恢复或回滚操作
   *
   * @param orderId 订单ID
   * @param reason 补偿原因
   * @param errorMessage 错误信息
   */
  private async triggerCompensation(
    orderId: string,
    reason: string,
    errorMessage: string,
  ) {
    try {
      this.logger.log(
        `Triggering compensation for order ${orderId}: ${reason}`,
      );

      // 记录补偿触发
      this.totalCompensationsTriggered++;
      const currentCount = this.compensationsByReason.get(reason) || 0;
      this.compensationsByReason.set(reason, currentCount + 1);

      // 创建补偿事件
      const compensationEvent: OrderCompensationEvent = {
        orderId,
        reason,
        errorMessage,
        timestamp: new Date().toISOString(),
        originalEvent: null,
        error: {
          message: errorMessage,
          code: "COMPENSATION_REQUIRED",
        },
      };

      // 持久化补偿事件
      try {
        await this.eventPersistenceService.persistEvent({
          eventType: ORCHESTRATION_EVENTS.ORDER_COMPENSATION,
          eventId: orderId,
          payload: compensationEvent,
          metadata: {
            orderId,
            reason,
            errorMessage,
            timestamp: compensationEvent.timestamp,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to persist compensation event: ${error.message}`,
          error.stack,
        );
      }

      // 发布补偿事件
      this.eventEmitter.emit(
        ORCHESTRATION_EVENTS.ORDER_COMPENSATION,
        compensationEvent,
      );

      // 广播补偿事件到客户端
      this.orchestrationGateway.broadcastOrderCompensation(compensationEvent);
    } catch (error) {
      this.logger.error(
        `Failed to trigger compensation for order ${orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 发布错误事件
   *
   * @param code 错误代码
   * @param message 错误信息
   * @param metadata 错误元数据
   */
  private async emitErrorEvent(
    code: string,
    message: string,
    metadata: Record<string, any> = {},
  ) {
    try {
      // 记录错误
      this.errorCount++;
      this.lastErrorTime = Date.now();

      const errorEvent: ErrorEvent = {
        code,
        message,
        timestamp: new Date().toISOString(),
        ...metadata,
      };

      // 持久化错误事件
      try {
        await this.eventPersistenceService.persistEvent({
          eventType: ORCHESTRATION_EVENTS.ERROR,
          eventId: code,
          payload: errorEvent,
          metadata: {
            code,
            message,
            timestamp: errorEvent.timestamp,
            ...metadata,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to persist error event: ${error.message}`,
          error.stack,
        );
      }

      // 发布错误事件
      this.eventEmitter.emit(ORCHESTRATION_EVENTS.ERROR, errorEvent);
    } catch (error) {
      this.logger.error(
        `Failed to emit error event: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 获取服务健康状态
   *
   * @returns 服务是否健康
   */
  isHealthy(): boolean {
    return this.isInitialized && this.orchestrationGateway.isHealthy();
  }

  /**
   * 获取服务监控指标
   *
   * @returns 服务监控指标
   */
  getMetrics(): {
    service: string;
    status: string;
    timestamp: string;
    websocketMetrics: {
      activeConnections: number;
      totalConnectionAttempts: number;
      totalEvents: number;
      errorRate: number;
      timestamp: string;
    };
  } {
    return {
      service: "orchestration",
      status: this.isHealthy() ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      websocketMetrics: this.orchestrationGateway.getMetrics(),
    };
  }

  /**
   * 获取增强的服务监控指标
   *
   * @returns 增强的服务监控指标
   */
  getEnhancedMetrics(): ServiceMetrics {
    const uptime = Date.now() - this.serviceStartTime;
    const totalEvents = this.eventSuccessCount + this.eventFailureCount;

    // 计算处理时间统计
    const sortedProcessingTimes = [...this.eventProcessingTimes].sort(
      (a, b) => a - b,
    );
    const averageProcessingTime =
      this.eventProcessingTimes.length > 0
        ? this.eventProcessingTimes.reduce((sum, time) => sum + time, 0) /
          this.eventProcessingTimes.length
        : 0;

    const p50Index = Math.floor(sortedProcessingTimes.length * 0.5);
    const p95Index = Math.floor(sortedProcessingTimes.length * 0.95);
    const p99Index = Math.floor(sortedProcessingTimes.length * 0.99);

    // 计算最快和最慢的事件类型
    let slowestEventType = "";
    let fastestEventType = "";
    let slowestAverage = 0;
    let fastestAverage = Infinity;

    for (const [eventType, times] of this.eventTypeProcessingTimes.entries()) {
      if (times.length > 0) {
        const average =
          times.reduce((sum, time) => sum + time, 0) / times.length;
        if (average > slowestAverage) {
          slowestAverage = average;
          slowestEventType = eventType;
        }
        if (average < fastestAverage) {
          fastestAverage = average;
          fastestEventType = eventType;
        }
      }
    }

    return {
      eventProcessing: {
        totalEventsProcessed: totalEvents,
        eventProcessingTimes: [...this.eventProcessingTimes],
        averageProcessingTime,
        successRate:
          totalEvents > 0 ? (this.eventSuccessCount / totalEvents) * 100 : 0,
        failureRate:
          totalEvents > 0 ? (this.eventFailureCount / totalEvents) * 100 : 0,
      },
      eventTypeDistribution: Object.fromEntries(this.eventTypeDistribution),
      compensationMetrics: {
        totalCompensationsTriggered: this.totalCompensationsTriggered,
        compensationsByReason: Object.fromEntries(this.compensationsByReason),
      },
      performanceAnalysis: {
        p50ProcessingTime: sortedProcessingTimes[p50Index] || 0,
        p95ProcessingTime: sortedProcessingTimes[p95Index] || 0,
        p99ProcessingTime: sortedProcessingTimes[p99Index] || 0,
        slowestEventType,
        fastestEventType,
      },
      healthMetrics: {
        isHealthy: this.isHealthy(),
        uptime,
        lastErrorTime: this.lastErrorTime,
        errorCount: this.errorCount,
      },
    };
  }

  /**
   * 重置监控指标
   */
  resetMetrics(): void {
    this.totalEventsProcessed = 0;
    this.eventProcessingTimes = [];
    this.eventSuccessCount = 0;
    this.eventFailureCount = 0;
    this.eventTypeDistribution.clear();
    this.eventTypeProcessingTimes.clear();
    this.totalCompensationsTriggered = 0;
    this.compensationsByReason.clear();
    this.errorCount = 0;
    this.lastErrorTime = null;
    this.serviceStartTime = Date.now();
    this.logger.log("Service metrics reset");
  }

  /**
   * 记录事件处理开始
   */
  private recordEventStart(eventType: string): void {
    this.totalEventsProcessed++;
    const currentCount = this.eventTypeDistribution.get(eventType) || 0;
    this.eventTypeDistribution.set(eventType, currentCount + 1);
  }

  /**
   * 记录事件处理成功
   */
  private recordEventSuccess(eventType: string, startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.eventSuccessCount++;
    this.eventProcessingTimes.push(processingTime);

    // 记录事件类型的处理时间
    if (!this.eventTypeProcessingTimes.has(eventType)) {
      this.eventTypeProcessingTimes.set(eventType, []);
    }
    this.eventTypeProcessingTimes.get(eventType)!.push(processingTime);

    // 清理旧数据（保留最近1000条）
    this.cleanOldProcessingTimes();
  }

  /**
   * 记录事件处理失败
   */
  private recordEventFailure(eventType: string, startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.eventFailureCount++;
    this.eventProcessingTimes.push(processingTime);

    // 记录事件类型的处理时间
    if (!this.eventTypeProcessingTimes.has(eventType)) {
      this.eventTypeProcessingTimes.set(eventType, []);
    }
    this.eventTypeProcessingTimes.get(eventType)!.push(processingTime);

    // 清理旧数据
    this.cleanOldProcessingTimes();
  }

  /**
   * 清理旧的处理时间数据（保留最近1000条）
   */
  private cleanOldProcessingTimes(): void {
    if (this.eventProcessingTimes.length > 1000) {
      this.eventProcessingTimes = this.eventProcessingTimes.slice(-1000);
    }

    // 清理事件类型处理时间
    for (const [eventType, times] of this.eventTypeProcessingTimes.entries()) {
      if (times.length > 200) {
        this.eventTypeProcessingTimes.set(eventType, times.slice(-200));
      }
    }
  }

  /**
   * 增强的重试机制配置
   */
  private readonly enhancedRetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1秒
    maxDelay: 30000, // 30秒
    backoffMultiplier: 2,
  };

  /**
   * 死信队列 - 存储重试失败的事件
   */
  private deadLetterQueue: Array<{
    event: any;
    eventType: string;
    failureReason: string;
    timestamp: Date;
    retryCount: number;
  }> = [];

  /**
   * 告警配置
   */
  private readonly alertConfig = {
    errorRateThreshold: 10, // 10%
    deadLetterQueueSizeThreshold: 100,
    consecutiveFailuresThreshold: 5,
  };

  private consecutiveFailures = 0;

  /**
   * 错误分类枚举
   */
  private readonly ErrorCategories = {
    NETWORK_ERROR: "NETWORK_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    BUSINESS_LOGIC_ERROR: "BUSINESS_LOGIC_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    TIMEOUT_ERROR: "TIMEOUT_ERROR",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
  } as const;

  /**
   * 指数退避重试机制
   */
  async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    context: string,
    retryCount = 0,
  ): Promise<T> {
    try {
      const result = await operation();
      // 重置连续失败计数
      this.consecutiveFailures = 0;
      return result;
    } catch (error) {
      this.consecutiveFailures++;
      const errorCategory = this.categorizeError(error);

      // 检查是否应该重试
      if (!this.shouldRetry(error, retryCount)) {
        // 添加到死信队列
        this.addToDeadLetterQueue({
          event: context,
          eventType: "RETRY_FAILED",
          failureReason: error.message,
          timestamp: new Date(),
          retryCount,
        });

        // 触发告警
        this.checkAndTriggerAlerts();

        throw error;
      }

      // 计算延迟时间（指数退避）
      const delay = Math.min(
        this.enhancedRetryConfig.baseDelay *
          Math.pow(this.enhancedRetryConfig.backoffMultiplier, retryCount),
        this.enhancedRetryConfig.maxDelay,
      );

      this.logger.warn(
        `Retrying ${context} (attempt ${retryCount + 1}/${this.enhancedRetryConfig.maxRetries}) after ${delay}ms. Error: ${error.message}`,
      );

      // 等待指定时间
      await new Promise((resolve) => setTimeout(resolve, delay));

      // 递归重试
      return this.retryWithExponentialBackoff(
        operation,
        context,
        retryCount + 1,
      );
    }
  }

  /**
   * 错误分类
   */
  private categorizeError(error: any): string {
    if (error.code) {
      // 数据库错误
      if (error.code.startsWith("P")) {
        return this.ErrorCategories.DATABASE_ERROR;
      }
      // HTTP错误
      if (error.code >= 400 && error.code < 500) {
        return this.ErrorCategories.VALIDATION_ERROR;
      }
      if (error.code >= 500) {
        return this.ErrorCategories.EXTERNAL_SERVICE_ERROR;
      }
    }

    // 网络错误
    if (
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ENOTFOUND")
    ) {
      return this.ErrorCategories.NETWORK_ERROR;
    }

    // 超时错误
    if (error.message?.includes("timeout")) {
      return this.ErrorCategories.TIMEOUT_ERROR;
    }

    // 业务逻辑错误
    if (error.name === "BusinessLogicError") {
      return this.ErrorCategories.BUSINESS_LOGIC_ERROR;
    }

    return this.ErrorCategories.UNKNOWN_ERROR;
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any, retryCount: number): boolean {
    // 已达到最大重试次数
    if (retryCount >= this.enhancedRetryConfig.maxRetries) {
      return false;
    }

    const errorCategory = this.categorizeError(error);

    // 某些错误类型不应该重试
    const nonRetryableErrors = [
      this.ErrorCategories.VALIDATION_ERROR,
      this.ErrorCategories.BUSINESS_LOGIC_ERROR,
    ] as const;

    return !(nonRetryableErrors as readonly string[]).includes(errorCategory);
  }

  /**
   * 添加到死信队列
   */
  private addToDeadLetterQueue(item: any): void {
    this.deadLetterQueue.push(item);

    // 限制死信队列大小
    if (this.deadLetterQueue.length > 1000) {
      this.deadLetterQueue.shift(); // 移除最旧的项目
    }

    this.logger.error(
      `Added item to dead letter queue: ${JSON.stringify(item)}`,
    );
  }

  /**
   * 检查并触发告警
   */
  private checkAndTriggerAlerts(): void {
    const metrics = this.getEnhancedMetrics();
    const errorRate = metrics.eventProcessing.failureRate;

    // 错误率告警
    if (errorRate > this.alertConfig.errorRateThreshold) {
      this.triggerAlert(
        "HIGH_ERROR_RATE",
        `Error rate ${errorRate}% exceeds threshold ${this.alertConfig.errorRateThreshold}%`,
      );
    }

    // 死信队列大小告警
    if (
      this.deadLetterQueue.length >
      this.alertConfig.deadLetterQueueSizeThreshold
    ) {
      this.triggerAlert(
        "DEAD_LETTER_QUEUE_FULL",
        `Dead letter queue size ${this.deadLetterQueue.length} exceeds threshold ${this.alertConfig.deadLetterQueueSizeThreshold}`,
      );
    }

    // 连续失败告警
    if (
      this.consecutiveFailures > this.alertConfig.consecutiveFailuresThreshold
    ) {
      this.triggerAlert(
        "CONSECUTIVE_FAILURES",
        `${this.consecutiveFailures} consecutive failures exceed threshold ${this.alertConfig.consecutiveFailuresThreshold}`,
      );
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(alertType: string, message: string): void {
    this.logger.error(`🚨 ALERT [${alertType}]: ${message}`);

    // 这里可以集成外部告警系统
    // 例如：发送邮件、Slack通知、PagerDuty等

    // 发送告警事件
    this.eventEmitter.emit("orchestration.alert", {
      type: alertType,
      message,
      timestamp: new Date().toISOString(),
      severity: this.getAlertSeverity(alertType),
    });
  }

  /**
   * 获取告警严重级别
   */
  private getAlertSeverity(
    alertType: string,
  ): "low" | "medium" | "high" | "critical" {
    switch (alertType) {
      case "HIGH_ERROR_RATE":
        return "high";
      case "DEAD_LETTER_QUEUE_FULL":
        return "medium";
      case "CONSECUTIVE_FAILURES":
        return "critical";
      default:
        return "low";
    }
  }

  /**
   * 获取死信队列状态
   */
  getDeadLetterQueueStatus() {
    return {
      size: this.deadLetterQueue.length,
      items: this.deadLetterQueue.slice(-10), // 返回最近10个项目
      oldestItem: this.deadLetterQueue[0],
      newestItem: this.deadLetterQueue[this.deadLetterQueue.length - 1],
    };
  }

  /**
   * 清理死信队列
   */
  clearDeadLetterQueue(): void {
    const clearedCount = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.logger.log(`Cleared ${clearedCount} items from dead letter queue`);
  }

  /**
   * 重新处理死信队列中的事件
   */
  async reprocessDeadLetterQueue(): Promise<{
    processed: number;
    failed: number;
  }> {
    const items = [...this.deadLetterQueue];
    this.clearDeadLetterQueue();

    let processed = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // 这里可以根据事件类型重新处理
        this.logger.log(`Reprocessing dead letter item: ${item.eventType}`);
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to reprocess dead letter item: ${error.message}`,
        );
        this.addToDeadLetterQueue(item);
        failed++;
      }
    }

    return { processed, failed };
  }
}
