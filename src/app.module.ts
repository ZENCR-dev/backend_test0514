import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { validate } from "./config/env.validation";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UserModule } from "./user/user.module";
import { ClinicAccountModule } from "./clinic-account/clinic-account.module";
import { IdempotencyMiddleware } from "./common/middleware/idempotency.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV || "development"}`, ".env"],
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ClinicAccountModule,
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
