import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { LoggerModule } from "nestjs-pino";
import { validate } from "./config/env.validation";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UserModule } from "./user/user.module";
import { PractitionerAccountModule } from "./practitioner-account/practitioner-account.module";
import { IdempotencyMiddleware } from "./common/middleware/idempotency.middleware";
import { EnhancedPerformanceMonitoringMiddleware } from "./common/middleware/enhanced-performance-monitoring.middleware";
import { CommonModule } from "./common/common.module";
import { MedicinesModule } from "./medicines/medicines.module";
import { PaymentModule } from "./payment/payment.module";
import { OrdersModule } from "./orders/orders.module";
import { PrescriptionsModule } from "./modules/prescriptions/prescriptions.module";
import { OrchestrationModule } from "./orchestration/orchestration.module";
import { PharmacyModule } from "./pharmacy/pharmacy.module";
import { AdminModule } from "./admin/admin.module";
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
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV === 'development' ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        } : undefined,
        customProps: (req: any) => ({
          correlationId: req.correlationId,
          userId: req.user?.id,
        }),
        serializers: {
          req: (req: any) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            correlationId: req.correlationId,
            userId: req.user?.id,
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
        },
        level: process.env.LOG_LEVEL || 'info',
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          remove: true,
        },
      },
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
    // Global modules
    CommonModule, // API logging and performance monitoring services
    PrismaModule,
    AuthModule,
    UserModule,
    PractitionerAccountModule,
    MedicinesModule,
    PaymentModule,
    OrdersModule, // Task 5A - 订单管理模块
    PrescriptionsModule,
    PharmacyModule, // MVP 2.4 - 药房端后端模块
    AdminModule, // MVP 2.5 - 管理员后端模块

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
    // Apply global API logging and performance monitoring middleware
    consumer
      .apply(EnhancedPerformanceMonitoringMiddleware)
      .forRoutes('*'); // Monitor all routes
    
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
