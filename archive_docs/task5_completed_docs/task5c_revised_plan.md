# Task 5C 修订版开发指南 - 渐进式架构方案

## 一、问题根因与修正策略

### 1.1 原方案问题分析
- **过度复杂**：@nestjs/cqrs + Saga模式增加了不必要的复杂性
- **WebSocket集成不当**：缺少明确的Gateway实现和连接管理
- **认证机制缺失**：WebSocket连接和API调用的认证策略不一致
- **事件处理逻辑混乱**：同步/异步事件处理方式不统一

### 1.2 修正原则
1. **简化优先**：使用NestJS原生EventEmitter2，避免引入CQRS
2. **认证统一**：WebSocket和REST API使用相同的JWT认证机制
3. **渐进实现**：分阶段实现功能，确保每个阶段都可以独立测试
4. **测试驱动**：每个功能都先编写测试用例

## 二、修订版技术架构

### 2.1 核心架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用      │    │   API Gateway   │    │  业务编排层     │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │WebSocket    │◄┼────┼─│WebSocket    │◄┼────┼─│Orchestrator │ │
│ │Client       │ │    │ │Gateway      │ │    │ │Service      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │       ▲         │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │       │Events   │
│ │HTTP Client  │◄┼────┼─│REST API     │ │    │       │         │
│ └─────────────┘ │    │ └─────────────┘ │    │ ┌─────▼─────┐   │
└─────────────────┘    └─────────────────┘    │ │Event      │   │
                                              │ │Emitter    │   │
                       ┌─────────────────┐    │ └───────────┘   │
                       │  领域服务层     │    └─────────────────┘
                       │                 │             ▲
                       │ ┌─────────────┐ │             │
                       │ │Order        │◄┼─────────────┘
                       │ │Service      │ │
                       │ └─────────────┘ │
                       │                 │
                       │ ┌─────────────┐ │
                       │ │Payment      │ │
                       │ │Service      │ │
                       │ └─────────────┘ │
                       │                 │
                       │ ┌─────────────┐ │
                       │ │Prescription │ │
                       │ │Service      │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

### 2.2 关键组件设计

#### A. WebSocket Gateway (新增)
```typescript
@WebSocketGateway({
  path: '/ws/orchestration',
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000' },
  transports: ['websocket']
})
export class OrchestrationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  // JWT认证中间件
  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    // 验证JWT token
    // 存储client连接信息
  }
  
  // 广播事件到前端
  broadcastEvent(eventName: string, data: any) {
    this.server.emit(eventName, data);
  }
}
```

#### B. 简化版Orchestrator Service
```typescript
@Injectable()
export class OrderPaymentOrchestrator {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly gateway: OrchestrationGateway,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly prescriptionService: PrescriptionService
  ) {}

  @OnEvent('payment.succeeded')
  async handlePaymentSucceeded(event: PaymentSucceededEvent) {
    try {
      // 1. 更新订单状态
      await this.orderService.updateStatus(event.orderId, 'PAID');
      
      // 2. 通知前端
      this.gateway.broadcastEvent('order.status.updated', {
        orderId: event.orderId,
        status: 'PAID'
      });
      
      // 3. 记录日志
      Logger.log(`Order ${event.orderId} marked as PAID`);
    } catch (error) {
      // 异常处理和补偿逻辑
      await this.handlePaymentCompensation(event);
    }
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(event: PaymentFailedEvent) {
    // 支付失败处理逻辑
  }
}
```

## 三、分阶段实现计划

### 阶段1：基础设施修复 (Day 1)
**目标**：修复认证和WebSocket连接问题

#### 1.1 认证机制修复
- [ ] 检查JWT中间件配置
- [ ] 确保token正确传递到API请求头
- [ ] 实现WebSocket JWT认证
- [ ] 添加token刷新机制

#### 1.2 WebSocket Gateway实现
- [ ] 创建`src/orchestration/gateways/orchestration.gateway.ts`
- [ ] 实现JWT认证中间件
- [ ] 添加连接管理逻辑
- [ ] 测试WebSocket连接

#### 1.3 验收标准
- [ ] 前端可以成功连接WebSocket：`ws://localhost:3001/ws/orchestration`
- [ ] API调用返回200而不是401
- [ ] 可以在浏览器开发者工具中看到WebSocket连接建立成功

### 阶段2：简化版事件编排 (Day 1-2)
**目标**：实现基础的事件监听和处理

#### 2.1 Orchestrator Service实现
- [ ] 创建`src/orchestration/services/orchestrator.service.ts`
- [ ] 实现基础事件监听器（payment.succeeded, payment.failed, order.created）
- [ ] 添加事件广播到WebSocket功能
- [ ] 实现基础的异常处理

#### 2.2 事件类型定义
- [ ] 创建`src/common/events/types.ts`统一事件类型
- [ ] 定义PaymentSucceededEvent, PaymentFailedEvent等接口
- [ ] 确保类型安全

#### 2.3 验收标准
- [ ] 支付成功后前端实时收到订单状态更新
- [ ] 浏览器控制台可以看到WebSocket消息
- [ ] 事件处理失败时有错误日志

### 阶段3：业务流程集成 (Day 2-3)
**目标**：完整的支付-订单-处方流程自动化

#### 3.1 完整业务流程
- [ ] 实现订单创建→支付→状态更新→处方生成的完整流程
- [ ] 添加业务规则验证
- [ ] 实现状态机模式管理订单状态

#### 3.2 异常处理和补偿
- [ ] 支付失败自动回滚订单状态
- [ ] 网络异常重试机制
- [ ] 死信队列处理无法处理的事件

#### 3.3 验收标准
- [ ] 端到端测试：创建处方→生成订单→支付→状态同步
- [ ] 异常场景测试：支付失败、网络异常等
- [ ] 性能测试：并发处理能力

### 阶段4：监控和优化 (Day 3-4)
**目标**：生产环境准备

#### 4.1 监控和日志
- [ ] 添加业务指标监控
- [ ] 完善错误日志记录
- [ ] 实现健康检查接口

#### 4.2 性能优化
- [ ] WebSocket连接池管理
- [ ] 事件处理性能优化
- [ ] 数据库查询优化

## 四、关键技术决策

### 4.1 技术栈简化
- **放弃**：@nestjs/cqrs, Saga模式
- **采用**：NestJS原生EventEmitter2 + WebSocket Gateway
- **原因**：降低复杂度，提高开发效率和系统稳定性

### 4.2 认证策略统一
- **REST API**：JWT Bearer Token in Authorization Header
- **WebSocket**：JWT Token in connection handshake auth
- **Token刷新**：前端自动处理token过期和刷新

### 4.3 事件处理模式
- **同步事件**：使用`eventEmitter.emit()`用于不需要等待结果的场景
- **异步事件**：使用`eventEmitter.emitAsync()`用于需要等待处理完成的场景
- **错误处理**：所有事件处理器都需要try-catch包装

## 五、风险控制和应急方案

### 5.1 技术风险
- **WebSocket连接不稳定**：实现断线重连机制
- **事件处理性能问题**：添加事件队列和批处理
- **内存泄漏**：定期清理过期的WebSocket连接

### 5.2 业务风险
- **数据一致性问题**：添加幂等性检查和事务控制
- **支付状态同步延迟**：实现主动轮询作为备选方案
- **高并发处理**：使用Redis作为事件存储和锁机制

### 5.3 应急方案
- **WebSocket失败**：降级到HTTP轮询
- **事件处理失败**：手动触发补偿机制
- **系统过载**：启用限流和熔断机制

## 六、测试策略

### 6.1 单元测试
- Orchestrator Service的每个事件处理器
- WebSocket Gateway的连接和认证逻辑
- 事件类型定义和数据校验

### 6.2 集成测试
- 完整的支付-订单-处方流程
- WebSocket消息传递
- 异常场景和补偿逻辑

### 6.3 端到端测试
- 前端到后端的完整用户场景
- 并发处理能力测试
- 长连接稳定性测试

## 七、部署和监控

### 7.1 部署要求
- 确保WebSocket端口（3001）在防火墙中开放
- 配置负载均衡器支持WebSocket Sticky Session
- 设置合适的WebSocket连接超时时间

### 7.2 监控指标
- WebSocket连接数和状态
- 事件处理延迟和错误率
- 业务流程完成率和异常率

### 7.3 告警规则
- WebSocket连接失败率 > 5%
- 事件处理延迟 > 1秒
- 业务流程异常率 > 1%

---

**总结**：本修订版方案通过简化技术栈、统一认证机制、分阶段实现和完善测试策略，解决了原方案中的关键问题，确保Task 5C能够稳定可靠地实现业务编排功能。