import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Logger } from "@nestjs/common";
import { OrchestrationService } from "../services/orchestration.service";
import { OrchestrationGateway } from "../gateways/orchestration.gateway";
import { OrderService } from "../../orders/services/order.service";
import { EventPersistenceService } from "../services/event-persistence.service";
import {
  PAYMENT_EVENTS,
  ORDER_EVENTS,
  ORCHESTRATION_EVENTS,
  PaymentSucceededEvent,
  PaymentFailedEvent,
  OrderStatusChangedEvent,
} from "../../common/events/types";
import { OrderStatus } from "@prisma/client";

// 模拟依赖
const mockEventEmitter = {
  emit: jest.fn(),
};

const mockOrderService = {
  updateOrderStatus: jest.fn(),
};

const mockOrchestrationGateway = {
  broadcastPaymentSucceeded: jest.fn(),
  broadcastPaymentFailed: jest.fn(),
  broadcastOrderStatusChanged: jest.fn(),
  broadcastOrderCompensation: jest.fn(),
  sendToUser: jest.fn(),
  sendToClinic: jest.fn(),
  isHealthy: jest.fn(),
  getMetrics: jest.fn(),
};

const mockEventPersistenceService = {
  persistEvent: jest.fn(),
  updateEventStatus: jest.fn(),
  getEventById: jest.fn(),
  queryEvents: jest.fn(),
  getEventStats: jest.fn(),
  findEventsByStatus: jest.fn(),
  findEventsByType: jest.fn(),
  findEventsByDateRange: jest.fn(),
  deleteExpiredEvents: jest.fn(),
};

describe("OrchestrationService", () => {
  let service: OrchestrationService;
  let eventEmitter: EventEmitter2;
  let orderService: OrderService;
  let gateway: OrchestrationGateway;
  let eventPersistenceService: EventPersistenceService;

  beforeEach(async () => {
    // 重置所有模拟函数
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: OrchestrationGateway,
          useValue: mockOrchestrationGateway,
        },
        {
          provide: EventPersistenceService,
          useValue: mockEventPersistenceService,
        },
      ],
    }).compile();

    // 禁用Logger输出
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});

    service = module.get<OrchestrationService>(OrchestrationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    orderService = module.get<OrderService>(OrderService);
    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
    eventPersistenceService = module.get<EventPersistenceService>(
      EventPersistenceService,
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should initialize successfully", async () => {
      // 模拟服务启动事件
      await service.onModuleInit();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.SERVICE_STARTED,
        expect.objectContaining({
          service: "orchestration",
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe("handlePaymentSucceeded", () => {
    it("should update order status and broadcast event on payment success", async () => {
      // 准备测试数据
      const paymentEvent: PaymentSucceededEvent = {
        orderId: "order-123",
        paymentId: "payment-123",
        amount: 100,
        currency: "NZD",
        paymentMethod: "credit_card",
        timestamp: new Date().toISOString(),
      };

      // 模拟订单服务返回值
      mockOrderService.updateOrderStatus.mockResolvedValue({
        id: "order-123",
        status: OrderStatus.PAID,
      });

      // 调用被测试方法
      await service.handlePaymentSucceeded(paymentEvent);

      // 验证订单状态更新调用
      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
        "order-123",
        expect.objectContaining({
          status: OrderStatus.PAID,
          metadata: expect.objectContaining({
            paymentId: "payment-123",
          }),
        }),
      );

      // 验证WebSocket广播调用
      expect(
        mockOrchestrationGateway.broadcastPaymentSucceeded,
      ).toHaveBeenCalledWith(paymentEvent);
    });

    it("should handle errors and trigger compensation", async () => {
      // 准备测试数据
      const paymentEvent: PaymentSucceededEvent = {
        orderId: "order-123",
        paymentId: "payment-123",
        amount: 100,
        currency: "NZD",
        paymentMethod: "credit_card",
        timestamp: new Date().toISOString(),
      };

      // 模拟订单服务抛出错误
      const error = new Error("Database error");
      mockOrderService.updateOrderStatus.mockRejectedValue(error);

      // 调用被测试方法并捕获预期的错误
      await expect(
        service.handlePaymentSucceeded(paymentEvent),
      ).rejects.toThrow();

      // 验证错误事件发出
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.ERROR,
        expect.objectContaining({
          code: "ORDER_UPDATE_FAILED",
        }),
      );

      // 验证补偿事件发出
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.ORDER_COMPENSATION,
        expect.objectContaining({
          orderId: "order-123",
          reason: "PAYMENT_SUCCESS_HANDLING_FAILED",
        }),
      );

      // 验证补偿事件广播
      expect(
        mockOrchestrationGateway.broadcastOrderCompensation,
      ).toHaveBeenCalled();
    });

    it("should validate input and throw error for invalid payload", async () => {
      // 准备无效的测试数据（缺少orderId）
      const invalidPaymentEvent = {
        paymentId: "payment-123",
        amount: 100,
        paymentMethod: "credit_card",
        timestamp: new Date().toISOString(),
      } as PaymentSucceededEvent;

      // 调用被测试方法并期望抛出错误
      await expect(
        service.handlePaymentSucceeded(invalidPaymentEvent),
      ).rejects.toThrow("Invalid payment success event");
    });
  });

  describe("handlePaymentFailed", () => {
    it("should update order status and broadcast event on payment failure", async () => {
      // 准备测试数据
      const paymentEvent: PaymentFailedEvent = {
        orderId: "order-123",
        paymentId: "payment-123",
        reason: "insufficient_funds",
        errorCode: "card_declined",
        timestamp: new Date().toISOString(),
      };

      // 模拟订单服务返回值
      mockOrderService.updateOrderStatus.mockResolvedValue({
        id: "order-123",
        status: OrderStatus.PAYMENT_FAILED,
      });

      // 调用被测试方法
      await service.handlePaymentFailed(paymentEvent);

      // 验证订单状态更新调用
      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
        "order-123",
        expect.objectContaining({
          status: OrderStatus.PAYMENT_FAILED,
          metadata: expect.objectContaining({
            paymentId: "payment-123",
            failureReason: "insufficient_funds",
          }),
        }),
      );

      // 验证WebSocket广播调用
      expect(
        mockOrchestrationGateway.broadcastPaymentFailed,
      ).toHaveBeenCalledWith(paymentEvent);
    });

    it("should handle errors during payment failure processing", async () => {
      // 准备测试数据
      const paymentEvent: PaymentFailedEvent = {
        orderId: "order-123",
        paymentId: "payment-123",
        reason: "insufficient_funds",
        errorCode: "card_declined",
        timestamp: new Date().toISOString(),
      };

      // 模拟订单服务抛出错误
      const error = new Error("Database error");
      mockOrderService.updateOrderStatus.mockRejectedValue(error);

      // 调用被测试方法并捕获预期的错误
      await expect(service.handlePaymentFailed(paymentEvent)).rejects.toThrow();

      // 验证错误事件发出
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.ERROR,
        expect.objectContaining({
          code: "ORDER_UPDATE_FAILED",
        }),
      );
    });
  });

  describe("handleOrderStatusChanged", () => {
    it("should broadcast order status change event", async () => {
      // 准备测试数据
      const orderEvent: OrderStatusChangedEvent = {
        orderId: "order-123",
        newStatus: OrderStatus.PROCESSING,
        oldStatus: OrderStatus.PAID,
        timestamp: new Date().toISOString(),
      };

      // 调用被测试方法
      await service.handleOrderStatusChanged(orderEvent);

      // 验证WebSocket广播调用
      expect(
        mockOrchestrationGateway.broadcastOrderStatusChanged,
      ).toHaveBeenCalledWith(orderEvent);
    });

    it("should notify clinic when order status changes to PROCESSING", async () => {
      // 准备测试数据
      const orderEvent: OrderStatusChangedEvent = {
        orderId: "order-123",
        newStatus: OrderStatus.PROCESSING,
        oldStatus: OrderStatus.PAID,
        clinicId: "clinic-123",
        timestamp: new Date().toISOString(),
      };

      // 调用被测试方法
      await service.handleOrderStatusChanged(orderEvent);

      // 验证发送到诊所的通知
      expect(mockOrchestrationGateway.sendToClinic).toHaveBeenCalledWith(
        "clinic-123",
        ORCHESTRATION_EVENTS.ORDER_PROCESSING,
        expect.objectContaining({
          orderId: "order-123",
        }),
      );
    });

    it("should notify user when order status changes to READY_FOR_PICKUP", async () => {
      // 准备测试数据
      const orderEvent: OrderStatusChangedEvent = {
        orderId: "order-123",
        newStatus: OrderStatus.READY_FOR_PICKUP,
        oldStatus: OrderStatus.PROCESSING,
        userId: "user-123",
        timestamp: new Date().toISOString(),
      };

      // 调用被测试方法
      await service.handleOrderStatusChanged(orderEvent);

      // 验证发送到用户的通知
      expect(mockOrchestrationGateway.sendToUser).toHaveBeenCalledWith(
        "user-123",
        ORCHESTRATION_EVENTS.ORDER_READY,
        expect.objectContaining({
          orderId: "order-123",
        }),
      );
    });

    it("should trigger refund when order is cancelled after payment", async () => {
      // 准备测试数据
      const orderEvent: OrderStatusChangedEvent = {
        orderId: "order-123",
        newStatus: OrderStatus.CANCELLED,
        oldStatus: OrderStatus.PAID,
        timestamp: new Date().toISOString(),
      };

      // 调用被测试方法
      await service.handleOrderStatusChanged(orderEvent);

      // 验证退款事件发出
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.REFUND_REQUIRED,
        expect.objectContaining({
          orderId: "order-123",
        }),
      );
    });

    it("should handle validation errors for invalid event data", async () => {
      // 准备无效的测试数据（缺少必要字段）
      const invalidOrderEvent = {
        timestamp: new Date().toISOString(),
      } as OrderStatusChangedEvent;

      // 调用被测试方法
      await service.handleOrderStatusChanged(invalidOrderEvent);

      // 验证错误事件发出
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.ERROR,
        expect.objectContaining({
          code: "ORDER_STATUS_HANDLING_FAILED",
        }),
      );

      // 验证没有广播状态变更
      expect(
        mockOrchestrationGateway.broadcastOrderStatusChanged,
      ).not.toHaveBeenCalled();
    });
  });

  describe("health and metrics", () => {
    it("should report healthy status when initialized", async () => {
      // 初始化服务
      await service.onModuleInit();

      // 模拟网关健康状态
      mockOrchestrationGateway.isHealthy.mockReturnValue(true);

      // 验证健康状态
      expect(service.isHealthy()).toBe(true);
    });

    it("should report unhealthy status when not initialized", () => {
      // 服务未初始化（不调用onModuleInit）

      // 验证健康状态
      expect(service.isHealthy()).toBe(false);
    });

    it("should return metrics", async () => {
      // 初始化服务
      await service.onModuleInit();

      // 模拟网关指标
      mockOrchestrationGateway.getMetrics.mockReturnValue({
        activeConnections: 5,
        totalConnectionAttempts: 10,
        totalEvents: 20,
        errorRate: 0,
      });

      // 获取指标
      const metrics = service.getMetrics();

      // 验证指标格式
      expect(metrics).toEqual({
        service: "orchestration",
        status: expect.any(String),
        timestamp: expect.any(String),
        websocketMetrics: expect.objectContaining({
          activeConnections: 5,
        }),
      });
    });
  });
});
