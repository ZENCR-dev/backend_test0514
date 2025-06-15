# Task 5: 订单支付模块 - DDD三层架构开发计划

**文档版本：** 1.0  
**创建日期：** 2025年6月13日  
**项目：** 新西兰中医药电子处方平台 MVP 1.0  
**架构模式：** 领域驱动设计（DDD）+ 接口隔离 + 事件驱动  

---
**[MODE: REVIEW] DDD架构方案深度复审完成**

## 🔍 **复审结论总结**

### ✅ **架构设计合理性**
- **DDD三层架构**：确实解决了原有耦合问题，职责分离清晰
- **NestJS CQRS支持**：官方文档确认Saga模式、事件驱动架构完全可行
- **技术选型验证**：@nestjs/cqrs提供完整的事件总线、命令总线、Saga支持

### ⚠️ **关键风险点识别**

#### **最高风险环节（按严重程度排序）**：
1. **🔴 Task 5C Saga模式实现** - 分布式事务复杂度被低估
2. **🟡 Task 5B 并发控制** - 乐观锁冲突处理、金额精度转换
3. **🟡 Task 5A 接口设计** - 影响后续所有开发的基础
4. **🟡 整体集成测试** - 三服务协调的复杂度验证

#### **时间估算风险**：
- **原估算**：5-6周 (35-42天)
- **实际建议**：6.5-7周 (45-49天)
- **主要调整**：
  - Task 5A: 1.5周 → 2周
  - Task 5B: 2周 → 2.5周
  - Task 5C: 1.5周 → 2周

#### **技术实现风险**：
- **Stripe Webhook签名验证**：安全关键，失败导致状态不同步
- **事件顺序依赖**：异步事件处理可能导致状态不一致
- **补偿事务设计**：Saga模式补偿逻辑复杂，容易遗漏场景
- **接口稳定性**：Task间依赖可能导致大量返工

### 📋 **关键成功因素**
1. **前期架构设计评审**：2-3天详细接口设计评审
2. **原型验证**：分布式事务可行性验证
3. **测试策略增强**：异常场景和并发测试时间增加
4. **团队技能要求**：需要分布式系统开发经验

### 🛡️ **风险缓解建议**
- 建立接口版本控制机制
- 实现完整Saga补偿机制
- 增加网络故障、事件风暴等测试场景
- 考虑分阶段交付策略

**总体评价**：技术先进但复杂度高的方案，需要充分的前期准备和风险控制。**建议在开始实施前进行2-3天的详细技术评审。**
---

## 🎯 架构概览

### 核心设计理念
- **领域驱动设计（DDD）**：按业务领域划分模块，而非技术层次
- **接口隔离原则**：每个模块只暴露必要的接口，实现真正解耦
- **依赖倒置原则**：高层模块依赖抽象接口，而非具体实现
- **事件驱动架构**：通过事件解耦模块间通信
- **测试驱动开发**：每个模块都有完整的独立测试策略

### 三层架构设计
```
┌─────────────────────────────────────────────────────────────┐
│                Task 5C: OrderPaymentOrchestrator           │
│                     (业务编排层)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • 订单支付流程协调                                    │   │
│  │ • 分布式事务管理                                      │   │
│  │ • 异常处理和恢复                                      │   │
│  │ • 事件驱动协调                                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────┐                    ┌─────────────────────┐
│   Task 5A:          │                    │   Task 5B:          │
│ OrderManagement     │                    │ PaymentEngine       │
│   (订单实体层)       │                    │   (支付引擎层)       │
│                     │                    │                     │
│ • 订单CRUD          │                    │ • Stripe集成        │
│ • 基础状态管理       │                    │ • 账户管理          │
│ • 数据验证          │                    │ • 并发控制          │
│ • 查询过滤          │                    │ • 幂等性保护        │
└─────────────────────┘                    └─────────────────────┘
```

---

## 📋 Task 5A: 订单实体管理服务

### 🎯 目标与职责
- **核心职责**：纯订单实体CRUD操作，无任何支付逻辑
- **设计原则**：单一职责，高内聚，低耦合
- **验收标准**：订单基础功能完全独立可用，无支付依赖

### 📅 开发时间线：1.5周 (10个工作日)

#### Phase 1: 接口设计与架构搭建 (Day 1-2) ✅ **已完成 - 2025年6月13日**

**Day 1: 接口设计** ✅ **已完成**
- ✅ **1.1 IOrderManagement接口定义** - **质量：A+**
  ```typescript
  interface IOrderManagement {
    createDraftOrder(orderData: CreateOrderDto): Promise<Order>;
    updateOrderDetails(orderId: string, updates: UpdateOrderDto): Promise<Order>;
    getOrderById(orderId: string): Promise<Order>;
    queryOrders(query: QueryOrderDto): Promise<PaginatedResult<Order>>;
    cancelDraftOrder(orderId: string): Promise<Order>;
    // 注意：不包含任何支付相关方法
  }
  ```

- ✅ **1.2 DTOs设计** - **质量：A+**
  ```typescript
  // CreateOrderDto
  class CreateOrderDto {
    practitionerId: string;
    patientId?: string;
    clinicId: string;
    patientInfo: PatientInfoDto;
    items: OrderItemDto[];
    notes?: string;
  }
  
  // UpdateOrderDto
  class UpdateOrderDto {
    patientInfo?: Partial<PatientInfoDto>;
    items?: OrderItemDto[];
    notes?: string;
  }
  
  // QueryOrderDto
  class QueryOrderDto {
    practitionerId?: string;
    clinicId?: string;
    status?: OrderStatus[];
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
  ```

**Day 2: 模块架构搭建** ✅ **已完成**
- ✅ **2.1 创建orders模块目录结构** - **质量：A+**
  ```
  src/orders/
  ├── dto/
  │   ├── create-order.dto.ts
  │   ├── update-order.dto.ts
  │   ├── query-order.dto.ts
  │   └── order-item.dto.ts
  ├── interfaces/
  │   └── order-management.interface.ts
  ├── services/
  │   └── order.service.ts
  ├── controllers/
  │   └── order.controller.ts
  ├── entities/
  │   └── order.entity.ts
  └── orders.module.ts
  ```

- ✅ **2.2 配置模块依赖注入** - **已完成**
- ✅ **2.3 集成到主应用模块** - **已完成**
- ✅ **2.4 测试框架搭建** - **质量：A+** (order.service.spec.ts, 10KB, 324行)

#### Phase 2: 核心服务实现 (Day 3-5)

**Day 3: OrderService基础实现**
- [ ] **3.1 订单创建逻辑**
  ```typescript
  async createDraftOrder(orderData: CreateOrderDto): Promise<Order> {
    // 1. 数据验证
    // 2. 生成platformOrderId
    // 3. 计算totalAmount
    // 4. 创建订单记录
    // 5. 创建订单项记录
    // 6. 返回完整订单信息
  }
  ```

- [ ] **3.2 订单查询逻辑**
  ```typescript
  async getOrderById(orderId: string): Promise<Order> {
    // 1. 权限验证
    // 2. 查询订单及关联数据
    // 3. 数据格式化返回
  }
  ```

**Day 4: 订单更新和状态管理**
- [ ] **4.1 订单更新逻辑**
  ```typescript
  async updateOrderDetails(orderId: string, updates: UpdateOrderDto): Promise<Order> {
    // 1. 状态检查（只允许DRAFT状态更新）
    // 2. 权限验证
    // 3. 数据验证
    // 4. 更新订单和订单项
    // 5. 重新计算金额
  }
  ```

- [ ] **4.2 订单取消逻辑**
  ```typescript
  async cancelDraftOrder(orderId: string): Promise<Order> {
    // 1. 状态检查（只允许DRAFT状态取消）
    // 2. 权限验证
    // 3. 更新状态为CANCELLED
    // 4. 记录操作日志
  }
  ```

**Day 5: 查询和过滤功能**
- [ ] **5.1 复杂查询实现**
  ```typescript
  async queryOrders(query: QueryOrderDto): Promise<PaginatedResult<Order>> {
    // 1. 构建查询条件
    // 2. 权限过滤
    // 3. 分页处理
    // 4. 排序处理
    // 5. 关联数据加载
  }
  ```

- [ ] **5.2 性能优化**
  - 查询索引优化
  - 分页性能优化
  - N+1查询问题解决

#### Phase 3: API控制器实现 (Day 6-7)

**Day 6: RESTful API设计**
- [ ] **6.1 OrderController实现**
  ```typescript
  @Controller('orders')
  @ApiTags('orders')
  export class OrderController {
    @Post()
    @ApiOperation({ summary: '创建草稿订单' })
    async createOrder(@Body() createOrderDto: CreateOrderDto) {}
    
    @Get(':id')
    @ApiOperation({ summary: '获取订单详情' })
    async getOrder(@Param('id') id: string) {}
    
    @Put(':id')
    @ApiOperation({ summary: '更新订单信息' })
    async updateOrder(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {}
    
    @Delete(':id')
    @ApiOperation({ summary: '取消草稿订单' })
    async cancelOrder(@Param('id') id: string) {}
    
    @Get()
    @ApiOperation({ summary: '查询订单列表' })
    async queryOrders(@Query() queryOrderDto: QueryOrderDto) {}
  }
  ```

**Day 7: API文档和验证**
- [ ] **7.1 Swagger文档完善**
- [ ] **7.2 请求验证规则**
- [ ] **7.3 错误处理机制**
- [ ] **7.4 权限控制集成**

#### Phase 4: 测试实现 (Day 8-10)

**Day 8: 单元测试**
- [ ] **8.1 OrderService单元测试**
  ```typescript
  describe('OrderService', () => {
    describe('createDraftOrder', () => {
      it('should create order with valid data');
      it('should throw error with invalid data');
      it('should calculate total amount correctly');
    });
    
    describe('updateOrderDetails', () => {
      it('should update DRAFT order successfully');
      it('should throw error for non-DRAFT order');
    });
    
    // ... 其他测试用例
  });
  ```

**Day 9: 集成测试**
- [ ] **9.1 数据库集成测试**
- [ ] **9.2 API端点测试**
- [ ] **9.3 权限验证测试**

**Day 10: 验收测试**
- [ ] **10.1 完整功能验收**
- [ ] **10.2 性能基准测试**
- [ ] **10.3 错误场景测试**
- [ ] **10.4 文档完善**

### ✅ Task 5A验收标准
- [ ] 所有订单CRUD功能正常工作
- [ ] 单元测试覆盖率 ≥ 95%
- [ ] 集成测试全部通过
- [ ] API文档完整准确
- [ ] 性能满足基准要求（查询<100ms）
- [ ] 完全独立可用，无支付依赖

---

## 📋 Task 5B: 支付引擎服务

### 🎯 目标与职责
- **核心职责**：Stripe集成 + 诊所账户管理，无订单状态操作
- **设计原则**：支付逻辑封装，并发安全，幂等性保护
- **验收标准**：支付功能完全独立可用，可Mock订单进行测试

### 📅 开发时间线：2周 (14个工作日)

#### Phase 1: Stripe集成基础 (Day 1-3)

**Day 1: Stripe环境配置**
- [ ] **1.1 Stripe依赖安装**
  ```bash
  npm install stripe@^14.0.0
  npm install @types/stripe@^8.0.0
  ```

- [ ] **1.2 环境变量配置**
  ```env
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_API_VERSION=2023-10-16
  ```

- [ ] **1.3 Stripe客户端配置**
  ```typescript
  @Injectable()
  export class StripeService {
    private stripe: Stripe;
    
    constructor() {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
        maxNetworkRetries: 3,
      });
    }
  }
  ```

**Day 2: IPaymentEngine接口设计**
- [ ] **2.1 支付引擎接口定义**
  ```typescript
  interface IPaymentEngine {
    // Stripe支付相关
    createPaymentIntent(amount: number, metadata: any): Promise<PaymentIntentResult>;
    confirmPayment(paymentIntentId: string): Promise<PaymentResult>;
    handleWebhook(webhookData: StripeWebhookEvent): Promise<void>;
    
    // 诊所账户相关
    deductFromClinicAccount(clinicId: string, amount: number, reference: string): Promise<DeductionResult>;
    refundToClinicAccount(clinicId: string, amount: number, reference: string): Promise<RefundResult>;
    
    // 查询相关
    getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
    getAccountBalance(clinicId: string): Promise<AccountBalance>;
  }
  ```

**Day 3: 模块架构搭建**
- [ ] **3.1 创建payment模块目录结构**
  ```
  src/payment/
  ├── dto/
  │   ├── payment-intent.dto.ts
  │   ├── webhook-event.dto.ts
  │   └── account-operation.dto.ts
  ├── interfaces/
  │   └── payment-engine.interface.ts
  ├── services/
  │   ├── stripe.service.ts
  │   ├── payment-engine.service.ts
  │   └── account-transaction.service.ts
  ├── controllers/
  │   ├── payment.controller.ts
  │   └── webhook.controller.ts
  └── payment.module.ts
  ```

#### Phase 2: Stripe Payment Intent实现 (Day 4-6)

**Day 4: Payment Intent创建**
- [ ] **4.1 支付意图创建逻辑**
  ```typescript
  async createPaymentIntent(amount: number, metadata: any): Promise<PaymentIntentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // 转换为分
        currency: 'nzd',
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      
      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      };
    } catch (error) {
      throw new PaymentEngineException('Failed to create payment intent', error);
    }
  }
  ```

**Day 5: 支付确认和状态跟踪**
- [ ] **5.1 支付确认逻辑**
- [ ] **5.2 支付状态查询**
- [ ] **5.3 支付失败处理**

**Day 6: Webhook事件处理**
- [ ] **6.1 Webhook签名验证**
  ```typescript
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      throw new WebhookValidationException('Invalid webhook signature');
    }
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  }
  ```

#### Phase 3: 诊所账户管理 (Day 7-9)

**Day 7: 账户扣款逻辑**
- [ ] **7.1 原子性扣款实现**
  ```typescript
  async deductFromClinicAccount(
    clinicId: string, 
    amount: number, 
    reference: string
  ): Promise<DeductionResult> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. 乐观锁查询账户
      const account = await tx.clinicAccount.findUnique({
        where: { clinicId },
      });
      
      if (!account) {
        throw new AccountNotFoundException();
      }
      
      // 2. 余额检查
      const availableBalance = account.balance.plus(account.creditLimit).minus(account.usedCredit);
      if (availableBalance.lt(amount)) {
        throw new InsufficientBalanceException();
      }
      
      // 3. 原子性更新
      const updatedAccount = await tx.clinicAccount.update({
        where: { 
          clinicId,
          version: account.version, // 乐观锁
        },
        data: {
          balance: account.balance.minus(amount),
          version: { increment: 1 },
        },
      });
      
      // 4. 记录交易
      await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          transactionType: 'DEBIT',
          amount,
          balanceBefore: account.balance,
          balanceAfter: updatedAccount.balance,
          referenceType: 'ORDER',
          referenceId: reference,
        },
      });
      
      return { success: true, newBalance: updatedAccount.balance };
    });
  }
  ```

**Day 8: 退款处理**
- [ ] **8.1 Stripe退款逻辑**
- [ ] **8.2 账户退款逻辑**
- [ ] **8.3 退款状态跟踪**

**Day 9: 并发控制和幂等性**
- [ ] **9.1 幂等性键实现**
  ```typescript
  async processPaymentWithIdempotency(
    idempotencyKey: string,
    paymentData: PaymentData
  ): Promise<PaymentResult> {
    // 1. 检查幂等性键
    const existingResult = await this.getIdempotentResult(idempotencyKey);
    if (existingResult) {
      return existingResult;
    }
    
    // 2. 处理支付
    const result = await this.processPayment(paymentData);
    
    // 3. 存储幂等性结果
    await this.storeIdempotentResult(idempotencyKey, result);
    
    return result;
  }
  ```

- [ ] **9.2 并发冲突处理**
- [ ] **9.3 重试机制实现**

#### Phase 4: API控制器和测试 (Day 10-14)

**Day 10-11: API控制器实现**
- [ ] **10.1 PaymentController**
- [ ] **10.2 WebhookController**
- [ ] **11.1 API文档和验证**

**Day 12-13: 测试实现**
- [ ] **12.1 单元测试**
  - Stripe API Mock测试
  - 账户扣款逻辑测试
  - 并发场景测试
- [ ] **13.1 集成测试**
  - Webhook处理测试
  - 端到端支付流程测试

**Day 14: 验收测试**
- [ ] **14.1 并发压力测试**
  ```typescript
  describe('Concurrent Payment Tests', () => {
    it('should handle 1000 concurrent deductions without data inconsistency', async () => {
      // 并发测试逻辑
    });
  });
  ```

### ✅ Task 5B验收标准
- [ ] Stripe集成功能完整可用
- [ ] 账户扣款并发安全（1000+并发测试通过）
- [ ] 幂等性保护100%有效
- [ ] Webhook处理稳定可靠
- [ ] 单元测试覆盖率 ≥ 95%
- [ ] 性能满足要求（扣款<200ms）

---

## 📋 Task 5C: 订单支付编排服务

### 🎯 目标与职责
- **核心职责**：业务流程协调，订单与支付的统一编排
- **设计原则**：事件驱动，分布式事务，异常恢复
- **验收标准**：完整业务流程达到P0级别，P99<500ms

### 📅 开发时间线：1.5周 (11个工作日)

#### Phase 1: 编排器架构设计 (Day 1-3)

**Day 1: IOrderPaymentOrchestrator接口设计**
- [ ] **1.1 编排器接口定义**
  ```typescript
  interface IOrderPaymentOrchestrator {
    // 核心业务流程
    initiateOrderPayment(orderId: string, paymentMethod: PaymentMethod): Promise<PaymentInitiationResult>;
    completeOrderPayment(orderId: string, paymentId: string): Promise<OrderPaymentResult>;
    
    // 异常处理
    handlePaymentFailure(orderId: string, paymentId: string, reason: string): Promise<void>;
    handlePaymentTimeout(orderId: string): Promise<void>;
    
    // 退款流程
    processOrderRefund(orderId: string, amount?: number, reason?: string): Promise<RefundResult>;
    
    // 状态查询
    getOrderPaymentStatus(orderId: string): Promise<OrderPaymentStatus>;
  }
  ```

**Day 2: 事件驱动架构设计**
- [ ] **2.1 事件定义**
  ```typescript
  // 订单事件
  export class OrderCreatedEvent {
    constructor(public readonly orderId: string, public readonly orderData: Order) {}
  }
  
  export class OrderCancelledEvent {
    constructor(public readonly orderId: string, public readonly reason: string) {}
  }
  
  // 支付事件
  export class PaymentInitiatedEvent {
    constructor(public readonly orderId: string, public readonly paymentId: string) {}
  }
  
  export class PaymentSucceededEvent {
    constructor(public readonly orderId: string, public readonly paymentId: string) {}
  }
  
  export class PaymentFailedEvent {
    constructor(public readonly orderId: string, public readonly paymentId: string, public readonly reason: string) {}
  }
  ```

- [ ] **2.2 事件处理器设计**
  ```typescript
  @EventsHandler(PaymentSucceededEvent)
  export class PaymentSucceededHandler implements IEventHandler<PaymentSucceededEvent> {
    async handle(event: PaymentSucceededEvent) {
      // 1. 更新订单状态为PAID
      // 2. 触发履约流程
      // 3. 发送通知
    }
  }
  ```

**Day 3: 状态机设计**
- [ ] **3.1 订单支付状态机**
  ```typescript
  enum OrderPaymentState {
    DRAFT = 'DRAFT',
    PAYMENT_INITIATED = 'PAYMENT_INITIATED',
    PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
    PAID = 'PAID',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    CANCELLED = 'CANCELLED',
    REFUNDED = 'REFUNDED',
  }
  
  const stateTransitions = {
    [OrderPaymentState.DRAFT]: [OrderPaymentState.PAYMENT_INITIATED, OrderPaymentState.CANCELLED],
    [OrderPaymentState.PAYMENT_INITIATED]: [OrderPaymentState.PAYMENT_PROCESSING, OrderPaymentState.PAYMENT_FAILED],
    [OrderPaymentState.PAYMENT_PROCESSING]: [OrderPaymentState.PAID, OrderPaymentState.PAYMENT_FAILED],
    [OrderPaymentState.PAID]: [OrderPaymentState.REFUNDED],
    // ... 其他状态转换
  };
  ```

#### Phase 2: 核心业务流程实现 (Day 4-7)

**Day 4: 订单支付发起流程**
- [ ] **4.1 支付发起编排**
  ```typescript
  async initiateOrderPayment(
    orderId: string, 
    paymentMethod: PaymentMethod
  ): Promise<PaymentInitiationResult> {
    return await this.executeWithSaga(async () => {
      // 1. 验证订单状态
      const order = await this.orderManagement.getOrderById(orderId);
      if (order.status !== OrderStatus.DRAFT) {
        throw new InvalidOrderStateException();
      }
      
      // 2. 创建支付意图
      const paymentIntent = await this.paymentEngine.createPaymentIntent(
        order.totalAmount,
        { orderId, paymentMethod }
      );
      
      // 3. 更新订单状态
      await this.orderManagement.updateOrderStatus(orderId, OrderStatus.PAYMENT_INITIATED);
      
      // 4. 发布事件
      await this.eventBus.publish(new PaymentInitiatedEvent(orderId, paymentIntent.id));
      
      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        status: 'initiated',
      };
    });
  }
  ```

**Day 5: 支付完成流程**
- [ ] **5.1 支付成功处理**
- [ ] **5.2 订单状态同步**
- [ ] **5.3 后续流程触发**

**Day 6: 异常处理流程**
- [ ] **6.1 支付失败处理**
  ```typescript
  async handlePaymentFailure(orderId: string, paymentId: string, reason: string): Promise<void> {
    await this.executeWithCompensation(async () => {
      // 1. 更新订单状态
      await this.orderManagement.updateOrderStatus(orderId, OrderStatus.PAYMENT_FAILED);
      
      // 2. 如果已扣款，执行退款
      const deductionRecord = await this.getDeductionRecord(orderId);
      if (deductionRecord) {
        await this.paymentEngine.refundToClinicAccount(
          deductionRecord.clinicId,
          deductionRecord.amount,
          orderId
        );
      }
      
      // 3. 发布失败事件
      await this.eventBus.publish(new PaymentFailedEvent(orderId, paymentId, reason));
    });
  }
  ```

**Day 7: 退款流程**
- [ ] **7.1 退款业务逻辑**
- [ ] **7.2 状态一致性保证**

#### Phase 3: 分布式事务和恢复机制 (Day 8-9)

**Day 8: Saga模式实现**
- [ ] **8.1 Saga事务管理器**
  ```typescript
  export class OrderPaymentSaga {
    private steps: SagaStep[] = [];
    
    async execute(): Promise<void> {
      try {
        for (const step of this.steps) {
          await step.execute();
        }
      } catch (error) {
        await this.compensate();
        throw error;
      }
    }
    
    private async compensate(): Promise<void> {
      for (let i = this.steps.length - 1; i >= 0; i--) {
        const step = this.steps[i];
        if (step.isExecuted()) {
          await step.compensate();
        }
      }
    }
  }
  ```

**Day 9: 异常恢复机制**
- [ ] **9.1 状态恢复逻辑**
- [ ] **9.2 数据一致性检查**
- [ ] **9.3 自动重试机制**

#### Phase 4: 测试和优化 (Day 10-11)

**Day 10: 集成测试**
- [ ] **10.1 端到端业务流程测试**
  ```typescript
  describe('Order Payment Orchestration E2E', () => {
    it('should complete full order payment flow successfully', async () => {
      // 1. 创建订单
      const order = await orderManagement.createDraftOrder(orderData);
      
      // 2. 发起支付
      const paymentResult = await orchestrator.initiateOrderPayment(order.id, 'stripe');
      
      // 3. 模拟支付成功
      await orchestrator.completeOrderPayment(order.id, paymentResult.paymentIntentId);
      
      // 4. 验证最终状态
      const finalOrder = await orderManagement.getOrderById(order.id);
      expect(finalOrder.status).toBe(OrderStatus.PAID);
    });
  });
  ```

**Day 11: 性能测试和优化**
- [ ] **11.1 并发性能测试**
- [ ] **11.2 响应时间优化**
- [ ] **11.3 资源使用优化**

### ✅ Task 5C验收标准
- [ ] 完整业务流程端到端可用
- [ ] 异常处理和恢复机制完善
- [ ] 分布式事务一致性保证
- [ ] 性能达到P99<500ms
- [ ] 1000+并发测试通过
- [ ] 事件驱动架构稳定运行

---

## 🎯 整体验收标准

### P0级别要求
- [ ] **架构清晰**：三层架构职责分离，接口抽象完善
- [ ] **并发安全**：1000并发下无数据不一致
- [ ] **支付安全**：零重复扣款、零负余额
- [ ] **性能要求**：P99<500ms
- [ ] **测试覆盖率**：≥95%
- [ ] **业务完整性**：端到端业务流程100%可用

### 技术债务控制
- [ ] 代码质量：ESLint检查通过
- [ ] 类型安全：TypeScript严格模式
- [ ] 文档完整：API文档和架构文档
- [ ] 监控就绪：日志和性能监控

### 部署准备
- [ ] 环境配置：开发、测试、生产环境
- [ ] 数据库迁移：Prisma迁移脚本
- [ ] 依赖管理：package.json和lock文件
- [ ] CI/CD集成：自动化测试和部署

---

**文档维护**：本文档将在开发过程中持续更新，记录实际进度和遇到的技术挑战。 