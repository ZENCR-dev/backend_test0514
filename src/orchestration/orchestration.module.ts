import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { OrchestrationGateway } from './gateways/orchestration.gateway';
import { OrchestrationService } from './services/orchestration.service';
import { EventPersistenceService } from './services/event-persistence.service';
import { OrchestrationHealthController } from './controllers/orchestration.controller';

import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 业务编排模块
 * 
 * 职责：
 * - 提供WebSocket网关
 * - 处理业务流程编排
 * - 协调订单和支付状态
 * - 提供健康检查和监控
 * 
 * 依赖：
 * - OrdersModule: 订单管理
 * - AuthModule: 认证服务
 * - JwtModule: JWT处理
 * - EventEmitterModule: 事件驱动架构
 */
@Module({
  imports: [
    // 导入依赖模块
    OrdersModule,
    
    // 配置JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1d'),
        },
      }),
    }),
    
    // 导入事件发射器模块，用于事件驱动架构
    EventEmitterModule.forRoot({
      // 允许通配符事件，如 *.failed
      wildcard: true,
      // 区分大小写
      ignoreErrors: false,
      // 最大监听器数量
      maxListeners: 20,
      // 启用详细调试
      verboseMemoryLeak: true,
    }),
    
    // 导入认证模块，用于WebSocket认证
    AuthModule,
  ],
  controllers: [OrchestrationHealthController],
  providers: [
    OrchestrationGateway,
    OrchestrationService,
    EventPersistenceService,
    PrismaService,
  ],
  exports: [
    OrchestrationGateway,
    OrchestrationService,
  ],
})
export class OrchestrationModule {} 