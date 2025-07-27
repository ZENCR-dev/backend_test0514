# Task 5C: 业务编排服务实施计划

## 概述
**任务名称**: 业务编排服务（Orchestration Service）
**当前状态**: 0% - 未开始
**优先级**: P0（紧急）
**预估工期**: 4-6天

## 问题描述
当前系统状态"有器官无神经系统"：
- PaymentService发射事件，但无监听者
- 支付成功后订单状态无法自动更新
- 缺乏业务流程自动化

## 技术方案选择

### 方案1: NestJS EventEmitter（推荐）
**优点**:
- 与现有架构完美集成
- 实现简单，学习曲线低
- 同步/异步事件处理灵活
- 内置于NestJS框架

**实现步骤**:
1. 创建OrchestrationModule和OrchestrationService
2. 注入EventEmitter2
3. 监听payment.succeeded、payment.failed等事件
4. 实现业务逻辑处理

### 方案2: 直接服务调用（备选）
**优点**:
- 最简单直接
- 易于调试
- 无额外依赖

**缺点**:
- 服务耦合度高
- 扩展性差

## 详细实施计划

### Phase 1: 基础架构搭建（Day 1）
1. **创建OrchestrationModule**
   - 文件：`src/orchestration/orchestration.module.ts`
   - 导入EventEmitterModule
   - 配置providers和exports

2. **创建OrchestrationService**
   - 文件：`src/orchestration/services/orchestration.service.ts`
   - 注入必要的服务（OrderService、PaymentService等）
   - 设置基础日志记录

3. **定义事件接口**
   - 文件：`src/common/events/types.ts`
   - 定义所有业务事件类型
   - 确保类型安全

### Phase 2: 核心事件处理（Day 2-3）
1. **支付成功事件处理**
   ```typescript
   @OnEvent('payment.succeeded')
   async handlePaymentSucceeded(event: PaymentSucceededEvent) {
     // 1. 更新订单状态为PAID
     // 2. 记录支付信息
     // 3. 发送通知（可选）
     // 4. 错误处理和重试
   }
   ```

2. **支付失败事件处理**
   ```typescript
   @OnEvent('payment.failed')
   async handlePaymentFailed(event: PaymentFailedEvent) {
     // 1. 更新订单状态为PAYMENT_FAILED
     // 2. 释放占用的资源
     // 3. 发送失败通知
     // 4. 记录失败原因
   }
   ```

3. **订单状态变更事件**
   ```typescript
   @OnEvent('order.status.changed')
   async handleOrderStatusChanged(event: OrderStatusChangedEvent) {
     // 1. 验证状态转换合法性
     // 2. 触发后续业务流程
     // 3. 更新相关记录
   }
   ```

### Phase 3: 补偿机制和错误处理（Day 4）
1. **实现补偿事务**
   - Saga模式的简化实现
   - 失败时的自动回滚
   - 状态机管理

2. **死信队列处理**
   - 失败事件的持久化
   - 重试机制
   - 人工介入接口

3. **监控和日志**
   - 事件处理性能监控
   - 详细的审计日志
   - 异常告警机制

### Phase 4: 集成测试（Day 5-6）
1. **单元测试**
   - 每个事件处理器的独立测试
   - Mock依赖服务
   - 边界条件测试

2. **集成测试**
   - 端到端业务流程测试
   - 并发场景测试
   - 异常恢复测试

3. **性能测试**
   - 事件处理延迟测试
   - 高并发压力测试
   - 内存泄漏检测

## 具体实现步骤

### Step 1: 创建基础模块结构
```bash
src/orchestration/
├── orchestration.module.ts
├── services/
│   ├── orchestration.service.ts
│   └── orchestration.service.spec.ts
├── interfaces/
│   └── orchestration.interface.ts
└── tests/
    └── orchestration.integration.spec.ts
```

### Step 2: 实现OrchestrationService
```typescript
@Injectable()
export class OrchestrationService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly logger: Logger
  ) {}

  @OnEvent('payment.succeeded')
  async handlePaymentSucceeded(event: PaymentSucceededEvent) {
    this.logger.log(`Handling payment success for order ${event.orderId}`);
    
    try {
      // 更新订单状态
      await this.orderService.updateStatus(event.orderId, OrderStatus.PAID);
      
      // 发射订单更新事件
      this.eventEmitter.emit('order.updated', {
        orderId: event.orderId,
        status: OrderStatus.PAID,
        timestamp: new Date()
      });
      
      this.logger.log(`Order ${event.orderId} successfully updated to PAID`);
    } catch (error) {
      this.logger.error(`Failed to update order ${event.orderId}:`, error);
      // 实现重试逻辑
    }
  }
}
```

### Step 3: 更新现有服务发射事件
确保PaymentService在关键操作后发射事件：
- confirmPayment成功后发射'payment.succeeded'
- confirmPayment失败后发射'payment.failed'
- deductFromClinicAccount成功后发射'account.deducted'

## 验收标准

### 功能验收
- [ ] 支付成功后订单自动更新为PAID
- [ ] 支付失败后订单状态正确处理
- [ ] 所有关键业务事件都有对应处理器
- [ ] 异常情况能够正确恢复

### 技术验收
- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试全部通过
- [ ] 无内存泄漏
- [ ] 事件处理延迟 < 100ms

### 性能验收
- [ ] 支持1000+ TPS事件处理
- [ ] CPU使用率 < 50%
- [ ] 内存使用稳定

## 风险和缓解措施

### 风险1: 事件丢失
**缓解**: 实现事件持久化和重试机制

### 风险2: 重复处理
**缓解**: 实现幂等性检查

### 风险3: 级联失败
**缓解**: 实现断路器模式

## 时间线
- Day 1: 基础架构搭建
- Day 2-3: 核心事件处理实现
- Day 4: 补偿机制和错误处理
- Day 5-6: 测试和优化

## 交付物
1. OrchestrationModule完整实现
2. 所有事件处理器实现
3. 单元测试和集成测试
4. 性能测试报告
5. 部署和运维文档 