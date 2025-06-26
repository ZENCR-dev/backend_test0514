import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { validate } from "./config/env.validation";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UserModule } from "./user/user.module";
import { ClinicAccountModule } from "./clinic-account/clinic-account.module";
import { IdempotencyMiddleware } from "./common/middleware/idempotency.middleware";
import { MedicinesModule } from "./medicines/medicines.module";
import { PaymentModule } from "./payment/payment.module";
import { OrdersModule } from "./orders/orders.module";
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
// import { HealthModule } from "./health/health.module"; // 临时禁用健康模块

/**
 * 应用程序根模块
 * 
 * 负责组织和配置应用程序的所有模块
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV || "development"}`, ".env"],
      isGlobal: true,
      validate,
    }),
    EventEmitterModule.forRoot({
      // 设置事件发射器全局可用
      global: true,
      // 配置最大监听器数量
      maxListeners: 10,
      // 开启通配符监听
      wildcard: false,
      // 设置分隔符
      delimiter: ".",
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ClinicAccountModule,
    MedicinesModule,
    PaymentModule,
    OrdersModule, // Task 5A - 订单管理模块
    PrescriptionsModule,
    
    // Task 5C - 业务编排服务
    // 负责协调订单和支付流程，通过WebSocket实时通知前端状态变更
    OrchestrationModule,
    
    // HealthModule, // 临时禁用
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 应用幂等性中间件到特定路由
    consumer.apply(IdempotencyMiddleware).forRoutes(
      // 支付相关端点需要幂等性保护
      { path: "api/v1/orders", method: "POST" as any },
      { path: "api/v1/payments", method: "POST" as any },
      { path: "api/v1/accounts/recharge", method: "POST" as any },
      { path: "api/v1/accounts/deduct", method: "POST" as any },
    );
  }
}
