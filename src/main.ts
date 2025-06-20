import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { VersioningType, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { validationPipeConfig } from "./common/pipes/validation.pipe";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  // 配置raw body解析器用于Stripe webhook
  app.use(
    "/api/v1/payments/webhook",
    express.raw({ type: "application/json" }),
  );

  // API版本控制配置
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: "api/v",
    defaultVersion: "1",
  });

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局验证管道（使用预配置的增强版）
  app.useGlobalPipes(validationPipeConfig);

  // CORS配置（基于环境）
  const corsOrigins =
    process.env.NODE_ENV === "production"
      ? process.env.CORS_ORIGINS?.split(",") || []
      : ["http://localhost:3000", "http://localhost:3001"];

  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "idempotency-key"],
    credentials: true,
  });

  // 设置安全头
  app.use((req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
    next();
  });

  // Swagger API文档配置
  const config = new DocumentBuilder()
    .setTitle("TCM Prescription Platform API")
    .setDescription(
      "New Zealand TCM Prescription Platform Backend API - Comprehensive medical prescription management system",
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "jwt",
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "idempotency-key",
        in: "header",
        description: "UUID v4 for request idempotency",
      },
      "idempotency",
    )
    .addServer("http://localhost:3001", "Development Server")
    .addServer("https://api.tcm-platform.com", "Production Server")
    .addTag("auth", "Authentication endpoints")
    .addTag("users", "User management")
    .addTag("orders", "Order management")
    .addTag("medicines", "Medicine catalog")
    .addTag("payments", "Payment processing")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(
    `🚀 TCM Prescription Platform API is running on: http://localhost:${port}`,
  );
  logger.log(`📚 Swagger Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🏥 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.log(`🔐 API Version: v1 (default)`);
}

bootstrap().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
