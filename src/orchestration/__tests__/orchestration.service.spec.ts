import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrchestrationService } from "../services/orchestration.service";
import { OrchestrationGateway } from "../gateways/orchestration.gateway";
import { OrderService } from "../../orders/services/order.service";
import { PaymentService } from "../../payment/services/payment.service";
import { EventPersistenceService } from "../services/event-persistence.service";
import {
  PaymentSucceededEvent,
  PaymentFailedEvent,
} from "../../common/events/types";

describe("OrchestrationService", () => {
  let service: OrchestrationService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let gateway: OrchestrationGateway;
  let eventEmitter: EventEmitter2;

  // 模拟数据
  const mockOrder = {
    id: "order-123",
    status: "DRAFT",
    totalAmount: 100,
    version: 1,
  };

  // 模拟支付成功事件
  const mockPaymentSucceededEvent: PaymentSucceededEvent = {
    orderId: "order-123",
    paymentId: "pi_123456",
    amount: 100,
    currency: "NZD",
    paymentMethod: "card",
    clinicId: "clinic-123",
    timestamp: new Date().toISOString(),
  };

  // 模拟支付失败事件
  const mockPaymentFailedEvent: PaymentFailedEvent = {
    orderId: "order-123",
    paymentId: "pi_123456",
    reason: "insufficient_funds",
    errorCode: "card_declined",
    clinicId: "clinic-123",
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    // 创建测试模块
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        {
          provide: OrderService,
          useValue: {
            updateOrderStatus: jest
              .fn()
              .mockImplementation((orderId, updateData) => {
                // 模拟成功更新订单状态
                return Promise.resolve({
                  ...mockOrder,
                  status: updateData.status,
                  metadata: updateData.metadata,
                });
              }),
            getOrderById: jest.fn().mockResolvedValue(mockOrder),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            getPaymentIntent: jest.fn(),
          },
        },
        {
          provide: OrchestrationGateway,
          useValue: {
            broadcastPaymentSucceeded: jest.fn(),
            broadcastPaymentFailed: jest.fn(),
            broadcastOrderStatusChanged: jest.fn(),
            broadcastOrderCompensation: jest.fn(),
            sendToUser: jest.fn(),
            sendToClinic: jest.fn(),
            isHealthy: jest.fn().mockReturnValue(true),
            getConnectionCount: jest.fn().mockReturnValue(2),
            getMetrics: jest.fn().mockReturnValue({
              activeConnections: 2,
              totalConnectionAttempts: 5,
              totalEvents: 10,
              errorRate: 0,
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            removeListener: jest.fn(),
            removeAllListeners: jest.fn(),
            listenerCount: jest.fn().mockReturnValue(2),
          },
        },
        {
          provide: EventPersistenceService,
          useValue: {
            persistEvent: jest.fn(),
            updateEventStatus: jest.fn(),
            getEvents: jest.fn(),
            getEventStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
    orderService = module.get<OrderService>(OrderService);
    paymentService = module.get<PaymentService>(PaymentService);
    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // 模拟服务已初始化
    (service as any).isInitialized = true;

    // 清除所有模拟函数的调用历史
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handlePaymentSucceeded", () => {
    it("should update order status to PAID when payment succeeds", async () => {
      // 调用方法
      await service.handlePaymentSucceeded(mockPaymentSucceededEvent);

      // 验证订单状态更新
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
        mockPaymentSucceededEvent.orderId,
        expect.objectContaining({
          status: "PAID",
          metadata: expect.objectContaining({
            paymentId: mockPaymentSucceededEvent.paymentId,
          }),
        }),
      );

      // 验证WebSocket事件广播
      expect(gateway.broadcastPaymentSucceeded).toHaveBeenCalledWith(
        mockPaymentSucceededEvent,
      );
    });

    it("should handle errors during payment success processing", async () => {
      // 模拟订单服务抛出异常
      (orderService.updateOrderStatus as jest.Mock).mockRejectedValueOnce(
        new Error("Order update failed"),
      );

      // 调用方法并期待抛出异常
      await expect(
        service.handlePaymentSucceeded(mockPaymentSucceededEvent),
      ).rejects.toThrow("Order update failed");

      // 验证尝试更新订单状态
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
        mockPaymentSucceededEvent.orderId,
        expect.any(Object),
      );

      // 验证发送补偿事件
      expect(gateway.broadcastOrderCompensation).toHaveBeenCalled();
    });

    it("should process payment success event multiple times (no built-in idempotency)", async () => {
      // 首次调用
      await service.handlePaymentSucceeded(mockPaymentSucceededEvent);

      // 清除模拟调用历史
      jest.clearAllMocks();

      // 再次调用相同事件
      await service.handlePaymentSucceeded(mockPaymentSucceededEvent);

      // 验证第二次也会调用订单状态更新（因为没有内置幂等性）
      expect(orderService.updateOrderStatus).toHaveBeenCalled();
      expect(gateway.broadcastPaymentSucceeded).toHaveBeenCalled();
    });
  });

  describe("handlePaymentFailed", () => {
    it("should update order status to PAYMENT_FAILED when payment fails", async () => {
      // 调用方法
      await service.handlePaymentFailed(mockPaymentFailedEvent);

      // 验证订单状态更新
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
        mockPaymentFailedEvent.orderId,
        expect.objectContaining({
          status: "PAYMENT_FAILED",
          metadata: expect.objectContaining({
            paymentId: mockPaymentFailedEvent.paymentId,
            failureReason: mockPaymentFailedEvent.reason,
          }),
        }),
      );

      // 验证WebSocket事件广播
      expect(gateway.broadcastPaymentFailed).toHaveBeenCalledWith(
        mockPaymentFailedEvent,
      );
    });

    it("should handle errors during payment failure processing", async () => {
      // 模拟订单服务抛出异常
      (orderService.updateOrderStatus as jest.Mock).mockRejectedValueOnce(
        new Error("Order update failed"),
      );

      // 调用方法并期待抛出异常
      await expect(
        service.handlePaymentFailed(mockPaymentFailedEvent),
      ).rejects.toThrow("Order update failed");

      // 验证尝试更新订单状态
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
        mockPaymentFailedEvent.orderId,
        expect.any(Object),
      );
    });
  });

  describe("getMetrics", () => {
    it("should return service metrics", () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty("service");
      expect(metrics).toHaveProperty("status");
      expect(metrics).toHaveProperty("timestamp");
      expect(metrics).toHaveProperty("websocketMetrics");
      expect(metrics.service).toBe("orchestration");
      expect(metrics.status).toBe("healthy");
    });
  });
});
