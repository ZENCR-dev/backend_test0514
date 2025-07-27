# MVP 2.1 - 医师端后端开发规范和实施指南

## 📋 文档概述

本文档基于详细的项目代码分析，为医师端后端开发提供具体的技术规范、最佳实践和开发指导。基于现有NestJS架构，遵循DDD设计原则和事件驱动架构模式。

**文档版本**：2.0  
**最后更新**：2025年7月10日  
**基于架构**：NestJS + Prisma + PostgreSQL  
**预计工期**：3-4周

## 🏗️ 现有架构分析

### 技术栈配置
- **框架**: NestJS v11.1.3 (已配置)
- **数据库**: PostgreSQL + Prisma ORM v6.9.0
- **认证**: JWT + Passport.js (已实现)
- **实时通信**: Socket.IO v4.8.1 (业务编排模块)
- **支付**: Stripe v14.25.0 (支付引擎已实现)
- **API文档**: Swagger v11.2.0 (已配置)
- **测试**: Jest v29.7.0 (已配置)

### 现有模块结构
```
src/
├── auth/                    # ✅ 认证模块 (完整)
├── user/                    # ✅ 用户管理 (完整)
├── practitioner-account/    # ⚠️ 医师账户 (Service完整，Controller待完善)
├── medicines/              # ✅ 药品管理 (完整)
├── orders/                 # ✅ 订单管理 (完整)
├── payment/                # ✅ 支付引擎 (完整)
├── orchestration/          # ✅ 业务编排 (WebSocket支持)
├── modules/prescriptions/  # ⚠️ 处方模块 (基础架构，待完善)
└── common/                 # ✅ 公共组件 (完整)
```

---

## 🎯 基于现有架构的开发任务

### 1. 完善医师账户管理 (practitioner-account模块)

#### 1.1 实现Controller API端点
**当前状态**: PractitionerAccountService已完整实现，Controller方法待完善

**需要实现的API端点**:
```typescript
// 基于现有Service，实现以下Controller方法
@Get("balance")
async getBalance(@CurrentUser() user: any) {
  return await this.practitionerAccountService.getBalance(user.id);
}

@Get("transactions")
async getTransactionHistory(@CurrentUser() user: any, @Query() query: any) {
  return await this.practitionerAccountService.getTransactionHistory(
    user.id, query.limit, query.offset
  );
}

@Get("info")
async getAccountInfo(@CurrentUser() user: any) {
  return await this.practitionerAccountService.getAccountWithVersion(user.id);
}

@Post("recharge")
async rechargeAccount(@CurrentUser() user: any, @Body() dto: RechargeDto) {
  // 集成现有支付引擎
  return await this.paymentService.createPaymentIntent({
    amount: dto.amount,
    practitionerId: user.id,
    currency: "NZD"
  });
}
```

#### 1.2 创建DTO类
```typescript
// src/practitioner-account/dto/recharge.dto.ts
export class RechargeDto {
  @IsNumber()
  @Min(10)
  @Max(10000)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string = "NZD";
}

// src/practitioner-account/dto/transaction-query.dto.ts
export class TransactionQueryDto {
  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;

  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
```

### 2. 增强处方模块 (modules/prescriptions)

#### 2.1 基于现有架构扩展
**当前状态**: 基础架构已存在，需要增强业务逻辑

**核心实现**:
```typescript
// src/modules/prescriptions/services/prescriptions.service.ts
@Injectable()
export class PrescriptionsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private qrCodeService: QrCodeService
  ) {}

  async createPrescription(dto: CreatePrescriptionDto, practitionerId: string) {
    // 利用现有事务机制
    return await this.prisma.$transaction(async (tx) => {
      // 验证药品存在性
      const medicines = await tx.medicine.findMany({
        where: { id: { in: dto.medicines.map(m => m.medicineId) } }
      });

      // 计算总金额
      const totalAmount = this.calculateTotalAmount(dto.medicines, medicines);

      // 创建处方
      const prescription = await tx.prescription.create({
        data: {
          practitionerId,
          medicines: dto.medicines,
          totalAmount,
          status: 'created',
          // 利用现有QR码服务
          qrCode: await this.qrCodeService.generate(prescriptionId)
        }
      });

      // 发布事件 (利用现有事件系统)
      this.eventEmitter.emit('prescription.created', {
        prescriptionId: prescription.id,
        practitionerId,
        totalAmount
      });

      return prescription;
    });
  }
}
```

#### 2.2 集成现有订单系统
```typescript
// 将处方转换为订单 (利用现有OrderService)
async submitPrescriptionAsOrder(prescriptionId: string, practitionerId: string) {
  const prescription = await this.getPrescription(prescriptionId);
  
  // 使用现有OrderService创建订单
  const orderDto = this.convertPrescriptionToOrder(prescription);
  return await this.orderService.createOrder(orderDto);
}
```

### 3. 集成现有支付引擎

#### 3.1 余额支付实现
**利用现有PractitionerAccountService**:
```typescript
// src/payment/services/prescription-payment.service.ts
@Injectable()
export class PrescriptionPaymentService {
  constructor(
    private practitionerAccountService: PractitionerAccountService,
    private paymentService: PaymentService
  ) {}

  async payWithBalance(prescriptionId: string, practitionerId: string) {
    const prescription = await this.getPrescription(prescriptionId);
    
    // 使用现有账户服务扣款
    const transaction = await this.practitionerAccountService.deductBalance(
      practitionerId,
      prescription.totalAmount,
      prescriptionId,
      `处方支付: ${prescriptionId}`
    );

    // 更新处方状态
    await this.updatePrescriptionStatus(prescriptionId, 'paid');
    
    return transaction;
  }
}
```

#### 3.2 Stripe充值集成
**利用现有PaymentService**:
```typescript
// 直接使用现有支付引擎的createPaymentIntent方法
async createRechargeIntent(practitionerId: string, amount: number) {
  return await this.paymentService.createPaymentIntent({
    amount: new Decimal(amount),
    practitionerId,
    currency: "NZD",
    referenceType: "RECHARGE"
  });
}
```

### 4. 实现WebSocket状态通知

#### 4.1 利用现有业务编排模块
**当前状态**: OrchestrationService和Gateway已完整实现

**集成示例**:
```typescript
// 在处方支付完成后发送WebSocket通知
async payPrescription(prescriptionId: string, practitionerId: string) {
  const result = await this.payWithBalance(prescriptionId, practitionerId);
  
  // 发布事件，业务编排模块自动处理WebSocket通知
  this.eventEmitter.emit('prescription.payment.completed', {
    prescriptionId,
    practitionerId,
    status: 'paid',
    timestamp: new Date().toISOString()
  });
  
  return result;
}
```

### 5. 公共API实现

#### 5.1 利用现有Medicines模块
**当前状态**: MedicinesService已完整实现搜索功能

**公共API实现**:
```typescript
// src/medicines/medicines.controller.ts
@Get("public")
@ApiOperation({ summary: "公共药品查询 - 无需认证" })
async getPublicMedicines(@Query() query: FindMedicinesDto) {
  // 复用现有搜索逻辑，但过滤价格信息
  const result = await this.medicinesService.findAll(query);
  return this.filterPriceInformation(result);
}

private filterPriceInformation(result: any) {
  return {
    ...result,
    data: result.data.map(medicine => ({
      ...medicine,
      basePrice: undefined // 移除价格信息
    }))
  };
}
```

## 🛠️ 最佳开发实践

### 1. 基于现有架构的开发规范

#### 1.1 遵循现有模块结构
```typescript
// 标准模块结构 (参考现有auth模块)
src/module-name/
├── dto/                    # 数据传输对象
├── interfaces/            # 接口定义
├── services/              # 业务逻辑
├── controllers/           # API控制器
├── guards/               # 权限守卫
├── decorators/           # 自定义装饰器
└── module-name.module.ts  # 模块定义
```

#### 1.2 依赖注入最佳实践
```typescript
// 正确的依赖注入 (参考现有OrderService)
@Injectable()
export class PrescriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly practitionerAccountService: PractitionerAccountService
  ) {}
}
```

### 2. 数据库操作规范

#### 2.1 使用现有事务机制
```typescript
// 参考现有PractitionerAccountService的事务实现
async createPrescriptionWithPayment(dto: CreatePrescriptionDto, practitionerId: string) {
  return await this.prisma.$transaction(async (tx) => {
    // 创建处方
    const prescription = await tx.prescription.create({...});
    
    // 扣款操作
    await this.practitionerAccountService.deductBalance(
      practitionerId, prescription.totalAmount, prescription.id
    );
    
    return prescription;
  }, {
    maxWait: 5000,
    timeout: 10000
  });
}
```

#### 2.2 乐观锁控制
```typescript
// 参考现有账户服务的乐观锁实现
async updatePrescriptionStatus(prescriptionId: string, status: string) {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      return await this.prisma.prescription.update({
        where: { id: prescriptionId, version: currentVersion },
        data: { status, version: { increment: 1 } }
      });
    } catch (error) {
      if (error.code === "P2025") {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          throw new ConflictException("更新冲突，请重试");
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
      } else {
        throw error;
      }
    }
  }
}
```

### 3. 错误处理规范

#### 3.1 统一异常处理
```typescript
// 参考现有PractitionerAccountService的错误处理
try {
  // 业务逻辑
} catch (error) {
  this.logger.error(`Operation failed: ${error.message}`, error);
  
  if (error instanceof BadRequestException) {
    throw error;
  }
  
  throw new InternalServerErrorException(`操作失败: ${error.message}`);
}
```

### 4. 事件驱动集成

#### 4.1 利用现有事件系统
```typescript
// 事件发布 (参考现有OrderService)
this.eventEmitter.emit('prescription.created', {
  prescriptionId: prescription.id,
  practitionerId,
  totalAmount: prescription.totalAmount
});

// 事件监听 (参考现有OrchestrationService)
@OnEvent('prescription.payment.completed')
async handlePrescriptionPayment(payload: PrescriptionPaymentEvent) {
  // 通过WebSocket通知前端
  this.orchestrationGateway.broadcastToUser(
    payload.practitionerId,
    'prescription.payment.completed',
    payload
  );
}
```

## 🧪 测试规范

### 1. 基于现有测试框架

#### 1.1 单元测试 (Jest)
```typescript
// 参考现有测试文件结构
describe('PrescriptionService', () => {
  let service: PrescriptionService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter }
      ],
    }).compile();

    service = module.get<PrescriptionService>(PrescriptionService);
  });

  it('should create prescription successfully', async () => {
    // 测试实现
  });
});
```

#### 1.2 集成测试 (SuperTest)
```typescript
// 参考现有契约测试
describe('Prescription API Integration', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('POST /api/v1/prescriptions should create prescription', () => {
    return request(app.getHttpServer())
      .post('/api/v1/prescriptions')
      .send(createPrescriptionDto)
      .expect(201);
  });
});
```

### 2. 测试覆盖率要求
- 单元测试覆盖率 > 85%
- 集成测试覆盖所有API端点
- 业务逻辑分支覆盖率 > 90%

## 🎯 下一步开发计划（2025年1月9日制定）

### 优先级1：处方支付集成 (立即开始)

#### 任务1.1：创建PrescriptionPaymentService
```typescript
// 文件位置：src/modules/prescriptions/services/prescription-payment.service.ts
需要实现的方法：
- payWithBalance(prescriptionId: string, practitionerId: string)
- payWithStripe(prescriptionId: string, practitionerId: string)
- updatePrescriptionPaymentStatus(prescriptionId: string, status: string)
```

#### 任务1.2：添加处方支付API端点
```typescript
// 文件位置：src/modules/prescriptions/prescriptions.controller.ts
需要添加的端点：
- POST /api/v1/prescriptions/:id/pay-with-balance
- POST /api/v1/prescriptions/:id/pay-with-stripe
- GET /api/v1/prescriptions/:id/payment-status
```

#### 任务1.3：集成测试
- 编写处方支付流程集成测试
- 测试余额不足场景
- 测试Stripe支付失败场景

### 优先级2：统一API路由 (次要)

#### 任务2.1：更新处方模块路由
```typescript
// 当前：@Controller("prescriptions")
// 目标：@Controller("api/v1/prescriptions")
```

#### 任务2.2：确保路由一致性
- 检查所有Controller的路由前缀
- 更新API文档中的路由

### 优先级3：公共药品API (最后)

#### 任务3.1：实现公共药品查询
```typescript
// 文件位置：src/medicines/medicines.controller.ts
需要添加的端点：
- GET /api/v1/medicines/public (无需认证)
```

#### 任务3.2：过滤敏感信息
- 移除价格信息
- 移除供应商信息
- 保留基本药品信息

## 📋 开发进度记录

### Phase 1: API响应格式标准化 ✅ **已完成**

### Phase 2: 系统增强和监控体系 🔄 **进行中**

#### Day 1: 实时通知系统规范化 ✅ **已完成** (2025-01-09)
**技术成就:**
- ✅ 标准化WebSocket事件格式与API响应格式完全一致
- ✅ 实现WebSocket事件发射器服务统一事件生成机制
- ✅ 创建标准化事件处理器智能路由和处理逻辑
- ✅ 完成11个集成测试，100%覆盖率验证
- ✅ 与现有OrchestrationGateway(3046行)无缝集成

**实现文件:**
- `src/common/events/standard-websocket-events.dto.ts` - 标准事件类型定义
- `src/common/services/websocket-event-emitter.service.ts` - 事件发射器
- `src/orchestration/services/standard-websocket-handler.service.ts` - 事件处理器
- `src/orchestration/__tests__/standard-websocket-integration.spec.ts` - 集成测试
- `docs/api/websocket-events-specification.md` - 完整规范文档

#### Day 2: 实时性能监控仪表板 ✅ **已完成** (2025-01-09)
**技术成就:**
- ✅ 实时性能监控服务 - 完整的性能数据收集和分析
- ✅ WebSocket实时通知 - 性能警告和统计数据实时推送
- ✅ 可视化HTML仪表板 - 美观的实时性能监控界面
- ✅ 增强型中间件 - 无缝集成现有性能监控基础设施
- ✅ 完整集成测试 - 验证所有核心功能

**核心功能:**
- 性能指标实时收集 (1000条缓冲区)
- 智能阈值检测 (500ms警告, 1000ms严重)
- 系统健康评估 (excellent/good/warning/critical)
- P95/P99响应时间计算
- 实时WebSocket性能事件广播

**实现文件:**
- `src/common/services/realtime-performance-monitor.service.ts` - 核心监控服务
- `src/common/middleware/enhanced-performance-monitoring.middleware.ts` - 增强中间件
- `src/common/controllers/performance-dashboard.controller.ts` - 仪表板控制器
- `src/common/__tests__/realtime-performance-monitor.integration.spec.ts` - 集成测试
- `docs/Phase2-Day2-Performance-Dashboard-Report.md` - 完整实施报告

**立即可用:**
- 仪表板访问: `http://localhost:4000/dashboard/performance`
- API数据端点: `GET /dashboard/performance/api`
- 实时WebSocket性能通知

#### Day 3: 公共药品API开发 ✅ **已完成** (2025-01-09)
**技术成就:**
- ✅ 公共药品搜索API - 无需认证的药品搜索接口
- ✅ 药品分类API - 获取所有可用分类列表
- ✅ 热门药品API - 基于创建时间的热门药品推荐
- ✅ 搜索建议API - 实时搜索建议功能
- ✅ 完整集成测试 - 验证所有公共API功能
- ✅ 详细API文档 - 包含使用示例和集成指南

**核心功能:**
- 无认证访问药品数据
- 多字段模糊搜索支持
- 智能参数限制保护
- 标准化响应格式
- 安全数据过滤（不返回价格等敏感信息）

**实现文件:**
- `src/medicines/public-medicines.controller.ts` - 公共API控制器
- `src/medicines/medicines.service.ts` - 扩展服务方法
- `src/medicines/__tests__/public-medicines.controller.spec.ts` - 集成测试
- `docs/api/public-medicines-api.md` - 完整API文档
- `docs/Phase2-Day3-Public-Medicines-API-Report.md` - 实施报告

**立即可用:**
- 药品搜索: `GET /public/medicines?search=阿司匹林`
- 分类列表: `GET /public/medicines/categories`
- 热门药品: `GET /public/medicines/popular?limit=10`
- 搜索建议: `GET /public/medicines/search/suggestions?q=阿`

## 📋 开发检查清单（基于2025年1月9日实际进度）

### 阶段1: 医师账户API (第1周) - ✅ 已完成
- [x] 完善PractitionerAccountController
- [x] 实现余额查询API
- [x] 实现交易历史API
- [x] 实现账户信息API
- [x] 实现充值API (集成现有支付引擎)
- [x] 添加DTO验证
- [x] 编写单元测试
- [x] 更新Swagger文档

### 阶段2: 处方管理功能 (第2周) - ✅ 基础完成，需要支付集成
- [x] 增强PrescriptionService
- [x] 实现处方创建API
- [x] 实现处方查询API
- [x] 实现处方详情API
- [x] 集成现有QR码服务
- [x] 集成现有事件系统
- [x] 编写集成测试
- [x] 处理并发控制
- [ ] **待完成：处方支付集成**

### 阶段3: 支付集成 (第3周) - ⚠️ 需要实现PrescriptionPaymentService
- [x] 实现余额支付功能（PaymentService层面）
- [x] 集成现有PractitionerAccountService
- [x] 集成现有PaymentService
- [x] 实现Stripe充值流程
- [x] 处理支付状态通知
- [x] 集成WebSocket通知
- [x] 编写支付测试
- [x] 处理异常情况
- [ ] **待完成：创建PrescriptionPaymentService**
- [ ] **待完成：处方支付API端点**

### 阶段4: 公共API和优化 (第4周) - ⚠️ 需要实现
- [ ] 实现公共药品查询API
- [ ] 统一API路由前缀到/api/v1/
- [ ] 实现API限流
- [ ] 性能优化
- [ ] 安全加固
- [ ] 完善错误处理
- [ ] 更新API文档
- [ ] 部署准备
- [ ] 最终测试

## 🚀 部署和运维

### 1. 环境配置
```bash
# 基于现有Docker配置
NODE_ENV=production
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_...
JWT_SECRET=...
```

### 2. 健康检查
```typescript
// 利用现有健康检查机制
@Get('health')
async healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}
```

## 📊 性能指标

### 1. 基于现有架构的性能要求
- API响应时间 < 200ms (参考现有配置)
- 数据库查询优化 (利用现有索引)
- 缓存策略 (集成现有缓存模块)
- 并发处理 (利用现有事务机制)

### 2. 监控指标
- 请求成功率 > 99.9%
- 数据库连接池利用率 < 80%
- 内存使用率 < 70%
- WebSocket连接数监控

## 🔐 安全要求

### 1. 基于现有安全配置
- JWT认证 (已实现)
- API权限控制 (已实现)
- 输入验证 (已实现)
- SQL注入防护 (Prisma ORM)

### 2. 额外安全措施
- API限流 (需要实现)
- 敏感数据加密 (需要实现)
- 审计日志 (需要实现)
- 安全头配置 (已实现)

---

## 总结

基于现有架构的医师端开发任务主要是：
1. **完善现有模块**: 完成PractitionerAccountController的API实现
2. **集成现有服务**: 充分利用现有的支付引擎、事件系统、WebSocket等
3. **增强处方模块**: 基于现有架构扩展处方管理功能
4. **遵循现有规范**: 保持代码一致性和架构完整性

这样的开发方式能够最大化利用现有投资，减少重复开发，确保系统的一致性和可维护性。

## 🧪 测试驱动开发计划

### 测试策略概述

基于TDD原则，每个功能开发都遵循以下流程：
1. **编写失败的测试** - 定义预期行为
2. **实现最小代码** - 使测试通过
3. **重构优化** - 保持测试通过的同时改进代码

### 测试类型分布

```typescript
// 测试金字塔
- 单元测试 (70%) - Service层业务逻辑
- 集成测试 (20%) - API端点和数据库交互
- 契约测试 (5%)  - 前后端接口契约
- E2E测试 (5%)   - 完整业务流程
```

### 阶段1测试计划：医师账户API

#### 单元测试用例

```typescript
// src/practitioner-account/__tests__/practitioner-account.controller.spec.ts
describe('PractitionerAccountController', () => {
  describe('GET /api/v1/practitioner-accounts/balance', () => {
    it('should return account balance for authenticated practitioner');
    it('should return 404 if account not found');
    it('should handle decimal precision correctly');
    it('should include all balance fields (balance, credit, available)');
  });

  describe('GET /api/v1/practitioner-accounts/transactions', () => {
    it('should return paginated transaction history');
    it('should respect limit and offset parameters');
    it('should filter by transaction type when specified');
    it('should sort by creation date descending');
  });

  describe('POST /api/v1/practitioner-accounts/recharge', () => {
    it('should create Stripe payment intent for recharge');
    it('should validate minimum and maximum amounts');
    it('should return client secret for frontend');
    it('should handle Stripe API errors gracefully');
  });
});
```

#### 集成测试用例

```typescript
// test/integration/practitioner-account.e2e-spec.ts
describe('Practitioner Account Integration', () => {
  it('should handle concurrent balance requests without race conditions');
  it('should maintain transaction consistency across multiple operations');
  it('should integrate with Stripe for recharge operations');
  it('should emit events for account balance changes');
});
```

### 阶段2测试计划：处方管理

#### 契约测试定义

```yaml
# test/contracts/prescription-api.contract.yml
prescriptionCreation:
  request:
    method: POST
    path: /api/v1/prescriptions
    headers:
      Authorization: Bearer ${token}
    body:
      medicines:
        - medicineId: "med_001"
          quantity: 10
          dosage: "每日三次，每次2片"
          duration: 7
  response:
    status: 201
    body:
      id: string
      qrCode: string
      totalAmount: number
      status: "created"
      medicines: array
      createdAt: datetime
```

#### 业务逻辑测试

```typescript
describe('PrescriptionService', () => {
  describe('createPrescription', () => {
    it('should validate all medicines exist in database');
    it('should calculate total amount correctly');
    it('should generate unique QR code');
    it('should emit prescription.created event');
    it('should handle medicine not found error');
    it('should use database transaction for atomicity');
  });

  describe('prescription state management', () => {
    it('should transition from created to paid');
    it('should prevent invalid state transitions');
    it('should maintain state history');
  });
});
```

### 阶段3测试计划：支付集成

#### 支付流程测试

```typescript
describe('PrescriptionPaymentService', () => {
  describe('balance payment', () => {
    it('should deduct from practitioner balance');
    it('should update prescription status to paid');
    it('should create transaction record');
    it('should rollback on insufficient balance');
    it('should handle concurrent payment attempts');
  });

  describe('Stripe payment', () => {
    it('should create payment intent for prescription');
    it('should handle successful payment confirmation');
    it('should handle failed payment appropriately');
    it('should process webhook events idempotently');
  });

  describe('WebSocket notifications', () => {
    it('should emit payment status updates');
    it('should handle client reconnection');
    it('should deduplicate events');
  });
});
```

### 阶段4测试计划：公共API和性能

#### 性能测试基准

```typescript
describe('Performance Benchmarks', () => {
  it('should respond to balance query within 100ms');
  it('should handle 1000 concurrent prescription creations');
  it('should process payment webhook within 200ms');
  it('should serve public medicine API with cache hit ratio > 80%');
});
```

#### 安全测试

```typescript
describe('Security Tests', () => {
  it('should prevent SQL injection in all endpoints');
  it('should validate all user inputs');
  it('should not expose sensitive data in public APIs');
  it('should enforce rate limiting on public endpoints');
  it('should handle JWT token expiration correctly');
});
```

## 📋 完整实施检查清单

### 阶段1：医师账户API（第1周）
- [ ] 编写PractitionerAccountController所有测试用例
- [ ] 实现getBalance API端点
- [ ] 实现getTransactionHistory API端点（含分页）
- [ ] 实现getAccountInfo API端点
- [ ] 实现recharge API端点（Stripe集成）
- [ ] 创建所有必要的DTO类和验证
- [ ] 完成单元测试（覆盖率>85%）
- [ ] 完成集成测试
- [ ] 更新Swagger文档
- [ ] 更新MVP2.2前端开发文档

### 阶段2：处方管理功能（第2周）
- [ ] 编写处方管理所有测试用例
- [ ] 增强PrescriptionService业务逻辑
- [ ] 实现createPrescription API
- [ ] 实现getPrescription API
- [ ] 实现listPrescriptions API（含筛选）
- [ ] 集成QR码生成服务
- [ ] 实现药品验证逻辑
- [ ] 实现金额计算逻辑
- [ ] 集成事件发布（EventEmitter2）
- [ ] 完成契约测试

### 阶段3：支付集成（第3周）
- [ ] 编写支付流程所有测试用例
- [ ] 创建PrescriptionPaymentService
- [ ] 实现余额支付功能
- [ ] 集成PractitionerAccountService扣款
- [ ] 实现Stripe支付流程
- [ ] 处理支付状态流转
- [ ] 实现支付回调处理
- [ ] 集成WebSocket实时通知
- [ ] 实现支付失败回滚
- [ ] 完成支付流程E2E测试

### 阶段4：公共API和优化（第4周）
- [ ] 实现公共药品查询API
- [ ] 过滤敏感价格信息
- [ ] 实现API限流中间件
- [ ] 添加Redis缓存层
- [ ] 优化数据库查询和索引
- [ ] 执行性能测试
- [ ] 执行安全扫描（OWASP）
- [ ] 修复发现的安全问题
- [ ] 准备Docker部署配置
- [ ] 完成生产环境准备

## 🚀 持续集成配置

### GitHub Actions工作流

```yaml
# .github/workflows/backend-ci.yml
name: Backend CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:cov
      
      - name: Run integration tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
      
      - name: Security scan
        run: npm audit
```

### 测试覆盖率要求

- 总体覆盖率: > 80%
- 核心业务逻辑: > 90%
- API端点: 100%
- 错误处理路径: 100%

## 📊 监控和日志

### 日志策略

```typescript
// 使用结构化日志
this.logger.log({
  action: 'prescription.created',
  prescriptionId: prescription.id,
  practitionerId: practitioner.id,
  amount: prescription.totalAmount,
  timestamp: new Date().toISOString()
});
```

### 性能监控指标

- API响应时间 P95 < 200ms
- 数据库查询时间 < 50ms
- WebSocket消息延迟 < 100ms
- 错误率 < 0.1%

## 🔐 安全最佳实践

1. **输入验证**：使用class-validator严格验证所有输入
2. **SQL注入防护**：Prisma ORM自动参数化查询
3. **认证授权**：JWT + Guards确保访问控制
4. **敏感数据**：不在日志中记录敏感信息
5. **HTTPS强制**：生产环境强制使用HTTPS
6. **限流保护**：防止API滥用

---

本文档将持续更新，确保开发过程的可追踪性和质量保证。