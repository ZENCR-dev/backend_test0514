import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WebSocketEventEmitterService } from "../../common/services/websocket-event-emitter.service";
import { StandardWebSocketHandlerService } from "../services/standard-websocket-handler.service";
import { OrchestrationGateway } from "../gateways/orchestration.gateway";
import {
  StandardWebSocketEventTypes,
  EventPriority,
  EventSource,
} from "../../common/events/standard-websocket-events.dto";

/**
 * 标准化WebSocket事件集成测试
 *
 * 测试目标：
 * 1. 验证事件发射器正确生成标准格式事件
 * 2. 验证事件处理器正确处理和分发事件
 * 3. 验证与现有OrchestrationGateway的集成
 * 4. 验证事件优先级和元数据处理
 */
describe("Standard WebSocket Integration", () => {
  let module: TestingModule;
  let eventEmitter: WebSocketEventEmitterService;
  let eventHandler: StandardWebSocketHandlerService;
  let gateway: OrchestrationGateway;
  let mockEventEmitter2: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    // 创建EventEmitter2的mock
    mockEventEmitter2 = {
      emitAsync: jest.fn().mockResolvedValue(true),
      emit: jest.fn().mockReturnValue(true),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    // 创建OrchestrationGateway的mock
    const mockGateway = {
      sendToUser: jest.fn().mockReturnValue(true),
      broadcastEvent: jest.fn(),
      sendToRole: jest.fn().mockReturnValue(2),
      sendToRoom: jest.fn().mockReturnValue(3),
      getConnectionCount: jest.fn().mockReturnValue(5),
      isHealthy: jest.fn().mockReturnValue(true),
    };

    module = await Test.createTestingModule({
      providers: [
        WebSocketEventEmitterService,
        StandardWebSocketHandlerService,
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter2,
        },
        {
          provide: OrchestrationGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    eventEmitter = module.get<WebSocketEventEmitterService>(
      WebSocketEventEmitterService,
    );
    eventHandler = module.get<StandardWebSocketHandlerService>(
      StandardWebSocketHandlerService,
    );
    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
  });

  afterEach(async () => {
    await module.close();
  });

  describe("WebSocketEventEmitterService", () => {
    it("应该生成标准格式的事件", async () => {
      const userId = "prac_123";
      const eventType = StandardWebSocketEventTypes.ACCOUNT_BALANCE_UPDATED;
      const data = {
        practitionerId: userId,
        previousBalance: 1000,
        newBalance: 1500,
        changeAmount: 500,
        changeType: "RECHARGE",
        currency: "NZD",
      };

      const event = await eventEmitter.emitStandardEvent(
        eventType,
        userId,
        data,
        {
          priority: EventPriority.HIGH,
          source: EventSource.PRACTITIONER_ACCOUNT_SERVICE,
        },
      );

      // 验证事件结构
      expect(event).toHaveProperty("type", eventType);
      expect(event).toHaveProperty("data", data);
      expect(event).toHaveProperty("timestamp");
      expect(event).toHaveProperty("userId", userId);
      expect(event).toHaveProperty("eventId");
      expect(event).toHaveProperty("meta");

      // 验证元数据
      expect(event.meta).toHaveProperty("priority", EventPriority.HIGH);
      expect(event.meta).toHaveProperty(
        "source",
        EventSource.PRACTITIONER_ACCOUNT_SERVICE,
      );
      expect(event.meta).toHaveProperty("version", "1.0");
      expect(event.meta).toHaveProperty("retryCount", 0);

      // 验证事件ID格式
      expect(event.eventId).toMatch(/^evt_\d+_\d+_[a-z0-9]+$/);

      // 验证时间戳格式
      expect(event.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );

      // 验证EventEmitter2被调用
      expect(mockEventEmitter2.emitAsync).toHaveBeenCalledWith(
        "websocket.event",
        event,
      );
    });

    it("应该正确发射账户余额更新事件", async () => {
      const practitionerId = "prac_456";
      const balanceData = {
        previousBalance: 500,
        newBalance: 800,
        changeAmount: 300,
        changeType: "RECHARGE",
        currency: "NZD",
        reason: "Manual recharge",
        transactionId: "txn_123",
      };

      const event = await eventEmitter.emitAccountBalanceUpdated(
        practitionerId,
        balanceData,
      );

      expect(event.type).toBe(
        StandardWebSocketEventTypes.ACCOUNT_BALANCE_UPDATED,
      );
      expect(event.userId).toBe(practitionerId);
      expect(event.data).toEqual({
        practitionerId,
        ...balanceData,
      });
      expect(event.meta?.priority).toBe(EventPriority.HIGH);
      expect(event.meta?.source).toBe(EventSource.PRACTITIONER_ACCOUNT_SERVICE);
    });

    it("应该正确发射支付状态更新事件", async () => {
      const practitionerId = "prac_789";
      const paymentData = {
        paymentId: "pay_123",
        previousStatus: "PENDING",
        newStatus: "FAILED",
        amount: 250,
        currency: "NZD",
        paymentMethod: "STRIPE",
        failureReason: "Insufficient funds",
        paymentIntentId: "pi_123",
      };

      const event = await eventEmitter.emitPaymentStatusUpdated(
        practitionerId,
        paymentData,
      );

      expect(event.type).toBe(
        StandardWebSocketEventTypes.PAYMENT_STATUS_UPDATED,
      );
      expect(event.userId).toBe(practitionerId);
      expect(event.data).toEqual({
        practitionerId,
        ...paymentData,
      });
      // 失败状态应该是高优先级
      expect(event.meta?.priority).toBe(EventPriority.HIGH);
      expect(event.meta?.source).toBe(EventSource.PAYMENT_SERVICE);
    });

    it("应该支持批量发射事件到多个用户", async () => {
      const userIds = ["user1", "user2", "user3"];
      const eventType =
        StandardWebSocketEventTypes.SYSTEM_MAINTENANCE_SCHEDULED;
      const data = {
        title: "Scheduled Maintenance",
        description: "System will be down for maintenance",
        startTime: "2025-01-10T02:00:00Z",
        endTime: "2025-01-10T04:00:00Z",
        maintenanceType: "SCHEDULED",
        impactLevel: "MEDIUM",
        affectedServices: ["api", "websocket"],
      };

      const events = await eventEmitter.emitToMultipleUsers(
        eventType,
        userIds,
        data,
        {
          priority: EventPriority.HIGH,
          source: EventSource.SYSTEM_SERVICE,
        },
      );

      expect(events).toHaveLength(3);
      events.forEach((event, index) => {
        expect(event.type).toBe(eventType);
        expect(event.userId).toBe(userIds[index]);
        expect(event.data).toEqual(data);
        expect(event.meta?.priority).toBe(EventPriority.HIGH);
      });

      // 验证每个事件都有唯一的eventId
      const eventIds = events.map((e) => e.eventId);
      const uniqueEventIds = new Set(eventIds);
      expect(uniqueEventIds.size).toBe(3);
    });
  });

  describe("StandardWebSocketHandlerService", () => {
    it("应该正确处理账户余额更新事件", async () => {
      const event = {
        type: StandardWebSocketEventTypes.ACCOUNT_BALANCE_UPDATED,
        data: {
          practitionerId: "prac_123",
          previousBalance: 1000,
          newBalance: 1500,
          changeAmount: 500,
          changeType: "RECHARGE",
          currency: "NZD",
        },
        timestamp: "2025-01-09T10:00:00.000Z",
        userId: "prac_123",
        eventId: "evt_123",
        meta: {
          priority: EventPriority.HIGH,
          source: EventSource.PRACTITIONER_ACCOUNT_SERVICE,
        },
      };

      // 模拟事件处理
      await eventHandler.handleStandardWebSocketEvent(event);

      // 验证gateway.sendToUser被正确调用
      expect(gateway.sendToUser).toHaveBeenCalledWith(
        "prac_123",
        "account.balance.updated",
        expect.objectContaining({
          practitionerId: "prac_123",
          previousBalance: 1000,
          newBalance: 1500,
          changeAmount: 500,
          changeType: "RECHARGE",
          currency: "NZD",
          meta: event.meta,
          timestamp: event.timestamp,
          eventId: event.eventId,
        }),
      );
    });

    it("应该正确处理支付失败事件并发送额外通知", async () => {
      const event = {
        type: StandardWebSocketEventTypes.PAYMENT_STATUS_UPDATED,
        data: {
          practitionerId: "prac_456",
          paymentId: "pay_123",
          previousStatus: "PENDING",
          newStatus: "FAILED",
          amount: 250,
          currency: "NZD",
          paymentMethod: "STRIPE",
          failureReason: "Card declined",
        },
        timestamp: "2025-01-09T10:00:00.000Z",
        userId: "prac_456",
        eventId: "evt_456",
        meta: {
          priority: EventPriority.HIGH,
          source: EventSource.PAYMENT_SERVICE,
        },
      };

      await eventHandler.handleStandardWebSocketEvent(event);

      // 验证主要事件被发送
      expect(gateway.sendToUser).toHaveBeenCalledWith(
        "prac_456",
        "payment.status.updated",
        expect.any(Object),
      );

      // 验证失败通知被发送
      expect(gateway.sendToUser).toHaveBeenCalledWith(
        "prac_456",
        "notification.payment.failed",
        expect.objectContaining({
          paymentId: "pay_123",
          amount: 250,
          currency: "NZD",
          reason: "Card declined",
        }),
      );
    });

    it("应该正确处理系统维护通知事件", async () => {
      const event = {
        type: StandardWebSocketEventTypes.SYSTEM_MAINTENANCE_SCHEDULED,
        data: {
          title: "Critical System Update",
          description: "Emergency security patch",
          startTime: "2025-01-09T23:00:00Z",
          endTime: "2025-01-10T01:00:00Z",
          maintenanceType: "EMERGENCY",
          impactLevel: "CRITICAL",
          affectedServices: ["api", "websocket", "database"],
        },
        timestamp: "2025-01-09T10:00:00.000Z",
        userId: "system",
        eventId: "evt_system_123",
        meta: {
          priority: EventPriority.CRITICAL,
          source: EventSource.SYSTEM_SERVICE,
        },
      };

      await eventHandler.handleStandardWebSocketEvent(event);

      // 验证广播事件被发送
      expect(gateway.broadcastEvent).toHaveBeenCalledWith(
        "system.maintenance.scheduled",
        expect.any(Object),
      );

      // 验证关键维护的额外通知被发送
      expect(gateway.broadcastEvent).toHaveBeenCalledWith(
        "notification.system.critical",
        expect.objectContaining({
          title: "Critical System Update",
          description: "Emergency security patch",
          startTime: "2025-01-09T23:00:00Z",
        }),
      );
    });

    it("应该提供正确的统计信息", () => {
      const stats = eventHandler.getHandlerStats();

      expect(stats).toHaveProperty("gatewayConnections", 5);
      expect(stats).toHaveProperty("gatewayHealthy", true);
      expect(stats).toHaveProperty("timestamp");
      expect(stats.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it("应该支持向特定角色广播事件", async () => {
      const event = {
        type: "role.notification",
        data: { message: "Important update for practitioners" },
        timestamp: "2025-01-09T10:00:00.000Z",
        userId: "system",
        eventId: "evt_role_123",
        meta: { priority: EventPriority.NORMAL },
      };

      const sentCount = await eventHandler.broadcastToRole(
        "practitioner",
        event,
      );

      expect(sentCount).toBe(2);
      expect(gateway.sendToRole).toHaveBeenCalledWith(
        "practitioner",
        "role.notification",
        expect.any(Object),
      );
    });
  });

  describe("Integration Tests", () => {
    it("应该完整地处理端到端事件流", async () => {
      // 1. 发射事件
      const practitionerId = "prac_integration_test";
      const balanceData = {
        previousBalance: 100,
        newBalance: 600,
        changeAmount: 500,
        changeType: "RECHARGE",
        currency: "NZD",
      };

      const event = await eventEmitter.emitAccountBalanceUpdated(
        practitionerId,
        balanceData,
      );

      // 2. 验证事件格式
      expect(event).toMatchObject({
        type: StandardWebSocketEventTypes.ACCOUNT_BALANCE_UPDATED,
        userId: practitionerId,
        data: expect.objectContaining(balanceData),
      });

      // 3. 模拟事件处理
      await eventHandler.handleStandardWebSocketEvent(event);

      // 4. 验证最终结果
      expect(gateway.sendToUser).toHaveBeenCalledWith(
        practitionerId,
        "account.balance.updated",
        expect.objectContaining({
          practitionerId,
          ...balanceData,
          eventId: event.eventId,
          timestamp: event.timestamp,
        }),
      );

      // 5. 验证EventEmitter2被调用
      expect(mockEventEmitter2.emitAsync).toHaveBeenCalledWith(
        "websocket.event",
        event,
      );
    });

    it("应该正确处理事件统计", () => {
      const emitterStats = eventEmitter.getEventStats();
      const handlerStats = eventHandler.getHandlerStats();

      expect(emitterStats).toHaveProperty("totalEventsEmitted");
      expect(emitterStats).toHaveProperty("timestamp");

      expect(handlerStats).toHaveProperty("gatewayConnections");
      expect(handlerStats).toHaveProperty("gatewayHealthy");
      expect(handlerStats).toHaveProperty("timestamp");
    });
  });
});
