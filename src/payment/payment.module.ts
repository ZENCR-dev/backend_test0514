import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PaymentService } from "./services/payment.service";
import { PaymentController } from "./controllers/payment.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ClinicAccountModule } from "../clinic-account/clinic-account.module";

/**
 * 支付模块配置
 *
 * 职责范围：
 * - Stripe支付集成服务
 * - 诊所账户管理集成
 * - 支付安全和并发控制
 * - Webhook事件处理
 *
 * 依赖模块：
 * - PrismaModule: 数据库访问
 * - ClinicAccountModule: 诊所账户服务
 * - ConfigModule: 环境配置管理
 * - EventEmitterModule: 事件驱动通信
 */
@Module({
  imports: [
    // 配置模块 - 环境变量管理
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // 事件模块 - 事件驱动架构
    EventEmitterModule.forRoot({
      // 设置最大监听器数量
      maxListeners: 10,
      // 启用通配符
      wildcard: false,
      // 分隔符
      delimiter: ".",
      // 启用新监听器警告
      newListener: false,
      // 启用移除监听器警告
      removeListener: false,
      // 最大监听器数量警告
      verboseMemoryLeak: false,
      // 忽略未定义事件
      ignoreErrors: false,
    }),

    // 数据库模块
    PrismaModule,

    // 诊所账户模块
    ClinicAccountModule,
  ],

  controllers: [PaymentController],

  providers: [
    PaymentService,

    // Stripe配置提供者
    {
      provide: "STRIPE_CONFIG",
      useFactory: (configService: ConfigService) => ({
        secretKey: configService.get<string>("STRIPE_SECRET_KEY"),
        publishableKey: configService.get<string>("STRIPE_PUBLISHABLE_KEY"),
        webhookSecret: configService.get<string>("STRIPE_WEBHOOK_SECRET"),
        apiVersion: "2023-10-16" as const,
      }),
      inject: [ConfigService],
    },

    // 支付配置提供者
    {
      provide: "PAYMENT_CONFIG",
      useFactory: (configService: ConfigService) => ({
        defaultCurrency: configService.get<string>("DEFAULT_CURRENCY", "nzd"),
        maxPaymentAmount: configService.get<number>(
          "MAX_PAYMENT_AMOUNT",
          999999999,
        ),
        minPaymentAmount: configService.get<number>("MIN_PAYMENT_AMOUNT", 1),
        paymentTimeoutMs: configService.get<number>(
          "PAYMENT_TIMEOUT_MS",
          300000,
        ), // 5分钟
        retryAttempts: configService.get<number>("PAYMENT_RETRY_ATTEMPTS", 3),
        retryDelayMs: configService.get<number>("PAYMENT_RETRY_DELAY_MS", 1000),
      }),
      inject: [ConfigService],
    },
  ],

  exports: [PaymentService, "STRIPE_CONFIG", "PAYMENT_CONFIG"],
})
export class PaymentModule {
  constructor(private configService: ConfigService) {
    // 验证必要的环境变量
    this.validateConfiguration();
  }

  /**
   * 验证支付模块必要的配置
   */
  private validateConfiguration(): void {
    const requiredConfigs = [
      "STRIPE_SECRET_KEY",
      "STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ];

    const missingConfigs = requiredConfigs.filter(
      (config) => !this.configService.get(config),
    );

    if (missingConfigs.length > 0) {
      throw new Error(
        `Missing required payment configuration: ${missingConfigs.join(", ")}`,
      );
    }

    // 验证Stripe密钥格式
    const secretKey = this.configService.get<string>("STRIPE_SECRET_KEY");
    const publishableKey = this.configService.get<string>(
      "STRIPE_PUBLISHABLE_KEY",
    );

    if (!secretKey?.startsWith("sk_")) {
      throw new Error(
        'Invalid STRIPE_SECRET_KEY format. Must start with "sk_"',
      );
    }

    if (!publishableKey?.startsWith("pk_")) {
      throw new Error(
        'Invalid STRIPE_PUBLISHABLE_KEY format. Must start with "pk_"',
      );
    }

    // 检查是否为测试环境密钥
    const isTestKey = secretKey.includes("_test_");
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development");

    if (nodeEnv === "production" && isTestKey) {
      throw new Error("Cannot use test Stripe keys in production environment");
    }

    console.log(`✅ Payment module configuration validated successfully`);
    console.log(`   Environment: ${nodeEnv}`);
    console.log(`   Stripe Mode: ${isTestKey ? "Test" : "Live"}`);
  }
}
