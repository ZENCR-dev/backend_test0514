import { Module } from "@nestjs/common";
import { OrderController } from "./controllers/order.controller";
import { OrderService } from "./services/order.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

/**
 * 订单模块 - Task 5A 模块集成
 *
 * 职责范围：
 * - 整合订单相关的控制器、服务和依赖项
 * - 提供订单业务的完整功能模块
 * - 与其他模块（认证、支付等）的集成点
 *
 * 模块结构：
 * - Controllers: OrderController (API端点)
 * - Providers: OrderService (业务逻辑)
 * - Imports: PrismaModule (数据库访问), AuthModule (权限控制)
 * - Exports: OrderService (供其他模块使用)
 *
 * @author Task 5A Team
 * @version 1.0.0
 * @since 2025-06-17
 */
@Module({
  imports: [
    PrismaModule, // 数据库访问模块
    AuthModule, // 认证授权模块 - 提供PermissionService和Guards
  ],
  controllers: [
    OrderController, // 订单API控制器
  ],
  providers: [
    OrderService, // 订单业务服务
  ],
  exports: [
    OrderService, // 导出服务供其他模块使用（如支付模块、业务编排模块）
  ],
})
export class OrdersModule {
  /**
   * 模块初始化时的日志记录
   */
  constructor() {
    console.log("OrdersModule initialized - Task 5A API layer ready");
  }
}
