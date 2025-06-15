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
│ OrderManagement     │                    │   (支付引擎层)       │
│   (订单实体层)       │                    │ • Stripe集成        │
│                     │                    │ • 账户管理          │
│ • 订单CRUD          │                    │ • 并发控制          │
│ • 基础状态管理       │                    │ • 幂等性保护        │
│ • 数据验证          │                    │                     │
│ • 查询过滤          │                    │                     │
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

#### Phase B1: 环境配置与基础设施 (Day 3-4) ✅ **已完成 - 2025年6月15日**

**Phase B1 成果总结**:
- ✅ **ENV-01: 环境配置验证** - Stripe、Supabase、JWT、MCP配置全部验证通过
- ✅ **ENV-02: 依赖库安装** - NestJS、Prisma、Stripe、MCP服务器全部安装配置
- ✅ **ENV-03: 模块结构创建** - PaymentModule成功集成，API端点正常工作
- ✅ **Stripe CLI配置** - 本地webhook监听器正常运行
- ✅ **MCP服务器验证** - 7个MCP服务器全部正常工作
- ✅ **Webhook处理修复** - 修复payload验证错误，增强错误处理

**关键问题解决记录**:
1. **Stripe CLI安装问题** - 解决Windows环境下CLI安装和PATH配置
2. **Webhook配置策略** - 采用本地CLI方案替代Dashboard配置
3. **PaymentModule路由冲突** - 修复API版本控制导致的路由重复
4. **Raw Body解析配置** - 为webhook端点配置正确的body解析器
5. **MCP服务器依赖** - 解决部分MCP服务器的模块依赖问题

**开发环境状态**: **100%就绪** - 可立即开始Phase B2的Stripe集成开发

#### Phase B2: Stripe集成核心功能开发 (Day 5-7) 🚀 **准备开始**

**Phase B2 开发计划**:
- **Day 5**: Stripe支付意图创建和确认功能实现
- **Day 6**: Webhook事件处理和诊所账户扣款功能
- **Day 7**: 退款处理功能和集成测试

**技术准备状态**:
- ✅ **Stripe CLI**: 本地webhook监听器正常运行
- ✅ **PaymentModule**: 已集成到应用，API端点正常
- ✅ **Webhook处理**: 错误修复完成，事件处理就绪
- ✅ **CI/CD**: 代码质量检查通过（0错误）
- ✅ **MCP服务器**: 7个服务器验证正常

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

## 📋 Task 5B: 支付引擎服务 ✅ **PLAN & REVIEW 完成 - 准备EXECUTE**

**优先级：** P0  
**预估时间：** 2.5周 (17个工作日, 136工时)  
**职责范围：** Stripe集成 + 诊所账户管理，无订单状态操作  
**计划开始日期：** 2025年6月15日  
**预计完成日期：** 2025年7月6日  
**当前阶段：** REVIEW模式完成 ✅，等待EXECUTE模式批准

**🎯 Task 5B开发策略（基于用户明确技术决策）**：
- **DDD架构原则**：严格职责分离，支付引擎独立于订单管理
- **6阶段RIPER流程**：Research ✅ → Innovate ✅ → Plan ✅ → **Review ✅** → Execute 📋 → Final Review 📋
- **TDD开发流程**：测试驱动开发，确保支付安全性
- **并发安全重点**：乐观锁 + 事务 + 幂等性保护
- **分阶段交付**：每2-3天一个里程碑，持续用户验证

##### ✅ **REVIEW阶段审查总结**（2025年6月15日完成）：

**🔍 审查结论**：
- ✅ **总体计划可行，建议批准执行**
- ⚠️ **条件**：需要补充数据库验证、错误处理策略、测试覆盖增强3个修正项目
- 🎯 **风险评估**：识别5个关键风险点，已制定相应缓解策略
- 📊 **时间合理性**：11-15天实际工期符合2.5周预期

**📋 关键审查发现**：
1. **高风险项**：ClinicAccountService修复的向后兼容性
2. **中风险项**：EventEmitter异常处理、Stripe Mock真实性  
3. **遗漏补充**：数据库迁移计划、监控策略、配置管理细节

**🔧 批准执行的前置条件**：
- 💡 **A1级前置修复**：ClinicAccountService乐观锁机制完善（P0级）
- 💡 **A2级前置修复**：OrderService事件发布点集成（P0级）
- 💡 **技术决策确认**：EventEmitter替代CQRS、Mock+CLI混合Stripe策略

##### 🔄 **调整后RIPER模式序列**（17个工作日）
- **RESEARCH模式**（2天）：Stripe API深度研究、支付安全最佳实践、并发控制方案调研
- **INNOVATE模式**（1天）：支付架构方案设计、技术选型评估、安全策略制定
- **PLAN模式**（2天）：详细开发计划制定、任务分解、风险缓解策略
- **🆕 REVIEW模式**（1天）：**方案审核 + 前置检查清单验证 + 用户批准**
- **EXECUTE模式**（10天）：TDD开发实施、分阶段交付、持续验证
- **FINAL REVIEW模式**（1天）：代码审查、性能测试、安全审计、最终验收

##### 📊 **5阶段详细工时预估**（总计136工时）

**阶段1：基础架构搭建**（24工时，3天）
- **ENV-01** 环境配置验证：4工时
  - Stripe API密钥配置验证
  - Webhook端点配置测试
  - 开发/生产环境分离确认
- **ENV-02** 依赖库安装与配置：4工时
  - stripe@^14.0.0安装与类型定义
  - 版本兼容性验证
  - 配置文件结构建立
- **ENV-03** 模块结构创建：8工时
  - payment模块目录结构
  - dto/、interfaces/、services/目录创建
  - 模块依赖注入配置
- **ENV-04** 基础服务接口设计：8工时
  - IPaymentEngine接口定义
  - 核心DTO类型设计
  - 异常类层次结构

**阶段2：Stripe核心集成**（32工时，4天）
- **STRIPE-01** Payment Intent基础实现：8工时
  - createPaymentIntent方法实现
  - 金额转换和验证逻辑
  - 基础错误处理机制
- **STRIPE-02** 支付确认与状态管理：8工时
  - confirmPayment方法实现
  - 支付状态跟踪逻辑
  - 状态同步机制
- **STRIPE-03** Webhook事件处理：8工时
  - 签名验证实现
  - 事件类型分发逻辑
  - 异步事件处理
- **STRIPE-04** 错误处理与重试机制：8工时
  - 指数退避重试逻辑
  - API限流处理
  - 错误分类和恢复策略

**阶段3：账户管理核心**（32工时，4天）
- **ACCOUNT-01** 乐观锁并发控制：10工时
  - 乐观锁机制实现
  - 版本冲突处理
  - 并发重试策略
- **ACCOUNT-02** 余额扣款原子操作：10工时
  - 原子性扣款事务
  - 余额不足检查
  - 事务回滚机制
- **ACCOUNT-03** 退款处理逻辑：8工时
  - Stripe退款API集成
  - 账户退款逻辑
  - 退款状态跟踪
- **ACCOUNT-04** 账户事务记录：4工时
  - 交易记录创建
  - 审计日志格式
  - 查询优化

**阶段4：安全机制实现**（24工时，3天）
- **SECURITY-01** 幂等性保护机制：8工时
  - 幂等性键生成和验证
  - 重复操作检测
  - 幂等结果缓存
- **SECURITY-02** 重复支付检测：6工时
  - 重复检测算法
  - 支付去重逻辑
  - 异常情况处理
- **SECURITY-03** 权限验证与审计：6工时
  - RBAC权限集成
  - 操作审计日志
  - 敏感数据保护
- **SECURITY-04** PCI合规性检查：4工时
  - 数据处理合规验证
  - 传输加密确认
  - 安全配置检查

**阶段5：测试与验证**（24工时，3天）
- **TEST-01** 单元测试实现：8工时
  - 核心逻辑单元测试
  - Mock外部依赖
  - 测试覆盖率验证
- **TEST-02** 集成测试与Stripe模拟：8工时
  - Stripe API集成测试
  - Webhook处理测试
  - 端到端支付流程
- **TEST-03** 并发压力测试：4工时
  - 1000+并发账户操作
  - 数据一致性验证
  - 性能基准测试
- **TEST-04** 安全测试与验收：4工时
  - 安全机制验证
  - 渗透测试基础
  - 最终验收确认

##### 🔍 **REVIEW模式前置检查清单**

**技术环境检查**
- [ ] **Stripe API密钥**：测试环境Secret Key、Publishable Key获取确认
- [ ] **Webhook配置**：Webhook Secret配置，端点URL设置
- [ ] **依赖版本**：stripe@^14.0.0兼容性验证
- [ ] **TypeScript配置**：严格模式、类型定义完整性
- [ ] **数据库表**：clinic_accounts、account_transactions结构验证

**架构完整性检查**
- [ ] **DDD边界**：与Task 5A、5C的接口边界明确定义
- [ ] **事件总线**：NestJS EventBus配置验证
- [ ] **配置服务**：ConfigService环境变量加载测试
- [ ] **Prisma服务**：数据库连接池配置验证
- [ ] **日志系统**：审计日志输出格式验证

**安全合规检查**
- [ ] **PCI DSS**：敏感数据处理流程合规性
- [ ] **加密传输**：HTTPS/TLS配置验证
- [ ] **密钥管理**：环境变量安全存储确认
- [ ] **审计需求**：所有资金操作可追溯性验证
- [ ] **权限控制**：RBAC集成确认

##### 🛡️ **严格职责边界**（DDD架构要求）
**允许实现：**
- ✅ Stripe支付集成和状态管理
- ✅ 诊所账户余额操作和事务记录
- ✅ 支付安全机制和并发控制
- ✅ Webhook事件处理和验证

**严格禁止：**
- ❌ 直接操作订单状态（Task 5C职责）
- ❌ 包含业务流程逻辑（Task 5C职责）
- ❌ 直接调用订单管理接口（通过事件通信）

##### 🧪 **TDD测试策略**
- **单元测试**：每个方法独立测试，Mock外部依赖，目标覆盖率≥95%
- **集成测试**：Stripe API真实交互（测试环境），Webhook处理验证
- **并发测试**：1000+并发账户操作，数据一致性验证
- **安全测试**：幂等性、重复支付检测、权限验证全覆盖
- **人在循环验证**：每阶段完成后用户功能确认

##### 📝 **文档更新循环机制**
**每阶段文档更新要求：**
1. **阶段开始前**：更新开发计划文档，明确当前阶段目标
2. **阶段执行中**：实时更新进度和遇到的问题
3. **阶段完成后**：更新完成状态、经验教训、下阶段调整

**文档同步点：**
- `Task5_DDD_Architecture_Development_Plan.md`：技术实现细节
- `DEVELOPMENT_PROGRESS_TRACKER.md`：整体进度追踪
- `SOPv2.0_DDD_Architecture_MVP1.0.md`：规范性标准更新

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