import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ClinicAccountService } from "../../clinic-account/services/clinic-account.service";
import { PaymentService } from "./payment.service";
import { WebhookEventData } from "../interfaces/payment-engine.interface";
import {
  WebhookSignatureException,
  WebhookEventProcessingException,
} from "../exceptions/payment.exceptions";

describe("PaymentService - 内存幂等性机制", () => {
  let service: PaymentService;
  let eventEmitter: EventEmitter2;
  let mockPrismaService: Partial<PrismaService>;
  let mockClinicAccountService: Partial<ClinicAccountService>;

  const mockStripeConfig = {
    secretKey: "sk_test_mock_key",
    apiVersion: "2023-10-16",
    webhookSecret: "whsec_test_secret",
  };

  const mockPaymentConfig = {
    minPaymentAmount: 100,
    maxPaymentAmount: 100000000,
  };

  beforeEach(async () => {
    // Mock services
    mockPrismaService = {};
    mockClinicAccountService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ClinicAccountService,
          useValue: mockClinicAccountService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: "STRIPE_CONFIG",
          useValue: mockStripeConfig,
        },
        {
          provide: "PAYMENT_CONFIG",
          useValue: mockPaymentConfig,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Mock Stripe webhook signature verification
    jest.spyOn(service, "verifyWebhookSignature").mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("内存幂等性机制", () => {
    const mockWebhookEvent: WebhookEventData = {
      id: "evt_test_webhook_123",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_123",
          amount: 2000,
          currency: "usd",
          metadata: {
            orderId: "order_123",
            clinicId: "clinic_456",
          },
        },
      },
      created: Date.now() / 1000,
      rawPayload: '{"test": "payload"}',
    };

    it("应该在首次处理时成功处理Webhook事件", async () => {
      await service.handleWebhookEvent(mockWebhookEvent, "test_signature");

      expect(eventEmitter.emit).toHaveBeenCalledWith("payment.succeeded", {
        orderId: "order_123",
        paymentIntentId: "pi_test_123",
        amount: 2000,
        currency: "usd",
        clinicId: "clinic_456",
      });
    });

    it("应该跳过重复的Webhook事件（内存幂等性）", async () => {
      // 第一次处理
      await service.handleWebhookEvent(mockWebhookEvent, "test_signature");

      // 重置Mock
      jest.clearAllMocks();

      // 第二次处理相同事件
      await service.handleWebhookEvent(mockWebhookEvent, "test_signature");

      // 应该跳过处理，不触发事件
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("应该处理不同的Webhook事件", async () => {
      const event1 = { ...mockWebhookEvent, id: "evt_test_1" };
      const event2 = { ...mockWebhookEvent, id: "evt_test_2" };

      await service.handleWebhookEvent(event1, "test_signature");
      await service.handleWebhookEvent(event2, "test_signature");

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });

    it("应该在签名验证失败时抛出异常", async () => {
      // Mock签名验证失败
      jest.spyOn(service, "verifyWebhookSignature").mockReturnValue(false);

      await expect(
        service.handleWebhookEvent(mockWebhookEvent, "invalid_signature"),
      ).rejects.toThrow(WebhookSignatureException);
    });

    it("应该处理支付失败事件", async () => {
      const failedEvent: WebhookEventData = {
        ...mockWebhookEvent,
        id: "evt_test_failed",
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test_failed",
            metadata: {
              orderId: "order_456",
              clinicId: "clinic_789",
            },
            last_payment_error: {
              message: "Card declined",
            },
          },
        },
      };

      await service.handleWebhookEvent(failedEvent, "test_signature");

      expect(eventEmitter.emit).toHaveBeenCalledWith("payment.failed", {
        orderId: "order_456",
        paymentIntentId: "pi_test_failed",
        failureReason: "Card declined",
        clinicId: "clinic_789",
      });
    });

    it("应该处理支付取消事件", async () => {
      const canceledEvent: WebhookEventData = {
        ...mockWebhookEvent,
        id: "evt_test_canceled",
        type: "payment_intent.canceled",
        data: {
          object: {
            id: "pi_test_canceled",
            metadata: {
              orderId: "order_789",
              clinicId: "clinic_123",
            },
          },
        },
      };

      await service.handleWebhookEvent(canceledEvent, "test_signature");

      expect(eventEmitter.emit).toHaveBeenCalledWith("payment.canceled", {
        orderId: "order_789",
        paymentIntentId: "pi_test_canceled",
        clinicId: "clinic_123",
      });
    });

    it("应该处理争议事件", async () => {
      const disputeEvent: WebhookEventData = {
        ...mockWebhookEvent,
        id: "evt_test_dispute",
        type: "charge.dispute.created",
        data: {
          object: {
            id: "dp_test_123",
            charge: "ch_test_456",
            amount: 2000,
            reason: "fraudulent",
            status: "warning_needs_response",
          },
        },
      };

      await service.handleWebhookEvent(disputeEvent, "test_signature");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "payment.dispute.created",
        {
          disputeId: "dp_test_123",
          chargeId: "ch_test_456",
          amount: 2000,
          reason: "fraudulent",
          status: "warning_needs_response",
        },
      );
    });

    it("应该忽略未处理的事件类型", async () => {
      const unknownEvent: WebhookEventData = {
        ...mockWebhookEvent,
        id: "evt_test_unknown",
        type: "customer.created",
      };

      await service.handleWebhookEvent(unknownEvent, "test_signature");

      // 不应该触发任何事件
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("应该处理缺少orderId的事件", async () => {
      const eventWithoutOrderId: WebhookEventData = {
        ...mockWebhookEvent,
        id: "evt_test_no_order_id",
        data: {
          object: {
            id: "pi_test_no_order_id",
            amount: 2000,
            currency: "usd",
            metadata: {}, // 没有orderId
          },
        },
      };

      await service.handleWebhookEvent(eventWithoutOrderId, "test_signature");

      // 应该记录警告但不触发事件
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe("资源清理", () => {
    it("应该在模块销毁时清理定时器", () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe("事件存储清理", () => {
    it("应该清理过期的事件记录", async () => {
      const mockWebhookEvent: WebhookEventData = {
        id: "evt_test_cleanup_123",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_cleanup_123",
            amount: 2000,
            currency: "usd",
            metadata: {
              orderId: "order_cleanup_123",
              clinicId: "clinic_cleanup_456",
            },
          },
        },
        created: Date.now() / 1000,
        rawPayload: '{"test": "cleanup_payload"}',
      };

      // 先处理一个事件
      await service.handleWebhookEvent(mockWebhookEvent, "test_signature");

      // 模拟时间过去25小时以上 - 需要Mock Date构造函数
      const originalDate = global.Date;
      const mockDate = new Date();
      const futureTime = new Date(mockDate.getTime() + 25 * 60 * 60 * 1000); // 25小时后

      // Mock Date构造函数返回未来时间
      global.Date = jest.fn(() => futureTime) as any;
      global.Date.now = jest.fn(() => futureTime.getTime());

      // 触发清理（通过私有方法访问测试）
      (service as any).cleanupExpiredEvents();

      // 恢复原始Date
      global.Date = originalDate;

      // 再次处理相同事件应该重新处理（因为已被清理）
      jest.clearAllMocks();
      await service.handleWebhookEvent(mockWebhookEvent, "test_signature");

      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });
});
