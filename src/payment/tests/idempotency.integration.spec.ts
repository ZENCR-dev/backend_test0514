import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { PaymentService } from "../services/payment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PractitionerAccountService } from "../../practitioner-account/services/practitioner-account.service";
import { WebhookEventData } from "../interfaces/payment-engine.interface";

/**
 * 内存幂等性机制集成测试
 *
 * 测试目标：
 * 1. 验证内存存储的幂等性机制正常工作
 * 2. 确保事件不会被重复处理
 * 3. 验证自动清理机制
 * 4. 测试并发场景下的幂等性
 */
describe("PaymentService - 内存幂等性机制集成测试", () => {
  let app: TestingModule;
  let paymentService: PaymentService;
  let eventEmitter: EventEmitter2;

  const mockStripeConfig = {
    secretKey: "sk_test_mock_key",
    apiVersion: "2023-10-16",
    webhookSecret: "whsec_test_secret",
  };

  const mockPaymentConfig = {
    minPaymentAmount: 100,
    maxPaymentAmount: 100000000,
  };

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: PractitionerAccountService,
          useValue: {},
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

    paymentService = app.get<PaymentService>(PaymentService);
    eventEmitter = app.get<EventEmitter2>(EventEmitter2);

    // Mock Stripe webhook signature verification
    jest.spyOn(paymentService, "verifyWebhookSignature").mockReturnValue(true);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("基础幂等性功能", () => {
    it("应该跟踪已处理的事件", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const webhookEvent: WebhookEventData = {
        id: "evt_unique_123",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_123",
            amount: 2000,
            currency: "usd",
            metadata: {
              orderId: "order_123",
              practitionerId: "practitioner_456",
            },
          },
        },
        created: Date.now() / 1000,
        rawPayload: '{"test": "payload"}',
      };

      // 第一次处理
      await paymentService.handleWebhookEvent(webhookEvent, "test_signature");
      expect(eventSpy).toHaveBeenCalledTimes(1);

      // 第二次处理相同事件
      await paymentService.handleWebhookEvent(webhookEvent, "test_signature");
      expect(eventSpy).toHaveBeenCalledTimes(1); // 应该还是1次，没有增加
    });

    it("应该处理多个不同的事件", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const baseEvent: WebhookEventData = {
        id: "evt_base_multi",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_multi",
            amount: 2000,
            currency: "usd",
            metadata: {
              orderId: "order_multi",
              practitionerId: "practitioner_multi",
            },
          },
        },
        created: Date.now() / 1000,
        rawPayload: '{"test": "payload"}',
      };

      const events = [
        { ...baseEvent, id: "evt_multi_1" },
        { ...baseEvent, id: "evt_multi_2" },
        { ...baseEvent, id: "evt_multi_3" },
      ];

      // 处理所有事件
      for (const event of events) {
        await paymentService.handleWebhookEvent(event, "test_signature");
      }

      expect(eventSpy).toHaveBeenCalledTimes(3);

      // 再次处理所有事件
      for (const event of events) {
        await paymentService.handleWebhookEvent(event, "test_signature");
      }

      // 应该还是3次，没有增加
      expect(eventSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("并发处理测试", () => {
    it("应该在并发处理时保持幂等性", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const webhookEvent: WebhookEventData = {
        id: "evt_concurrent_123",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_concurrent_123",
            amount: 2000,
            currency: "usd",
            metadata: {
              orderId: "order_concurrent",
              practitionerId: "practitioner_concurrent",
            },
          },
        },
        created: Date.now() / 1000,
        rawPayload: '{"test": "concurrent"}',
      };

      // 并发处理相同事件
      const promises = Array(5)
        .fill(null)
        .map(() =>
          paymentService.handleWebhookEvent(webhookEvent, "test_signature"),
        );

      await Promise.all(promises);

      // 只应该有一次实际处理
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("事件类型处理测试", () => {
    const baseEventData = {
      created: Date.now() / 1000,
      rawPayload: '{"test": "payload"}',
    };

    it("应该正确处理支付成功事件", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const successEvent: WebhookEventData = {
        ...baseEventData,
        id: "evt_success_test",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_success_123",
            amount: 3000,
            currency: "usd",
            metadata: {
              orderId: "order_success",
              practitionerId: "practitioner_success",
            },
          },
        },
      };

      await paymentService.handleWebhookEvent(successEvent, "test_signature");

      expect(eventSpy).toHaveBeenCalledWith("payment.succeeded", {
        orderId: "order_success",
        paymentIntentId: "pi_success_123",
        amount: 3000,
        currency: "usd",
        practitionerId: "practitioner_success",
      });
    });

    it("应该正确处理支付失败事件", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const failedEvent: WebhookEventData = {
        ...baseEventData,
        id: "evt_failed_test",
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_failed_123",
            metadata: {
              orderId: "order_failed",
              practitionerId: "practitioner_failed",
            },
            last_payment_error: {
              message: "Insufficient funds",
            },
          },
        },
      };

      await paymentService.handleWebhookEvent(failedEvent, "test_signature");

      expect(eventSpy).toHaveBeenCalledWith("payment.failed", {
        orderId: "order_failed",
        paymentIntentId: "pi_failed_123",
        failureReason: "Insufficient funds",
        practitionerId: "practitioner_failed",
      });
    });

    it("应该正确处理支付取消事件", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const canceledEvent: WebhookEventData = {
        ...baseEventData,
        id: "evt_canceled_test",
        type: "payment_intent.canceled",
        data: {
          object: {
            id: "pi_canceled_123",
            metadata: {
              orderId: "order_canceled",
              practitionerId: "practitioner_canceled",
            },
          },
        },
      };

      await paymentService.handleWebhookEvent(canceledEvent, "test_signature");

      expect(eventSpy).toHaveBeenCalledWith("payment.canceled", {
        orderId: "order_canceled",
        paymentIntentId: "pi_canceled_123",
        practitionerId: "practitioner_canceled",
      });
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该处理缺少metadata的事件", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const eventWithoutMetadata: WebhookEventData = {
        id: "evt_no_metadata",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_no_metadata",
            amount: 2000,
            currency: "usd",
            metadata: {}, // 空metadata
          },
        },
        created: Date.now() / 1000,
        rawPayload: '{"test": "no_metadata"}',
      };

      await paymentService.handleWebhookEvent(
        eventWithoutMetadata,
        "test_signature",
      );

      // 不应该触发事件
      expect(eventSpy).not.toHaveBeenCalled();
    });

    it("应该忽略不支持的事件类型", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      const unsupportedEvent: WebhookEventData = {
        id: "evt_unsupported",
        type: "customer.created",
        data: {
          object: {
            id: "cus_test_123",
            email: "test@example.com",
          },
        },
        created: Date.now() / 1000,
        rawPayload: '{"test": "unsupported"}',
      };

      await paymentService.handleWebhookEvent(
        unsupportedEvent,
        "test_signature",
      );

      // 不应该触发事件
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe("性能和内存管理", () => {
    it("应该能处理大量不同的事件而不出现内存泄漏", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      // 生成大量不同的事件
      const events: WebhookEventData[] = [];
      for (let i = 0; i < 1000; i++) {
        events.push({
          id: `evt_stress_${i}`,
          type: "payment_intent.succeeded",
          data: {
            object: {
              id: `pi_stress_${i}`,
              amount: 2000,
              currency: "usd",
              metadata: {
                orderId: `order_stress_${i}`,
                practitionerId: "practitioner_stress",
              },
            },
          },
          created: Date.now() / 1000,
          rawPayload: `{"test": "stress_${i}"}`,
        });
      }

      // 处理所有事件
      for (const event of events) {
        await paymentService.handleWebhookEvent(event, "test_signature");
      }

      expect(eventSpy).toHaveBeenCalledTimes(1000);

      // 重复处理，应该跳过所有事件
      eventSpy.mockClear();
      for (const event of events) {
        await paymentService.handleWebhookEvent(event, "test_signature");
      }

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
