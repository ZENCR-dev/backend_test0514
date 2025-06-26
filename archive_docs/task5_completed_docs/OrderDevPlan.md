# 新西兰中医药电子处方平台 OrderDevPlan

## 一、项目背景与目标

本计划旨在规范前后端协作，确保处方相关功能（创建、保存、历史查询、详情、权限、分页等）端到端高质量落地。后端主导每阶段发起、联动、确认与进度记录，前端配合数据结构、交互、权限、测试等全流程对齐。

---

## 二、阶段划分与时间线

| 阶段 | 时间范围 | 主要目标 | 责任方 | 联动节点 |
|------|----------|----------|--------|----------|
| 1. 数据结构对齐 | Day 1 | DTO/接口/表单字段完全一致 | 后端发起 | 双方确认 |
| 2. 后端API开发 | Day 1-2 | 处方创建、查询、详情、权限、分页API | 后端 | 前端接口联调 |
| 3. 前端表单与交互 | Day 2-3 | 表单补全、交互完善、API调用 | 前端 | 后端接口反馈 |
| 4. 权限与角色适配 | Day 3 | 权限校验、角色UI/入口控制 | 前端 | 后端接口联调 |
| 5. 分页与筛选 | Day 3 | 列表分页、筛选、API联动 | 前端 | 后端接口联调 |
| 6. 自动化测试 | Day 3-4 | 单元/集成测试、Mock、异常 | 前后端 | 联合验收 |
| 7. 联调与验收 | Day 4 | 全链路联调、文档/演示 | 后端主导 | 双方验收 |

---

## 字段分层表（MVP1.0）

| 字段名             | 业务含义   | 必填/可选 | 备注           |
|--------------------|------------|-----------|----------------|
| medicines          | 药品明细   | 必填      | 数组，见下     |
| ├─ medicineId      | 药品ID     | 必填      |                |
| ├─ medicineName    | 药品名     | 必填      |                |
| ├─ chineseName     | 中文名     | 必填      |                |
| ├─ quantity        | 数量       | 必填      |                |
| ├─ unit            | 单位       | 必填      |                |
| notes              | 处方备注   | 必填      |                |
| status             | 状态       | 必填      |                |
| qrCodeData         | 二维码     | 必填      |                |
| createdAt          | 创建时间   | 必填      |                |
| updatedAt          | 更新时间   | 必填      |                |
| ...                | 其余字段   | 可选      | 单价、总价等   |

> *本表为MVP1.0阶段唯一依据，后续版本如有调整，需在本表及通知渠道同步。*

## 字段对照表（MVP1.0全量字段）

| 字段名             | 业务含义   | 必填/可选 | 前端types           | 后端DTO/响应         | 数据库字段           | API文档字段名        |
|--------------------|------------|-----------|---------------------|----------------------|---------------------|---------------------|
| id                 | 处方主键   | 必填      | id                  | id                   | id                  | id                  |
| prescriptionId     | 业务流水号 | 可选      | prescriptionId      | prescriptionId       | platformOrderId     | prescriptionId      |
| doctorId           | 医生ID     | 可选      | doctorId            | practitionerId       | practitionerId      | doctorId            |
| clinicId           | 诊所ID     | 可选      | clinicId            | clinicId             | clinicId            | clinicId            |
| patientInfo        | 患者信息   | 可选      | patientInfo         | patientInfo          | patientInfo(Json)   | patientInfo         |
| medicines          | 药品明细   | 必填      | medicines           | medicines            | orderItems          | medicines           |
| ├─ medicineId      | 药品ID     | 必填      | medicineId          | medicineId           | medicineId          | medicineId          |
| ├─ medicineName    | 药品名     | 必填      | medicineName        | medicineName         | medicineName        | medicineName        |
| ├─ chineseName     | 中文名     | 必填      | chineseName         | chineseName          | chineseName         | chineseName         |
| ├─ quantity        | 数量       | 必填      | quantity            | quantity             | quantity            | quantity            |
| ├─ unit            | 单位       | 必填      | unit                | unit                 | unit                | unit                |
| ├─ unitPrice       | 单价       | 可选      | unitPrice           | unitPrice            | unitPrice           | unitPrice           |
| ├─ totalPrice      | 总价       | 可选      | totalPrice          | totalPrice           | totalPrice          | totalPrice          |
| ├─ dosageInstructions | 剂量说明 | 可选      | dosageInstructions  | dosageInstructions   | dosageInstructions  | dosageInstructions  |
| ├─ notes           | 药品备注   | 可选      | notes               | notes                | notes               | notes               |
| notes              | 处方备注   | 必填      | notes               | notes                | notes               | notes               |
| status             | 状态       | 必填      | status              | status               | status              | status              |
| qrCodeData         | 二维码     | 必填      | qrCodeData          | qrCodeData           | qrCodeData          | qrCodeData          |
| createdAt          | 创建时间   | 必填      | createdAt           | createdAt            | createdAt           | createdAt           |
| updatedAt          | 更新时间   | 必填      | updatedAt           | updatedAt            | updatedAt           | updatedAt           |
| totalAmount        | 总金额     | 可选      | totalAmount         | totalAmount          | totalAmount         | totalAmount         |
| version            | 版本号     | 可选      | version             | version              | version             | version             |
| assignedPharmacyId | 指定药房ID | 可选      | assignedPharmacyId  | assignedPharmacyId   | assignedPharmacyId  | assignedPharmacyId  |
| dispensedAt        | 发药时间   | 可选      | dispensedAt         | dispensedAt          | dispensedAt         | dispensedAt         |
| completedAt        | 完成时间   | 可选      | completedAt         | completedAt          | completedAt         | completedAt         |
| pdfUrl             | 处方PDF    | 可选      | pdfUrl              | pdfUrl               | pdfUrl              | pdfUrl              |
| ...                | 其他扩展   | 可选      | ...                 | ...                  | ...                 | ...                 |

> *本表为MVP1.0阶段所有可能字段一览，前端如需扩展展示或兼容历史数据，可参考本表补充。字段必填/可选以"字段分层表"为准。*

---

## 三、后端任务清单（Implementation Checklist）

1. **数据结构确认**
   - [ ] 对照API文档，确保DTO、数据库模型与前端请求体一致
   - [ ] DTO/types/表单/响应/文档，均需严格遵循字段分层表（MVP1.0）
2. **数据库模型完善**
   - [ ] 检查/调整Prisma schema，Prescription及关联表字段齐全
3. **处方创建API**
   - [ ] POST /api/v1/prescriptions，保存处方到数据库，返回完整信息
   - [ ] 严格校验请求体，返回标准响应结构
4. **历史处方查询API**
   - [ ] GET /api/v1/prescriptions，支持分页、当前医生/用户过滤
5. **处方详情API**
   - [ ] GET /api/v1/prescriptions/:id，返回完整信息
6. **权限控制**
   - [ ] 创建、查询、详情等接口严格JWT和角色校验
7. **分页与筛选**
   - [ ] 支持page、limit等参数，必要时支持状态、时间筛选
8. **自动化测试**
   - [ ] 单元/集成测试，覆盖主要功能、权限、分页、异常
9. **日志与错误处理**
   - [ ] 记录关键日志，统一错误响应格式
10. **Swagger文档同步**
    - [ ] API变更同步到Swagger
11. **联调验证**
    - [ ] 与前端联调，确保端点可用、数据一致、权限正确
12. **Task 5C 业务编排服务开发（当前阶段重点）**
    - [ ] 目标：实现支付-订单端到端自动流转、异常补偿、业务流程自动化，补全Checklist闭环
    - [ ] 技术选型：NestJS事件驱动架构，优先采用@nestjs/cqrs、Saga模式
    - [ ] 核心功能：监听支付成功/失败事件，自动驱动订单状态流转，异常自动补偿（如支付失败回滚、订单取消自动退款）
    - [ ] 接口与集成：与OrderService、PaymentService解耦，事件驱动业务流转，接口文档同步
    - [ ] 测试：补充端到端流程、异常补偿、事件流转的单元/集成测试
    - [ ] 日志与监控：记录关键事件、异常、补偿操作，补充监控指标
    - [ ] 文档：所有API/事件/状态流转同步到Swagger，便于前端和验收
    - [ ] 联调：与前端联调端到端业务流程，确保Checklist所有项闭环

### Task 5C 业务编排服务修复方案（当前阶段重点）

#### 1. 问题分析

经过代码审查和日志分析，Task 5C业务编排服务存在以下问题：

1. **基础设施缺失**：
   - `src/orchestration`目录存在但为空，未实现业务编排服务
   - `app.module.ts`中未导入OrchestrationModule

2. **事件处理不一致**：
   - `OrderService`使用`eventEmitter.emitAsync`异步发布事件
   - `PaymentService`使用`eventEmitter.emit`同步发布事件
   - 缺少事件监听器处理这些事件

3. **WebSocket连接失败**：
   - 前端尝试连接`ws://localhost:4001/ws/orchestration`，但后端未实现WebSocketGateway
   - 缺少WebSocket认证机制，导致连接失败

4. **API认证失败**：
   - 处方API返回401未授权错误，可能是JWT token配置或传递问题

#### 2. 修复策略

采用渐进式架构方案，分阶段修复Task 5C业务编排服务：

1. **简化技术栈**：
   - 使用NestJS原生EventEmitter2，避免引入@nestjs/cqrs和Saga模式增加复杂度
   - 复用现有JWT认证机制，确保WebSocket和REST API使用相同的认证策略

2. **分阶段实现**：
   - 阶段1：基础设施修复（OrchestrationModule、WebSocketGateway、认证机制）
   - 阶段2：事件监听实现（payment.succeeded、payment.failed等事件处理）
   - 阶段3：业务流程集成（订单状态自动流转、异常补偿）
   - 阶段4：测试与文档（单元测试、集成测试、Swagger文档）

#### 3. 详细实施步骤

##### 阶段1：基础设施修复

1. **创建OrchestrationModule**：
```typescript
// src/orchestration/orchestration.module.ts
import { Module } from '@nestjs/common';
import { OrchestrationService } from './services/orchestration.service';
import { OrchestrationGateway } from './gateways/orchestration.gateway';
import { OrdersModule } from '../orders/orders.module';
import { PaymentModule } from '../payment/payment.module';
import { PrescriptionsModule } from '../modules/prescriptions/prescriptions.module';
import { AuthModule } from '../auth/auth.module';
import { OrchestrationHealthController } from './controllers/orchestration.controller';

@Module({
  imports: [
    OrdersModule,
    PaymentModule,
    PrescriptionsModule,
    AuthModule,
  ],
  providers: [
    OrchestrationService,
    OrchestrationGateway,
  ],
  controllers: [
    OrchestrationHealthController
  ],
  exports: [
    OrchestrationService,
  ],
})
export class OrchestrationModule {}
```

2. **实现WebSocketGateway**：
```typescript
// src/orchestration/gateways/orchestration.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../auth/auth.service';

@WebSocketGateway({
  path: '/ws/orchestration',
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000' },
})
@Injectable()
export class OrchestrationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrchestrationGateway.name);
  private readonly connectedClients = new Map<string, Socket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 从handshake auth中获取token
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('Missing authentication token');
      }

      // 验证JWT token
      const payload = this.jwtService.verify(token);
      const user = await this.authService.verifyPayload(payload);
      
      if (!user) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      // 存储client连接信息
      client.data.user = user;
      this.connectedClients.set(user.id, client);
      
      this.logger.log(`Client connected: ${user.id}`);
      client.emit('connection_status', { connected: true, userId: user.id });
      
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      this.connectedClients.delete(userId);
      this.logger.log(`Client disconnected: ${userId}`);
    }
  }

  // 广播事件到所有连接的客户端
  broadcastEvent(eventName: string, data: any) {
    this.server.emit(eventName, data);
    this.logger.debug(`Broadcasting event ${eventName}: ${JSON.stringify(data)}`);
  }

  // 发送事件到特定用户
  sendToUser(userId: string, eventName: string, data: any) {
    const client = this.connectedClients.get(userId);
    if (client) {
      client.emit(eventName, data);
      this.logger.debug(`Sent event ${eventName} to user ${userId}`);
    }
  }
  
  // 健康检查方法 - 核心团队建议
  isHealthy(): boolean {
    return this.server && this.server.engine.clientsCount >= 0;
  }
}
```

3. **实现OrchestrationService**：
```typescript
// src/orchestration/services/orchestration.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderService } from '../../orders/services/order.service';
import { PaymentService } from '../../payment/services/payment.service';
import { PrescriptionsService } from '../../modules/prescriptions/prescriptions.service';
import { OrchestrationGateway } from '../gateways/orchestration.gateway';

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);
  
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly prescriptionsService: PrescriptionsService,
    private readonly gateway: OrchestrationGateway,
  ) {}

  @OnEvent('payment.succeeded')
  async handlePaymentSucceeded(event: any) {
    try {
      this.logger.log(`Payment succeeded event received: ${JSON.stringify(event)}`);
      
      // 1. 更新订单状态为PAID
      await this.orderService.updateStatus(event.orderId, 'PAID');
      
      // 2. 通知前端
      this.gateway.broadcastEvent('order.status.updated', {
        orderId: event.orderId,
        status: 'PAID',
        timestamp: new Date().toISOString(),
      });
      
      this.logger.log(`Order ${event.orderId} status updated to PAID`);
    } catch (error) {
      this.logger.error(`Error handling payment.succeeded event: ${error.message}`, error.stack);
      // 添加错误恢复机制 - 核心团队建议
      this.handlePaymentCompensation(event, error);
    }
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(event: any) {
    try {
      this.logger.log(`Payment failed event received: ${JSON.stringify(event)}`);
      
      // 1. 更新订单状态为PAYMENT_FAILED
      await this.orderService.updateStatus(event.orderId, 'PAYMENT_FAILED');
      
      // 2. 通知前端
      this.gateway.broadcastEvent('order.status.updated', {
        orderId: event.orderId,
        status: 'PAYMENT_FAILED',
        reason: event.failureReason,
        timestamp: new Date().toISOString(),
      });
      
      this.logger.log(`Order ${event.orderId} status updated to PAYMENT_FAILED`);
    } catch (error) {
      this.logger.error(`Error handling payment.failed event: ${error.message}`, error.stack);
    }
  }
  
  // 统一的失败处理和恢复逻辑 - 核心团队建议
  @OnEvent('*.failed')
  async handleAnyFailedEvent(event: any) {
    this.logger.warn(`Generic failure event handler triggered: ${JSON.stringify(event)}`);
    // 记录失败事件，便于后续人工干预
    // 实现通用的恢复策略
  }
  
  // 支付补偿机制
  private async handlePaymentCompensation(event: any, error: any) {
    this.logger.warn(`Initiating payment compensation for order ${event.orderId}: ${error.message}`);
    // 实现补偿逻辑，例如重试更新订单状态
    try {
      await this.orderService.updateStatus(event.orderId, 'PAYMENT_PROCESSING_ERROR');
      this.gateway.broadcastEvent('order.compensation', {
        orderId: event.orderId,
        originalEvent: 'payment.succeeded',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    } catch (compensationError) {
      this.logger.error(`Compensation failed: ${compensationError.message}`);
      // 记录到死信队列或告警系统
    }
  }
}
```

4. **添加健康检查端点** - 核心团队建议：
```typescript
// src/orchestration/controllers/orchestration.controller.ts
import { Controller, Get } from '@nestjs/common';
import { OrchestrationGateway } from '../gateways/orchestration.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('health')
export class OrchestrationHealthController {
  constructor(
    private readonly gateway: OrchestrationGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('/orchestration')
  async getOrchestrationHealth() {
    return {
      websocket: this.gateway.isHealthy(),
      eventEmitter: this.eventEmitter.listenerCount() > 0,
      timestamp: new Date().toISOString(),
    };
  }
}
```

5. **更新app.module.ts**：
```typescript
// src/app.module.ts
import { OrchestrationModule } from './orchestration/orchestration.module';

@Module({
  imports: [
    // ... existing imports
    OrchestrationModule,
  ],
  // ... existing configuration
})
export class AppModule implements NestModule {
  // ... existing code
}
```

##### 阶段2：统一事件处理

1. **统一事件类型定义**：
```typescript
// src/common/events/types.ts
export interface PaymentSucceededEvent {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  clinicId?: string;
  timestamp?: string;
}

export interface PaymentFailedEvent {
  orderId: string;
  paymentIntentId: string;
  failureReason: string;
  clinicId?: string;
  timestamp?: string;
}

export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  clinicId?: string;
  totalAmount: number;
  items: Array<any>;
  timestamp?: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  previousStatus: string;
  currentStatus: string;
  changedBy?: string;
  timestamp?: string;
}
```

2. **统一PaymentService中的事件发布**：
```typescript
// src/payment/services/payment.service.ts
// 修改handlePaymentSucceeded方法
private async handlePaymentSucceeded(eventData: WebhookEventData): Promise<any> {
  const paymentIntent = eventData.data.object;
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    this.logger.warn(`Payment succeeded but no orderId in metadata: ${paymentIntent.id}`);
    return { processed: false, reason: "missing_order_id" };
  }

  // 发出支付成功事件（改为异步）
  await this.eventEmitter.emitAsync("payment.succeeded", {
    orderId,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    clinicId: paymentIntent.metadata?.clinicId,
    timestamp: new Date().toISOString(),
  });

  return {
    processed: true,
    orderId,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
  };
}
```

##### 阶段3：测试与文档

1. **添加单元测试**：
```typescript
// src/orchestration/__tests__/orchestration.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationService } from '../services/orchestration.service';
import { OrchestrationGateway } from '../gateways/orchestration.gateway';
import { OrderService } from '../../orders/services/order.service';
import { PaymentService } from '../../payment/services/payment.service';
import { PrescriptionsService } from '../../modules/prescriptions/prescriptions.service';

describe('OrchestrationService', () => {
  let service: OrchestrationService;
  let orderService: OrderService;
  let gateway: OrchestrationGateway;

  const mockOrderService = {
    updateStatus: jest.fn(),
  };

  const mockGateway = {
    broadcastEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: PaymentService,
          useValue: {},
        },
        {
          provide: PrescriptionsService,
          useValue: {},
        },
        {
          provide: OrchestrationGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
    orderService = module.get<OrderService>(OrderService);
    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
  });

  it('should handle payment.succeeded event', async () => {
    const event = {
      orderId: 'order-123',
      paymentIntentId: 'pi_123',
      amount: 1000,
      currency: 'nzd',
    };

    await service.handlePaymentSucceeded(event);

    expect(orderService.updateStatus).toHaveBeenCalledWith('order-123', 'PAID');
    expect(gateway.broadcastEvent).toHaveBeenCalledWith(
      'order.status.updated',
      expect.objectContaining({
        orderId: 'order-123',
        status: 'PAID',
      }),
    );
  });

  it('should handle payment.failed event', async () => {
    const event = {
      orderId: 'order-456',
      paymentIntentId: 'pi_456',
      failureReason: 'insufficient_funds',
    };

    await service.handlePaymentFailed(event);

    expect(orderService.updateStatus).toHaveBeenCalledWith('order-456', 'PAYMENT_FAILED');
    expect(gateway.broadcastEvent).toHaveBeenCalledWith(
      'order.status.updated',
      expect.objectContaining({
        orderId: 'order-456',
        status: 'PAYMENT_FAILED',
        reason: 'insufficient_funds',
      }),
    );
  });
});
```

#### 4. 验收标准

1. **基础设施验收**：
   - WebSocket连接成功：前端可以连接到`ws://localhost:4001/ws/orchestration`
   - 认证机制正常：未授权连接被拒绝，授权连接成功建立
   - API认证正常：处方API返回200而非401

2. **功能验收**：
   - 支付成功事件正确处理：订单状态自动更新为PAID
   - 支付失败事件正确处理：订单状态自动更新为PAYMENT_FAILED
   - 前端实时收到订单状态更新通知

3. **测试覆盖**：
   - 单元测试：OrchestrationService的事件处理逻辑
   - 集成测试：WebSocket连接和认证
   - 端到端测试：完整支付-订单流程

#### 5. 风险与应急预案

1. **WebSocket连接不稳定**：
   - 风险：WebSocket连接可能因网络问题断开
   - 应对：实现断线重连机制，前端定期检查连接状态

2. **事件处理失败**：
   - 风险：事件处理过程中可能出现异常
   - 应对：添加重试机制，记录失败事件，提供手动补偿接口

3. **高并发处理**：
   - 风险：大量并发事件可能导致系统过载
   - 应对：实现事件队列，控制处理速率，添加监控告警

#### 6. 与前端协作规范

1. **WebSocket端点**：
   - URL：`ws://localhost:4001`
   - 路径：`/ws/orchestration`
   - 认证：通过handshake.auth.token传递JWT token

2. **事件格式规范**：
   ```typescript
   // 后端发送的事件格式
   {
     event: 'order.status.updated', // 事件名称
     data: {                        // 事件数据
       orderId: 'order-123',
       status: 'PAID',
       timestamp: '2025-06-22T10:15:30.123Z'
     }
   }
   ```

3. **错误处理约定**：
   - 认证失败：前端将收到`error`事件，包含`message`字段
   - 连接断开：前端需实现指数退避重连
   - 事件处理失败：前端将收到`order.compensation`事件

4. **监控指标**：
   - WebSocket连接数
   - 事件处理成功率
   - 平均事件处理时间

#### 7. 实施时间表

| 阶段 | 内容 | 时间估计 | 负责人 |
|------|------|----------|--------|
| 1. 基础设施修复 | OrchestrationModule、WebSocketGateway、认证机制 | 1天 | 后端团队 |
| 2. 事件处理实现 | 事件监听、状态更新、前端通知 | 1天 | 后端团队 |
| 3. 业务流程集成 | 完整订单-支付流程、异常补偿 | 1天 | 后端团队 |
| 4. 测试与文档 | 单元测试、集成测试、Swagger文档 | 1天 | 后端团队 |
| 5. 联调与验收 | 与前端联调、验证端到端流程 | 1天 | 前后端团队 |

---

> 本修订方案已纳入核心团队和前端团队的反馈，通过简化技术栈、统一认证机制、分阶段实现和完善测试策略，解决了Task 5C业务编排服务的关键问题。所有开发、测试、联调、验收均需严格对齐本方案。

---

## 四、前端任务清单（Implementation Checklist）

1. **处方数据结构与API契约对齐**
   - [ ] 梳理前端处方创建、详情、列表数据结构，确保字段、命名、类型一致
   - [ ] 不一致及时沟通修正
   - [ ] DTO/types/表单/响应/文档，均需严格遵循字段分层表（MVP1.0）
2. **处方创建表单与交互完善**
   - [ ] 补全所有后端要求字段
   - [ ] 支持药品多项输入、剂量说明、患者信息完整录入
   - [ ] 表单校验与友好提示
3. **API调用与错误处理**
   - [ ] 统一API路径，所有请求带JWT
   - [ ] 完善错误提示，处理后端校验/权限/网络异常
   - [ ] 日志调试信息便于联调排查
4. **历史处方列表与详情页**
   - [ ] 新增/完善历史处方列表页，支持分页、状态、时间筛选
   - [ ] 新增/完善处方详情页，完整展示后端返回字段
5. **权限与角色适配**
   - [ ] 根据用户角色动态展示内容与操作，路由/按钮/入口严格受控
   - [ ] 权限不足时友好提示
6. **分页与筛选交互**
   - [ ] 列表页支持page/limit参数，必要时支持状态、时间筛选
   - [ ] 分页组件与API联动
7. **自动化测试**
   - [ ] 单元/集成测试，覆盖表单、API、权限、分页、异常
   - [ ] Mock后端接口，确保前端逻辑健壮
8. **联调与反馈**
   - [ ] 联调期间及时反馈接口问题、数据不一致、权限异常
   - [ ] 协助后端完善Swagger文档，发现文档与实现不符及时沟通
9. **文档与演示**
   - [ ] 更新前端接口调用说明、表单字段说明、交互流程文档
   - [ ] 准备联调演示脚本，便于全员验收

---

## 五、联调与验收节点

- 每阶段后端主导发起接口/数据结构确认，前端配合反馈
- 关键节点（如API上线、表单完善、权限适配、分页测试、自动化测试）后端需发起联动会议/同步，记录进度
- 联调期间双方每日同步进展，发现问题及时修正
- 验收前后端共同演示全流程，确认所有功能、权限、数据一致

---

## 六、进度记录表（由后端主导填写）

| 日期 | 阶段 | 责任方 | 主要内容 | 完成情况 | 备注 |
|------|------|--------|----------|----------|------|
|      |      |        |          |          |      |
|      |      |        |          |          |      |

---

【前端字段对齐核查标签】
已完成src/types/prescription.ts所有主类型的修正，字段、命名、类型、嵌套结构与OrderDevPlan.md字段分层表、API文档、后端DTO完全一致。
已在OrderDevPlan.md进度记录表下方，新增"【前端字段对齐核查标签】"专栏，包含结构化字段对照表、差异清单（已全部消除）、修正说明，便于后端review和归档。
请后端review，如有新字段/命名/类型变更请及时同步，前端将第一时间review并修正。当前阶段数据结构对齐任务已100%完成，无偏离。

### 1. 结构化字段对照表（核心字段示例）

| 字段名             | 字段分层表/后端DTO | 前端types(prescription.ts) | 类型/结构 | 一致性 |
|--------------------|-------------------|----------------------------|-----------|--------|
| clinicId           | clinicId          | clinicId                   | string    | ✅     |
| patientInfo        | patientInfo       | patientInfo                | object    | ✅     |
| medicines          | medicines         | medicines                  | array     | ✅     |
| ├─ medicineId      | medicineId        | medicineId                 | string    | ✅     |
| ├─ medicineName    | medicineName      | medicineName               | string    | ✅     |
| ├─ chineseName     | chineseName       | chineseName                | string    | ✅     |
| ├─ quantity        | quantity          | quantity                   | number    | ✅     |
| ├─ unit            | unit              | unit                       | string    | ✅     |
| ├─ unitPrice       | unitPrice         | unitPrice                  | number?   | ✅     |
| ├─ totalPrice      | totalPrice        | totalPrice                 | number?   | ✅     |
| ├─ dosageInstructions | dosageInstructions | dosageInstructions      | string?   | ✅     |
| ├─ notes           | notes             | notes                      | string?   | ✅     |
| notes              | notes             | notes                      | string    | ✅     |
| status             | status            | status                     | string    | ✅     |
| qrCodeData         | qrCodeData        | qrCodeData                 | string    | ✅     |
| createdAt          | createdAt         | createdAt                  | string    | ✅     |
| updatedAt          | updatedAt         | updatedAt                  | string    | ✅     |
| totalAmount        | totalAmount       | totalAmount                | number?   | ✅     |
| ...                | ...               | ...                        | ...       | ✅     |

### 2. 差异清单
- 所有字段、命名、类型、嵌套结构已100%对齐，无剩余差异。

### 3. 修正说明
- 前端types(prescription.ts)已根据OrderDevPlan.md字段分层表、API文档、后端DTO逐项修正，所有主字段、嵌套字段、类型、命名、必填/可选均100%一致。
- 兼容历史字段（如prescriptionId、pdfUrl等）已保留为可选。
- 如后续有新字段/命名/类型变更，请后端同步通知，前端将第一时间review。

【END】

---

> 本文档为OrderDevPlan，后端主导每阶段发起、确认与进度记录，前端配合数据结构、交互、权限、测试等全流程对齐。所有进展、问题、修正均需在本表中及时记录，确保协作高效透明。 