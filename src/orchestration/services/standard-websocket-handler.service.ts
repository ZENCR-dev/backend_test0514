import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { OrchestrationGateway } from "../gateways/orchestration.gateway";
import {
  StandardWebSocketEvent,
  StandardWebSocketEventTypes,
  WebSocketRoomTypes,
} from "../../common/events/standard-websocket-events.dto";

/**
 * 标准化WebSocket事件处理器
 *
 * 基于Phase 1标准化原则，处理所有标准化WebSocket事件
 * 与现有OrchestrationGateway集成，提供统一的事件分发机制
 */
@Injectable()
export class StandardWebSocketHandlerService {
  private readonly logger = new Logger(StandardWebSocketHandlerService.name);

  constructor(private readonly orchestrationGateway: OrchestrationGateway) {}

  /**
   * 处理所有标准化WebSocket事件
   */
  @OnEvent("websocket.event")
  async handleStandardWebSocketEvent(event: StandardWebSocketEvent) {
    try {
      this.logger.debug(
        `Handling WebSocket event: ${event.type} for user ${event.userId} (${event.eventId})`,
      );

      // 根据事件类型选择处理策略
      switch (event.type) {
        case StandardWebSocketEventTypes.ACCOUNT_BALANCE_UPDATED:
          await this.handleAccountBalanceUpdated(event);
          break;

        case StandardWebSocketEventTypes.PAYMENT_STATUS_UPDATED:
          await this.handlePaymentStatusUpdated(event);
          break;

        case StandardWebSocketEventTypes.PRESCRIPTION_STATUS_CHANGED:
          await this.handlePrescriptionStatusChanged(event);
          break;

        case StandardWebSocketEventTypes.SYSTEM_MAINTENANCE_SCHEDULED:
          await this.handleSystemMaintenanceScheduled(event);
          break;

        case StandardWebSocketEventTypes.USER_SESSION_EXPIRED:
          await this.handleUserSessionExpired(event);
          break;

        default:
          await this.handleGenericEvent(event);
      }

      this.logger.debug(
        `Successfully handled WebSocket event: ${event.type} (${event.eventId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle WebSocket event: ${event.type} (${event.eventId})`,
        error,
      );

      // 发送错误事件给用户
      await this.sendErrorEvent(event.userId, {
        originalEventId: event.eventId,
        originalEventType: event.type,
        error: error.message,
      });
    }
  }

  /**
   * 处理账户余额更新事件
   */
  private async handleAccountBalanceUpdated(event: StandardWebSocketEvent) {
    const success = this.orchestrationGateway.sendToUser(
      event.userId,
      "account.balance.updated",
      {
        ...event.data,
        meta: event.meta,
        timestamp: event.timestamp,
        eventId: event.eventId,
      },
    );

    if (!success) {
      this.logger.warn(
        `Failed to deliver balance update to user ${event.userId}`,
      );
    }

    // 如果是高优先级事件，也发送到用户的所有设备
    if (
      event.meta?.priority === "high" ||
      event.meta?.priority === "critical"
    ) {
      // 这里可以扩展到发送推送通知等
      this.logger.debug(
        `High priority balance update for user ${event.userId}`,
      );
    }
  }

  /**
   * 处理支付状态更新事件
   */
  private async handlePaymentStatusUpdated(event: StandardWebSocketEvent) {
    const success = this.orchestrationGateway.sendToUser(
      event.userId,
      "payment.status.updated",
      {
        ...event.data,
        meta: event.meta,
        timestamp: event.timestamp,
        eventId: event.eventId,
      },
    );

    if (!success) {
      this.logger.warn(
        `Failed to deliver payment update to user ${event.userId}`,
      );
    }

    // 支付失败时发送额外通知
    if (event.data.newStatus === "FAILED") {
      this.orchestrationGateway.sendToUser(
        event.userId,
        "notification.payment.failed",
        {
          paymentId: event.data.paymentId,
          amount: event.data.amount,
          currency: event.data.currency,
          reason: event.data.failureReason,
          timestamp: event.timestamp,
        },
      );
    }
  }

  /**
   * 处理处方状态变化事件
   */
  private async handlePrescriptionStatusChanged(event: StandardWebSocketEvent) {
    const success = this.orchestrationGateway.sendToUser(
      event.userId,
      "prescription.status.changed",
      {
        ...event.data,
        meta: event.meta,
        timestamp: event.timestamp,
        eventId: event.eventId,
      },
    );

    if (!success) {
      this.logger.warn(
        `Failed to deliver prescription update to user ${event.userId}`,
      );
    }

    // 处方完成时发送特殊通知
    if (event.data.newStatus === "COMPLETED") {
      this.orchestrationGateway.sendToUser(
        event.userId,
        "notification.prescription.completed",
        {
          prescriptionId: event.data.prescriptionId,
          totalAmount: event.data.totalAmount,
          medicineCount: event.data.medicineCount,
          timestamp: event.timestamp,
        },
      );
    }
  }

  /**
   * 处理系统维护通知事件
   */
  private async handleSystemMaintenanceScheduled(
    event: StandardWebSocketEvent,
  ) {
    // 系统维护通知发送给所有连接的用户
    this.orchestrationGateway.broadcastEvent("system.maintenance.scheduled", {
      ...event.data,
      meta: event.meta,
      timestamp: event.timestamp,
      eventId: event.eventId,
    });

    // 如果是关键维护，额外发送紧急通知
    if (event.data.impactLevel === "CRITICAL") {
      this.orchestrationGateway.broadcastEvent("notification.system.critical", {
        title: event.data.title,
        description: event.data.description,
        startTime: event.data.startTime,
        timestamp: event.timestamp,
      });
    }
  }

  /**
   * 处理用户会话过期事件
   */
  private async handleUserSessionExpired(event: StandardWebSocketEvent) {
    const success = this.orchestrationGateway.sendToUser(
      event.userId,
      "user.session.expired",
      {
        ...event.data,
        meta: event.meta,
        timestamp: event.timestamp,
        eventId: event.eventId,
      },
    );

    if (!success) {
      this.logger.warn(
        `Failed to deliver session expiry to user ${event.userId}`,
      );
    }

    // 如果需要重新认证，发送额外的认证提示
    if (event.data.requireReauth) {
      this.orchestrationGateway.sendToUser(
        event.userId,
        "notification.reauth.required",
        {
          sessionId: event.data.sessionId,
          gracePeriodSeconds: event.data.gracePeriodSeconds,
          timestamp: event.timestamp,
        },
      );
    }
  }

  /**
   * 处理通用事件
   */
  private async handleGenericEvent(event: StandardWebSocketEvent) {
    const success = this.orchestrationGateway.sendToUser(
      event.userId,
      event.type,
      {
        ...event.data,
        meta: event.meta,
        timestamp: event.timestamp,
        eventId: event.eventId,
      },
    );

    if (!success) {
      this.logger.warn(
        `Failed to deliver generic event ${event.type} to user ${event.userId}`,
      );
    }
  }

  /**
   * 发送错误事件
   */
  private async sendErrorEvent(userId: string, errorData: any) {
    this.orchestrationGateway.sendToUser(userId, "websocket.error", {
      ...errorData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取处理器统计信息
   */
  getHandlerStats() {
    return {
      gatewayConnections: this.orchestrationGateway.getConnectionCount(),
      gatewayHealthy: this.orchestrationGateway.isHealthy(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 发送事件到特定角色的所有用户
   */
  async broadcastToRole(role: string, event: StandardWebSocketEvent) {
    const sentCount = this.orchestrationGateway.sendToRole(role, event.type, {
      ...event.data,
      meta: event.meta,
      timestamp: event.timestamp,
      eventId: event.eventId,
    });

    this.logger.debug(
      `Broadcasted event ${event.type} to ${sentCount} users with role ${role}`,
    );

    return sentCount;
  }

  /**
   * 发送事件到房间
   */
  async sendToRoom(roomId: string, event: StandardWebSocketEvent) {
    const sentCount = this.orchestrationGateway.sendToRoom(roomId, event.type, {
      ...event.data,
      meta: event.meta,
      timestamp: event.timestamp,
      eventId: event.eventId,
    });

    this.logger.debug(
      `Sent event ${event.type} to ${sentCount} users in room ${roomId}`,
    );

    return sentCount;
  }
}
