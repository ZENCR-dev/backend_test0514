import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Decimal } from "@prisma/client/runtime/library";
import Stripe from "stripe";
import { PaymentService } from "../services/payment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ClinicAccountService } from "../../clinic-account/services/clinic-account.service";
import {
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  PaymentStatus,
} from "../interfaces/payment-engine.interface";
import {
  StripePaymentException,
  PaymentIntentCreationException,
  DuplicatePaymentException,
  PaymentIntentNotFoundException,
} from "../exceptions/payment.exceptions";

/**
 * STRIPE-01 Payment Intent基础功能测试套件
 *
 * 测试范围：
 * 1. createPaymentIntent方法完善
 * 2. getPaymentIntent方法实现
 * 3. cancelPaymentIntent方法实现
 *
 * TDD开发流程：先写失败的测试，再实现功能，最后重构
 */
describe("PaymentService - STRIPE-01 Payment Intent基础功能", () => {
  let service: PaymentService;
  let prismaService: jest.Mocked<PrismaService>;
  let clinicAccountService: jest.Mocked<ClinicAccountService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let mockStripe: any;

  // 测试数据
  const mockStripeConfig = {
    secretKey: "sk_test_mock_key",
    apiVersion: "2024-12-18.acacia" as const,
  };

  const mockPaymentConfig = {
    minPaymentAmount: 100, // $1.00 in cents
    maxPaymentAmount: 1000000, // $10,000 in cents
  };

  const mockCreatePaymentIntentRequest: CreatePaymentIntentRequest = {
    amount: new Decimal("25.50"),
    currency: "nzd",
    orderId: "order-123",
    clinicId: "clinic-456",
    metadata: {
      practitionerId: "practitioner-789",
      patientName: "John Doe",
    },
  };

  const mockStripePaymentIntent = {
    id: "pi_test_123456789",
    object: "payment_intent",
    amount: 2550,
    currency: "nzd",
    status: "requires_payment_method",
    client_secret: "pi_test_123456789_secret_abc123",
    created: Math.floor(Date.now() / 1000),
    metadata: {
      orderId: "order-123",
      clinicId: "clinic-456",
      practitionerId: "practitioner-789",
      patientName: "John Doe",
    },
    automatic_payment_methods: { enabled: true },
    // 添加Stripe PaymentIntent的其他必需字段
    amount_capturable: 0,
    amount_received: 0,
    application: null,
    application_fee_amount: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: "automatic",
    charges: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/charges",
    },
    confirmation_method: "automatic",
    description: null,
    invoice: null,
    last_payment_error: null,
    livemode: false,
    next_action: null,
    on_behalf_of: null,
    payment_method: null,
    payment_method_options: {},
    payment_method_types: ["card"],
    processing: null,
    receipt_email: null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    source: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    transfer_data: null,
    transfer_group: null,
    customer: null,
    latest_charge: null,
    payment_method_configuration_details: null,
  } as Stripe.PaymentIntent;

  beforeEach(async () => {
    // 创建Mock对象
    const mockPrismaService = {
      $transaction: jest.fn(),
    };

    const mockClinicAccountService = {
      getBalance: jest.fn(),
      deductBalance: jest.fn(),
      refundBalance: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
    };

    // 创建Mock Stripe实例
    mockStripe = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
        cancel: jest.fn(),
        confirm: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any;

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
          useValue: mockEventEmitter,
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
    prismaService = module.get(PrismaService);
    clinicAccountService = module.get(ClinicAccountService);
    eventEmitter = module.get(EventEmitter2);

    // 注入Mock Stripe实例
    (service as any).stripe = mockStripe;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createPaymentIntent", () => {
    beforeEach(() => {
      // 默认Mock行为：无重复支付
      jest
        .spyOn(service as any, "checkDuplicatePayment")
        .mockResolvedValue(false);
      mockStripe.paymentIntents.create.mockResolvedValue(
        mockStripePaymentIntent,
      );
    });

    describe("成功场景", () => {
      it("应该成功创建支付意图并返回正确的响应格式", async () => {
        const result = await service.createPaymentIntent(
          mockCreatePaymentIntentRequest,
        );

        expect(result).toEqual({
          id: "pi_test_123456789",
          clientSecret: "pi_test_123456789_secret_abc123",
          amount: 2550,
          currency: "nzd",
          status: PaymentStatus.REQUIRES_PAYMENT_METHOD,
          orderId: "order-123",
          createdAt: expect.any(Date),
        });
      });

      it("应该正确调用Stripe API创建支付意图", async () => {
        await service.createPaymentIntent(mockCreatePaymentIntentRequest);

        expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
          amount: 2550, // $25.50 in cents
          currency: "nzd",
          metadata: {
            orderId: "order-123",
            clinicId: "clinic-456",
            practitionerId: "practitioner-789",
            patientName: "John Doe",
          },
          automatic_payment_methods: {
            enabled: true,
          },
        });
      });

      it("应该正确处理小数金额转换", async () => {
        const requestWithDecimal = {
          ...mockCreatePaymentIntentRequest,
          amount: new Decimal("123.45"),
        };

        await service.createPaymentIntent(requestWithDecimal);

        expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 12345, // $123.45 in cents
          }),
        );
      });
    });

    describe("验证和错误处理", () => {
      it("应该拒绝金额过小的支付请求", async () => {
        const requestWithSmallAmount = {
          ...mockCreatePaymentIntentRequest,
          amount: new Decimal("0.50"), // 50 cents, below minimum
        };

        await expect(
          service.createPaymentIntent(requestWithSmallAmount),
        ).rejects.toThrow(PaymentIntentCreationException);
      });

      it("应该拒绝金额过大的支付请求", async () => {
        const requestWithLargeAmount = {
          ...mockCreatePaymentIntentRequest,
          amount: new Decimal("15000.00"), // Above maximum
        };

        await expect(
          service.createPaymentIntent(requestWithLargeAmount),
        ).rejects.toThrow(PaymentIntentCreationException);
      });

      it("应该检测并拒绝重复支付", async () => {
        jest
          .spyOn(service as any, "checkDuplicatePayment")
          .mockResolvedValue(true);

        await expect(
          service.createPaymentIntent(mockCreatePaymentIntentRequest),
        ).rejects.toThrow(DuplicatePaymentException);
      });

      it("应该处理Stripe API错误", async () => {
        const stripeError = new Stripe.errors.StripeCardError({
          message: "Your card was declined.",
          type: "card_error",
          code: "card_declined",
        });
        mockStripe.paymentIntents.create.mockRejectedValue(stripeError);

        await expect(
          service.createPaymentIntent(mockCreatePaymentIntentRequest),
        ).rejects.toThrow(StripePaymentException);
      });

      it("应该处理网络错误", async () => {
        mockStripe.paymentIntents.create.mockRejectedValue(
          new Error("Network error"),
        );

        await expect(
          service.createPaymentIntent(mockCreatePaymentIntentRequest),
        ).rejects.toThrow(PaymentIntentCreationException);
      });
    });

    describe("幂等性和重复检测", () => {
      it("应该调用重复支付检测", async () => {
        const checkDuplicateSpy = jest.spyOn(
          service as any,
          "checkDuplicatePayment",
        );

        await service.createPaymentIntent(mockCreatePaymentIntentRequest);

        expect(checkDuplicateSpy).toHaveBeenCalledWith(
          "order-123",
          new Decimal("25.50"),
        );
      });
    });
  });

  describe("getPaymentIntent", () => {
    const paymentIntentId = "pi_test_123456789";

    beforeEach(() => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue(
        mockStripePaymentIntent,
      );
    });

    describe("成功场景", () => {
      it("应该成功获取支付意图并返回正确格式", async () => {
        const result = await service.getPaymentIntent(paymentIntentId);

        expect(result).toEqual({
          id: "pi_test_123456789",
          clientSecret: "pi_test_123456789_secret_abc123",
          amount: 2550,
          currency: "nzd",
          status: PaymentStatus.REQUIRES_PAYMENT_METHOD,
          orderId: "order-123",
          createdAt: expect.any(Date),
        });
      });

      it("应该正确调用Stripe API获取支付意图", async () => {
        await service.getPaymentIntent(paymentIntentId);

        expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith(
          paymentIntentId,
        );
      });

      it("应该正确映射不同的Stripe状态", async () => {
        const testCases = [
          {
            stripeStatus: "requires_payment_method",
            expectedStatus: PaymentStatus.REQUIRES_PAYMENT_METHOD,
          },
          {
            stripeStatus: "requires_confirmation",
            expectedStatus: PaymentStatus.REQUIRES_CONFIRMATION,
          },
          {
            stripeStatus: "requires_action",
            expectedStatus: PaymentStatus.REQUIRES_ACTION,
          },
          {
            stripeStatus: "processing",
            expectedStatus: PaymentStatus.PROCESSING,
          },
          {
            stripeStatus: "succeeded",
            expectedStatus: PaymentStatus.SUCCEEDED,
          },
          { stripeStatus: "canceled", expectedStatus: PaymentStatus.CANCELED },
        ];

        for (const testCase of testCases) {
          mockStripe.paymentIntents.retrieve.mockResolvedValue({
            ...mockStripePaymentIntent,
            status: testCase.stripeStatus as any,
          });

          const result = await service.getPaymentIntent(paymentIntentId);
          expect(result.status).toBe(testCase.expectedStatus);
        }
      });
    });

    describe("错误处理", () => {
      it("应该处理支付意图不存在的情况", async () => {
        const notFoundError = new Stripe.errors.StripeInvalidRequestError({
          message: "No such payment_intent",
          type: "invalid_request_error",
        });
        mockStripe.paymentIntents.retrieve.mockRejectedValue(notFoundError);

        await expect(service.getPaymentIntent(paymentIntentId)).rejects.toThrow(
          PaymentIntentNotFoundException,
        );
      });

      it("应该处理Stripe API错误", async () => {
        const stripeError = new Stripe.errors.StripeAPIError({
          message: "API Error",
          type: "api_error",
        });
        mockStripe.paymentIntents.retrieve.mockRejectedValue(stripeError);

        await expect(service.getPaymentIntent(paymentIntentId)).rejects.toThrow(
          StripePaymentException,
        );
      });

      it("应该验证支付意图ID格式", async () => {
        await expect(service.getPaymentIntent("")).rejects.toThrow(
          "Payment intent ID is required",
        );

        await expect(service.getPaymentIntent("invalid-id")).rejects.toThrow(
          "Invalid payment intent ID format",
        );
      });
    });
  });

  describe("cancelPaymentIntent", () => {
    const paymentIntentId = "pi_test_123456789";

    beforeEach(() => {
      // 默认设置：支付意图处于可取消状态
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        ...mockStripePaymentIntent,
        status: "requires_payment_method",
      });

      mockStripe.paymentIntents.cancel.mockResolvedValue({
        ...mockStripePaymentIntent,
        status: "canceled",
      });
    });

    describe("成功场景", () => {
      it("应该成功取消支付意图", async () => {
        await expect(
          service.cancelPaymentIntent(paymentIntentId),
        ).resolves.not.toThrow();

        expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith(
          paymentIntentId,
        );
      });

      it("应该记录取消操作的日志", async () => {
        const loggerSpy = jest.spyOn((service as any).logger, "log");

        await service.cancelPaymentIntent(paymentIntentId);

        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Cancelling payment intent: ${paymentIntentId}`,
          ),
        );
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Payment intent cancelled successfully: ${paymentIntentId}`,
          ),
        );
      });
    });

    describe("错误处理", () => {
      it("应该处理支付意图不存在的情况", async () => {
        const notFoundError = new Stripe.errors.StripeInvalidRequestError({
          message: "No such payment_intent",
          type: "invalid_request_error",
        });
        mockStripe.paymentIntents.retrieve.mockRejectedValue(notFoundError);

        await expect(
          service.cancelPaymentIntent(paymentIntentId),
        ).rejects.toThrow(PaymentIntentNotFoundException);
      });

      it("应该处理已经取消的支付意图", async () => {
        mockStripe.paymentIntents.retrieve.mockResolvedValue({
          ...mockStripePaymentIntent,
          status: "canceled",
        });

        await expect(
          service.cancelPaymentIntent(paymentIntentId),
        ).rejects.toThrow(
          "Payment intent is already canceled or cannot be canceled",
        );
      });

      it("应该处理已经成功的支付意图", async () => {
        mockStripe.paymentIntents.retrieve.mockResolvedValue({
          ...mockStripePaymentIntent,
          status: "succeeded",
        });

        await expect(
          service.cancelPaymentIntent(paymentIntentId),
        ).rejects.toThrow(
          "Payment intent is already succeeded and cannot be canceled",
        );
      });

      it("应该验证支付意图ID格式", async () => {
        await expect(service.cancelPaymentIntent("")).rejects.toThrow(
          "Payment intent ID is required",
        );

        await expect(service.cancelPaymentIntent("invalid-id")).rejects.toThrow(
          "Invalid payment intent ID format",
        );
      });

      it("应该处理Stripe API错误", async () => {
        const stripeError = new Stripe.errors.StripeAPIError({
          message: "API Error",
          type: "api_error",
        });
        mockStripe.paymentIntents.cancel.mockRejectedValue(stripeError);

        await expect(
          service.cancelPaymentIntent(paymentIntentId),
        ).rejects.toThrow(StripePaymentException);
      });
    });

    describe("状态验证", () => {
      it("应该只允许取消可取消状态的支付意图", async () => {
        // 这个测试确保我们在实现中检查支付意图状态
        const mockRetrieve = mockStripe.paymentIntents.retrieve as jest.Mock;
        mockRetrieve.mockResolvedValue({
          ...mockStripePaymentIntent,
          status: "succeeded",
        });

        await expect(
          service.cancelPaymentIntent(paymentIntentId),
        ).rejects.toThrow(
          "Payment intent is already succeeded and cannot be canceled",
        );
      });
    });
  });

  describe("辅助方法测试", () => {
    describe("mapStripeStatusToPaymentStatus", () => {
      it("应该正确映射所有Stripe状态", () => {
        const mapMethod = (service as any).mapStripeStatusToPaymentStatus.bind(
          service,
        );

        expect(mapMethod("requires_payment_method")).toBe(
          PaymentStatus.REQUIRES_PAYMENT_METHOD,
        );
        expect(mapMethod("requires_confirmation")).toBe(
          PaymentStatus.REQUIRES_CONFIRMATION,
        );
        expect(mapMethod("requires_action")).toBe(
          PaymentStatus.REQUIRES_ACTION,
        );
        expect(mapMethod("processing")).toBe(PaymentStatus.PROCESSING);
        expect(mapMethod("succeeded")).toBe(PaymentStatus.SUCCEEDED);
        expect(mapMethod("canceled")).toBe(PaymentStatus.CANCELED);
        expect(mapMethod("unknown_status")).toBe(PaymentStatus.UNKNOWN);
      });
    });

    describe("validatePaymentIntentId", () => {
      it("应该验证支付意图ID格式", () => {
        const validateMethod = (service as any).validatePaymentIntentId?.bind(
          service,
        );

        if (validateMethod) {
          expect(() => validateMethod("")).toThrow(
            "Payment intent ID is required",
          );
          expect(() => validateMethod("invalid-id")).toThrow(
            "Invalid payment intent ID format",
          );
          expect(() => validateMethod("pi_test_123456789")).not.toThrow();
        }
      });
    });
  });
});
