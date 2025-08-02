# 🚨 后端代码复用准备指令 - Supabase架构迁移

**发布方**: 项目架构委员会  
**接收方**: 后端技术团队  
**指令类型**: 代码资产筛选 + Supabase迁移准备  
**发布日期**: 2025年8月2日  
**截止时间**: 72小时内完成  

---

## 📋 指令背景

基于Supabase-First架构决策，后端需要将现有代码库中的高价值模块提取到复用资产包中，同时准备Supabase架构的迁移工具。本指令明确了复用标准、迁移策略和资产准备要求。

---

## 🎯 代码复用评估结果

### 基于80%复用阈值的模块分类

#### ✅ 一级复用模块 (直接迁移) - 5个模块
**特征**: 纯业务逻辑，与基础设施无关，可直接迁移到Edge Functions

```bash
recycle/core-business/
├── medicine.service.ts              # 药品管理服务 (复用度: 95%)
├── prescription-calculator.service.ts # 处方计算逻辑 (复用度: 90%)  
├── payment-stripe.service.ts        # Stripe支付集成 (复用度: 85%)
├── qr-generator.service.ts          # QR码生成工具 (复用度: 95%)
└── audit-logger.service.ts          # 审计日志服务 (复用度: 80%)
```

#### ⚠️ 二级复用模块 (适配迁移) - 4个模块
**特征**: 需要适配Supabase API，保留核心算法和业务规则

```bash
recycle/supabase-adaptable/
├── user-management.service.ts       # 用户管理 (复用度: 40% - 适配Auth)
├── notification.service.ts          # 通知服务 (复用度: 60% - 适配Email)
├── file-upload.service.ts          # 文件上传 (复用度: 30% - 适配Storage)
└── data-validation.service.ts       # 数据验证 (复用度: 70% - 适配Schema)
```

#### ❌ 三级废弃模块 (0%复用) - 4个模块
**特征**: 与Supabase功能重叠，完全废弃不复用

```bash
# ❌ 不复用的废弃模块
废弃模块/
├── auth.module.ts                   # 373行 - 被Supabase Auth替代
├── jwt-strategy.service.ts          # 127行 - 被GoTrue替代  
├── permission-guard.service.ts      # 89行 - 被RLS策略替代
└── prisma-config.service.ts         # 45行 - 被Supabase Client替代
```

---

## 📦 强制复用资产准备清单

### 1. 核心业务逻辑层 (Edge Functions准备)

#### **medicine.service.ts** - 药品管理服务
```typescript
/**
 * 🔄 一级复用模块 - 直接迁移到Edge Functions
 * 复用价值: 95% (纯业务逻辑，无基础设施依赖)
 * 迁移目标: Supabase Edge Functions
 * 适配要求: 无需修改，直接迁移
 */

// 🚨 复用重点：basePrice计算逻辑和药品搜索算法
export class MedicineService {
  // 核心算法 - 100%复用
  calculateBasePrice(medicine: Medicine, quantity: number): number {
    // NZD cents精度计算逻辑
  }
  
  // 搜索算法 - 100%复用  
  searchMedicines(query: string, filters: SearchFilters): Medicine[] {
    // 多维度搜索逻辑
  }
}
```

#### **prescription-calculator.service.ts** - 处方计算引擎
```typescript
/**
 * 🔄 一级复用模块 - 金融计算核心
 * 复用价值: 90% (关键业务算法)
 * 迁移目标: Supabase Edge Functions  
 * 适配要求: 无需修改，保持NZD cents精度
 */

export class PrescriptionCalculatorService {
  // 🚨 核心业务逻辑 - 必须复用
  calculateTotalAmount(medicines: PrescriptionMedicine[]): number {
    // 金额计算逻辑，避免浮点误差
  }
  
  calculatePlatformProfit(basePrice: number, pharmacyPrice: number): number {
    // 平台收益计算模型
  }
}
```

#### **payment-stripe.service.ts** - Stripe支付集成
```typescript
/**
 * 🔄 一级复用模块 - 支付核心逻辑
 * 复用价值: 85% (成熟的支付流程)
 * 迁移目标: Supabase Edge Functions
 * 适配要求: API密钥配置调整
 */

export class StripePaymentService {
  // 支付流程 - 高价值复用
  async createPaymentIntent(amount: number, metadata: PaymentMetadata) {
    // Stripe Payment Intent创建逻辑
  }
  
  async confirmPayment(paymentIntentId: string) {
    // 支付确认和状态更新逻辑
  }
}
```

### 2. 数据库迁移工具 (Supabase Migration)

#### **database-migration-converter.ts** - 迁移转换工具
```typescript
/**
 * 🔄 特殊复用模块 - 迁移工具
 * 复用价值: 80% (迁移逻辑复用)
 * 迁移目标: Supabase Migration Scripts
 * 适配要求: Prisma → Supabase SQL转换
 */

export class MigrationConverter {
  // 🚨 关键迁移逻辑
  convertPrismaToSupabaseSQL(prismaSchema: string): string {
    // Prisma Schema转换为Supabase Migration SQL
  }
  
  generateRLSPolicies(tables: TableDefinition[]): string[] {
    // 自动生成RLS策略SQL
  }
}
```

### 3. 业务规则和验证器 (Schema Validation)

#### **business-rules.validator.ts** - 业务规则验证器
```typescript
/**
 * 🔄 一级复用模块 - 业务规则核心
 * 复用价值: 95% (业务逻辑不变)
 * 迁移目标: Supabase Edge Functions + RLS策略
 * 适配要求: 验证逻辑迁移到数据库层
 */

export class BusinessRulesValidator {
  // 🚨 核心业务规则 - 必须保持一致
  validatePrescriptionRules(prescription: Prescription): ValidationResult {
    // 处方业务规则验证
  }
  
  validatePharmacyPricing(priceList: PharmacyPriceList): ValidationResult {
    // 药房定价规则验证
  }
}
```

---

## 🚨 Supabase迁移助手工具准备

### 1. 架构迁移工具集

**在 `recycle/migration-tools/` 目录创建以下工具**:

#### **supabase-schema-generator.ts**
```typescript
/**
 * 🔧 Supabase Schema生成工具
 * 功能: Prisma Schema → Supabase Migration SQL
 * 使用: npm run migrate:supabase -- --from-prisma
 */

export class SupabaseSchemaGenerator {
  generateFromPrisma(prismaPath: string): MigrationFiles {
    // 自动生成Supabase迁移文件
  }
}
```

#### **rls-policy-generator.ts**
```typescript
/**
 * 🔧 RLS策略生成工具  
 * 功能: 基于角色自动生成Row Level Security策略
 * 使用: npm run generate:rls -- --role practitioner,pharmacy,admin
 */

export class RLSPolicyGenerator {
  generatePolicies(roles: UserRole[]): SQLPolicy[] {
    // 生成完整的RLS策略SQL
  }
}
```

#### **type-sync-generator.ts**
```typescript
/**
 * 🔧 TypeScript类型同步工具
 * 功能: Supabase Schema → TypeScript类型定义
 * 使用: npm run sync:types -- --output src/types/supabase.ts
 */

export class TypeSyncGenerator {
  generateTypes(supabaseUrl: string): TypeDefinitions {
    // 自动生成TypeScript类型定义
  }
}
```

### 2. 测试数据生成器

#### **seed-data-generator.ts**
```typescript
/**
 * 🔧 隐私合规测试数据生成器
 * 功能: 生成符合GDPR/HIPAA的匿名测试数据
 * 使用: npm run generate:seed -- --anonymous --gdpr-compliant
 */

export class SeedDataGenerator {
  generateAnonymousData(entityType: EntityType, count: number): SeedData[] {
    // 生成匿名化测试数据，无患者隐私信息
  }
}
```

---

## 📁 复用资产包目录结构 (强制要求)

```bash
recycle/
├── core-business/                   # 一级复用 - 直接迁移
│   ├── medicine.service.ts
│   ├── prescription-calculator.service.ts
│   ├── payment-stripe.service.ts
│   ├── qr-generator.service.ts
│   └── audit-logger.service.ts
├── supabase-adaptable/              # 二级复用 - 适配迁移
│   ├── user-management.service.ts
│   ├── notification.service.ts
│   ├── file-upload.service.ts
│   └── data-validation.service.ts
├── migration-tools/                 # 迁移工具集
│   ├── supabase-schema-generator.ts
│   ├── rls-policy-generator.ts
│   ├── type-sync-generator.ts
│   └── seed-data-generator.ts
├── database-schemas/                # 数据库定义
│   ├── prisma.schema                # 原Prisma Schema
│   ├── supabase-migrations/         # Supabase迁移文件
│   └── rls-policies.sql             # RLS策略定义
├── test-data/                       # 测试数据集
│   ├── anonymous-seed-data.json     # 匿名种子数据
│   └── test-scenarios.json          # 测试场景数据
├── docs/                           # 技术文档
│   ├── README.md                   # 后端技术转移总览
│   └── supabase-migration-guide.md # Supabase迁移指南
└── package.json                    # 复用包依赖配置
```

---

## ✅ 质量标准和验收要求

### 1. 代码质量检查清单

**每个复用文件必须包含**:
```typescript
/**
 * 🔄 后端代码复用资产
 * 原项目: B2B2C中医处方履约平台  
 * 复用等级: [一级/二级]复用
 * 迁移目标: [Edge Functions/RLS策略/Migration Script]
 * 适配要求: [具体的Supabase适配说明]
 * 测试覆盖: [单元测试覆盖率]
 * 
 * @migration Supabase-First架构适配
 * @security RLS策略集成要求
 * @performance Edge Functions优化建议
 */
```

**质量验收标准**:
- [ ] TypeScript严格模式通过
- [ ] ESLint检查无错误
- [ ] 单元测试覆盖率>80%
- [ ] 业务逻辑完整性验证
- [ ] Supabase兼容性检查
- [ ] 安全漏洞扫描通过

### 2. 迁移工具验收标准

**工具功能检查**:
- [ ] Prisma → Supabase转换准确率>95%
- [ ] RLS策略自动生成覆盖所有表
- [ ] TypeScript类型定义100%匹配
- [ ] 种子数据完全匿名化
- [ ] 工具CLI接口友好易用

### 3. 文档完整性检查

**必须包含的文档**:
- [ ] 每个模块的迁移指南
- [ ] Supabase架构对比说明
- [ ] RLS策略设计文档  
- [ ] Edge Functions部署指南
- [ ] 测试数据使用说明

---

## 🚨 特殊指令和约束

### 1. 废弃代码处理 (强制要求)

**完全废弃的模块** - 不得包含在复用包中:
```bash
# ❌ 严禁复用的模块
auth.module.ts                      # 与Supabase Auth冲突
jwt-strategy.service.ts             # 被GoTrue替代
permission-guard.service.ts         # 被RLS策略替代
prisma-config.service.ts            # 被Supabase Client替代
custom-middleware/                  # 与Supabase架构不兼容
```

### 2. 隐私合规要求 (法律约束)

**隐私信息处理规范**:
- ❌ 任何包含患者姓名、年龄、电话的代码都不得复用
- ❌ 测试数据中不得包含真实患者信息
- ✅ 所有处方数据必须完全匿名化
- ✅ 审计日志必须脱敏处理

### 3. 安全要求 (强制检查)

**安全合规检查**:
- [ ] 所有硬编码密钥和敏感信息已移除
- [ ] SQL注入防护代码保留并适配RLS
- [ ] XSS防护逻辑迁移到Edge Functions
- [ ] 审计日志完整性验证
- [ ] 敏感数据加密存储机制保留

---

## 📅 交付时间表和里程碑

### Phase 1: 代码筛选和评估 (24小时内)
**截止时间**: 2025年8月3日 23:59

**交付物**:
- [ ] 完成所有模块的复用价值评估
- [ ] 确认一级复用模块清单 (5个)
- [ ] 确认二级复用模块清单 (4个)  
- [ ] 完成废弃模块标记 (4个)

**验收标准**:
- 复用评估基于实际代码行数和业务价值
- 每个模块包含详细的适配说明
- 安全和隐私合规检查通过

### Phase 2: 复用资产准备 (48小时内)
**截止时间**: 2025年8月4日 23:59

**交付物**:
- [ ] `recycle/` 目录完整创建
- [ ] 9个核心模块文件准备完成
- [ ] 4个迁移工具开发完成
- [ ] 测试数据和文档准备完成

**验收标准**:
- 所有复用文件包含标准注释
- 迁移工具功能验证通过
- 代码质量检查全部通过

### Phase 3: 质量验收和发布 (72小时内)
**截止时间**: 2025年8月5日 23:59

**交付物**:
- [ ] 架构委员会质量审核通过
- [ ] 前端团队兼容性确认
- [ ] 复用资产包正式发布
- [ ] Supabase迁移指南完成

---

## 🔧 Supabase迁移助手使用指南

### 1. 快速迁移命令集

**项目初始化**:
```bash
# 1. 创建Supabase项目
supabase init

# 2. 转换Prisma Schema
npm run migrate:supabase -- --from-prisma ./prisma/schema.prisma

# 3. 生成RLS策略
npm run generate:rls -- --role practitioner,pharmacy,admin

# 4. 同步TypeScript类型
npm run sync:types -- --output src/types/supabase.ts

# 5. 生成种子数据  
npm run generate:seed -- --anonymous --gdpr-compliant
```

**迁移验证**:
```bash
# 验证Schema转换
supabase db diff --schema public

# 测试RLS策略
supabase test db --file tests/rls-policies.test.sql

# 验证类型安全
npm run type-check

# 运行集成测试
npm run test:integration
```

### 2. RLS策略模板示例

**医师数据隔离策略**:
```sql
-- 医师只能访问自己的处方
CREATE POLICY "practitioner_own_prescriptions" ON prescriptions
  FOR ALL USING (auth.uid() = practitioner_id);

-- 医师只能查看自己的账户信息  
CREATE POLICY "practitioner_own_account" ON practitioner_accounts
  FOR ALL USING (auth.uid() = user_id);
```

**药房权限控制策略**:
```sql
-- 药房只能处理分配给自己的订单
CREATE POLICY "pharmacy_assigned_orders" ON purchase_orders
  FOR ALL USING (
    pharmacy_id IN (
      SELECT id FROM pharmacies 
      WHERE operator_id = auth.uid()
    )
  );
```

**管理员全局访问策略**:
```sql
-- 管理员可以访问所有数据
CREATE POLICY "admin_full_access" ON prescriptions
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );
```

### 3. Edge Functions模板

**处方计算Edge Function**:
```typescript
// functions/calculate-prescription-price/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 🔄 复用原有计算逻辑
import { PrescriptionCalculatorService } from '../recycle/core-business/prescription-calculator.service.ts'

serve(async (req) => {
  const { medicines } = await req.json()
  
  // 复用后端计算逻辑
  const calculator = new PrescriptionCalculatorService()
  const totalAmount = calculator.calculateTotalAmount(medicines)
  
  return new Response(
    JSON.stringify({ totalAmount }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

---

## 🚨 重要提醒和风险警告

### 1. 架构一致性要求

**强制约束**:
- 🚨 **不得绕过RLS策略**: 所有数据访问必须通过Supabase Client
- 🚨 **不得重建认证系统**: 完全使用Supabase Auth，不得自定义JWT
- 🚨 **不得违反隐私合规**: 任何患者信息都不得在复用代码中出现
- 🚨 **不得影响前端集成**: Edge Functions必须与前端Supabase Client兼容

### 2. 性能和安全要求

**性能基准**:
- Edge Functions响应时间P95 < 500ms
- RLS策略查询优化，避免全表扫描
- 数据库连接池合理配置
- 缓存策略与Supabase兼容

**安全基准**:
- 所有API端点必须通过RLS验证
- 敏感计算逻辑在Edge Functions执行
- 审计日志完整记录所有操作
- 数据传输全程HTTPS加密

### 3. 团队协作要求

**与前端团队协调**:
- Edge Functions接口与前端Supabase Client调用一致
- TypeScript类型定义同步更新
- 错误处理和状态码规范统一
- API响应格式符合前端预期

**文档维护责任**:
- 每个复用模块的迁移文档
- RLS策略设计和测试文档
- Edge Functions部署和监控指南
- 故障排查和性能优化手册

---

## 📞 支持渠道和协调机制

### 技术支持热线
- 🚨 **紧急技术问题**: [架构委员会技术热线] - 1小时响应
- 📋 **迁移技术咨询**: GitHub Issue + Supabase技术群
- 📅 **进度同步**: 每日站会 + Slack群组更新

### 质量保证支持
- **代码审查**: 架构委员会 + 资深工程师
- **安全审计**: 独立安全顾问审查
- **性能测试**: 专业性能测试团队
- **合规检查**: 法务团队隐私合规验证

### 前后端协调支持
- **API契约**: 后端Edge Functions与前端Client SDK对齐
- **类型定义**: TypeScript类型自动同步机制
- **测试数据**: 前后端共享匿名测试数据集
- **部署配置**: Vercel + Supabase联合部署指导

---

## ✅ 最终交付检查清单

### 代码复用包完整性
- [ ] 📁 `recycle/core-business/` - 5个一级复用模块
- [ ] 📁 `recycle/supabase-adaptable/` - 4个二级复用模块  
- [ ] 📁 `recycle/migration-tools/` - 4个迁移工具
- [ ] 📁 `recycle/database-schemas/` - 完整数据库定义
- [ ] 📁 `recycle/test-data/` - 匿名测试数据集
- [ ] 📁 `recycle/docs/` - 完整技术文档

### 质量验收通过
- [ ] ✅ TypeScript类型检查100%通过
- [ ] ✅ ESLint代码规范检查通过
- [ ] ✅ 单元测试覆盖率>80%
- [ ] ✅ 安全漏洞扫描零风险
- [ ] ✅ 隐私合规检查通过
- [ ] ✅ Supabase兼容性验证通过

### 文档完整性确认
- [ ] 📚 每个模块包含详细迁移指南
- [ ] 📚 RLS策略设计和测试文档
- [ ] 📚 Edge Functions开发和部署指南
- [ ] 📚 Supabase迁移工具使用手册
- [ ] 📚 故障排查和性能优化指南

### 团队协调确认
- [ ] 🤝 前端团队兼容性确认
- [ ] 🤝 架构委员会最终审核通过
- [ ] 🤝 安全团队合规验证通过
- [ ] 🤝 项目经理时间节点确认

---

**指令执行状态追踪**:
- **Phase 1** (24h): ⏳ 进行中 → ✅ 完成确认
- **Phase 2** (48h): ⏳ 待开始 → ✅ 完成确认  
- **Phase 3** (72h): ⏳ 待开始 → ✅ 最终验收

**下一步行动**: 完成复用资产准备后，立即与前端团队协调新项目仓库创建和代码迁移工作。

---

**指令发布者**: 项目架构委员会  
**指令等级**: 🚨 强制执行  
**技术标准**: Supabase-First企业级标准  
**质量要求**: 生产就绪代码复用资产  
**成功标准**: 新项目开发效率提升80%，安全合规100%达标