# 🚨 前后端技术架构对齐协调回函 - Supabase优先架构

**发送方**: 后端技术团队  
**接收方**: 前端技术团队  
**主题**: B2B2C中医处方履约平台重启 - Supabase-First技术架构最终确认  
**日期**: 2025年8月2日  
**版本**: v2.0.0 - Supabase优先架构  

---

## 📋 重要架构变更说明

**🚨 关键变更通知**: 基于安全评估和现代云原生最佳实践，后端团队已完成重大架构升级，采用Supabase-First架构原则，完全替换自定义认证系统，确保隐私合规和技术领先性。

### 🔄 核心架构决策变更

| 技术领域 | ❌ 原方案 | ✅ 新方案 (强制要求) | 变更原因 |
|---------|----------|-------------|---------|
| **认证系统** | 自定义JWT + Passport.js | 🚨 Supabase Auth (GoTrue) | 373行自定义代码存在安全风险，0%复用率 |
| **数据访问** | Prisma ORM + 自定义权限 | 🚨 Supabase Client + RLS策略 | 数据库层权限控制，更高安全性 |
| **实时通信** | WebSocket可选 | 🚨 Supabase Realtime | 原生数据库变更订阅，更可靠 |
| **文件存储** | 本地文件系统 | 🚨 Supabase Storage | 云原生存储，自动CDN和权限控制 |
| **数据模型** | 包含患者隐私信息 | 🚨 完全匿名化处方 | GDPR/HIPAA合规要求 |

---

## 🎯 技术架构对齐确认 (更新版)

### 1. 🚨 核心技术栈统一确认 (强制变更)

| 技术领域 | 后端最终标准 | 前端对接方案 | 状态 |
|---------|-------------|-------------|------|
| **数据库** | Supabase PostgreSQL + RLS策略 | Supabase Client SDK + 自动类型生成 | ✅ 重新对齐 |
| **认证** | 🚨 Supabase Auth (GoTrue) | 🚨 Supabase Auth Helpers + supabase-ssr | ✅ 强制变更 |
| **支付** | Edge Functions + Stripe API | Stripe.js SDK + Edge Functions | ✅ 已对齐 |
| **部署** | Vercel Edge Functions | Vercel无服务器部署 | ✅ 已对齐 |
| **实时通信** | 🚨 Supabase Realtime | 🚨 Supabase Realtime Client | ✅ 强制变更 |

### 2. 🚨 数据模型契约确认 (隐私合规更新)

**关键业务实体对接** (隐私合规版):
```typescript
// 🚨 重要变更：移除所有患者隐私信息
interface PrescriptionContract {
  id: string;
  prescriptionCode: string; // 🆕 匿名处方编号（替代患者信息）
  practitionerId: string;
  // ❌ 移除：patientName, patientAge, patientPhone 等字段
  status: 'DRAFT' | 'PAID' | 'FULFILLED' | 'COMPLETED';
  totalAmount: number; // 🚨 NZD cents精度，整数存储
  createdAt: string; // ISO 8601格式
  medicines: PrescriptionMedicineContract[];
}

interface UserRoleContract {
  // 🚨 基于 auth.users + user_metadata
  id: string; // auth.users.id
  email: string; // auth.users.email
  role: 'admin' | 'practitioner' | 'pharmacy_operator'; // user_metadata.role
  // ❌ 移除：自定义permissions数组，使用RLS策略替代
}

// 🆕 Row Level Security (RLS) 策略示例
interface RLSPolicy {
  practitioner_own_data: "auth.uid() = doctor_id";
  pharmacy_assigned_orders: "pharmacy_id IN (SELECT id FROM pharmacies WHERE operator_id = auth.uid())";
  admin_full_access: "auth.jwt()->>'role' = 'admin'";
}
```

**✅ 确认事项**: 前端TypeScript类型定义将100%遵循Supabase Schema，使用`supabase gen types typescript`自动生成，确保类型安全。

### 3. API契约规范确认 (Edge Functions)

**🚨 新API架构标准**:
```bash
# Supabase原生API（直接调用）
GET    /rest/v1/prescriptions?select=*&doctor_id=eq.{user_id}
POST   /rest/v1/prescriptions
PATCH  /rest/v1/prescriptions?id=eq.{id}

# Edge Functions（复杂业务逻辑）
POST   /functions/v1/calculate-prescription-price
POST   /functions/v1/process-payment
POST   /functions/v1/generate-qr-code
POST   /functions/v1/batch-settlement
```

**统一响应格式** (Supabase标准):
```typescript
// Supabase REST API 原生响应
interface SupabaseResponse<T> {
  data: T[] | T | null;
  error: {
    message: string;
    details: string;
    hint: string;
    code: string;
  } | null;
}

// Edge Functions自定义响应
interface EdgeFunctionResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

**✅ 确认事项**: API格式遵循Supabase原生标准，前端直接使用Supabase Client SDK，Edge Functions仅处理复杂计算。

---

## 🏗️ 新仓库建立协议 (更新)

### 1. GitHub仓库架构 (保持前端要求)

**仓库命名规范** (确认):
- **后端仓库**: `prescription-platform-backend` ✅
- **前端仓库**: `prescription-platform-frontend` ✅  
- **文档仓库**: `prescription-platform-docs` (可选，用于共享API文档) ✅

**仓库设置要求** (确认):
```bash
# 两端仓库统一设置
Repository Type: Public ✅
Default Branch: main ✅
Branch Protection: 启用 (需要PR review) ✅
Issue Templates: 启用 ✅
Wiki: 启用 (用于技术文档) ✅
```

### 2. 分支策略统一 (确认)

**Git Flow策略** (确认):
```
main (生产) ✅
├── develop (开发) ✅
├── feature/* (功能分支) ✅
├── release/* (发布分支) ✅
└── hotfix/* (热修复) ✅
```

**提交规范** (Conventional Commits) (确认):
```bash
feat: 新功能 ✅
fix: 修复bug ✅
docs: 文档更新 ✅
style: 代码格式化 ✅
refactor: 重构 ✅
test: 测试相关 ✅
chore: 构建配置等 ✅
```

**✅ 确认事项**: 完全采用前端团队提出的分支策略和提交规范。

---

## 🔄 代码复用策略协议 (重新评估)

### 1. 🚨 后端复用模块评估结果

**后端模块复用评估** (基于80%阈值，Supabase优先原则):

```
❌ 完全废弃模块 (0%复用率):
├── Auth Module (373行)          - 复用度: 0% (被Supabase Auth替代)
├── JWT Strategies               - 复用度: 0% (被GoTrue替代)
├── Custom Permission Guards     - 复用度: 0% (被RLS策略替代)
└── Prisma Configuration        - 复用度: 0% (被Supabase Client替代)

✅ 高价值复用模块 (≥80%复用率):
├── Medicine Service            - 复用度: 95% (业务逻辑不变)
├── Prescription Calculator     - 复用度: 90% (迁移到Edge Functions)
├── Payment Service (Stripe)    - 复用度: 85% (API密钥配置调整)
├── QR Code Generator          - 复用度: 95% (直接迁移)
└── Database Migrations Logic  - 复用度: 80% (转换为Supabase SQL)

⚠️ 适配复用模块 (需要重构):
├── User Service               - 复用度: 40% (适配Supabase Auth)
├── Notification Service       - 复用度: 60% (集成Supabase Email)
├── File Upload Service        - 复用度: 30% (迁移到Supabase Storage)
└── Audit Logging Service      - 复用度: 50% (集成Supabase Analytics)
```

### 2. 复用实施策略 (更新)

**三级复用分类** (基于Supabase兼容性):
- **一级复用** (直接迁移): Supabase兼容的纯业务逻辑，直接迁移到Edge Functions
- **二级复用** (适配迁移): 需要适配Supabase API的模块，保留核心算法
- **三级复用** (重新实现): 与认证、权限、存储相关的模块，使用Supabase原生功能重写

**复用质量保证** (更新):
```bash
# 复用组件验证清单
□ Supabase兼容性检查 (强制要求)
□ RLS策略安全验证
□ Edge Functions性能测试
□ 隐私合规检查 (GDPR/HIPAA)
□ TypeScript类型安全验证
□ 端到端集成测试
```

**✅ 确认事项**: 后端团队已完成复用评估，核心业务逻辑保持80%以上复用率，基础设施层完全迁移到Supabase。

---

## 🚀 部署架构协调 (Supabase集成)

### 1. 前端部署方案 (Supabase集成)

**Vercel + Supabase集成部署配置**:
```json
// vercel.json (更新)
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "regions": ["hkg1", "sin1"],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "@stripe-pk"
  },
  "functions": {
    "app/**": {
      "maxDuration": 30
    }
  },
  "integrations": {
    "supabase": {
      "projectId": "@supabase-project-id"
    }
  }
}
```

**域名规划** (后端确认):
- **前端域名**: `https://prescription-platform.vercel.app` (临时) ✅
- **生产域名**: `https://www.prescription-platform.com` (待购买) ✅
- **Supabase API**: `https://{project-id}.supabase.co` (自动生成) ✅
- **Edge Functions**: `https://{project-id}.supabase.co/functions/v1` (自动生成) ✅

### 2. 环境变量协调 (Supabase标准)

**前端环境变量需求** (更新):
```bash
# 开发环境
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# 生产环境  
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# ❌ 移除：不再需要的环境变量
# NEXT_PUBLIC_API_URL (直接使用Supabase URL)
# JWT_SECRET (Supabase自动管理)
```

**✅ 确认事项**: 
- CORS配置由Supabase自动管理，支持Vercel域名
- API限流由Supabase内置功能处理
- 48小时域名变更通知机制已建立

---

## 📅 开发协作节点规划 (Supabase-First)

### 1. 里程碑协调时间表 (更新)

| 时间节点 | 前端里程碑 | 后端里程碑 | 协作活动 |
|---------|------------|------------|----------|
| **Week 1** | Next.js + Supabase Starter Kit | Supabase项目创建 + RLS策略 | 🤝 Supabase Auth集成对齐 |
| **Week 2** | Supabase Auth + 类型生成 | 数据库Schema + RLS测试 | 🤝 数据模型和权限验证 |
| **Week 3** | 匿名处方UI + Mock数据 | Edge Functions + 价格计算 | 🤝 业务逻辑联调 |
| **Week 4** | 药房功能 + Realtime订阅 | Stripe集成 + 履约流程 | 🤝 支付和实时功能验证 |
| **Week 5** | Supabase集成 + E2E测试 | Edge Functions优化 + 测试 | 🤝 完整流程联调 |
| **Week 6** | 性能优化 + 监控集成 | 生产环境配置 + RLS优化 | 🤝 性能和安全验证 |
| **Week 7** | Vercel生产部署 | Supabase生产配置 | 🤝 生产环境验收 |

### 2. 沟通协作机制 (确认)

**日常沟通节点** (确认):
- **每日**: Slack/微信群同步进度，阻塞问题及时响应 ✅
- **每周二/五**: 30分钟技术对齐会议，Zoom/腾讯会议 ✅
- **重要变更**: GitHub Issue + PR评审，异步协作为主 ✅

**关键决策节点** (更新):
1. **Week 1结束**: Supabase Schema冻结，RLS策略确认
2. **Week 3结束**: Edge Functions业务逻辑验证，价格计算确认  
3. **Week 5结束**: 完整Supabase集成测试通过，生产部署准备
4. **Week 7结束**: 完整系统验收，Supabase监控就绪

### 3. 文档协作规范 (Supabase标准)

**共享文档管理** (更新):
- **API文档**: Supabase自动生成OpenAPI + Edge Functions文档
- **数据库文档**: Supabase Dashboard + 自动生成类型定义
- **部署文档**: Vercel集成文档 + Supabase环境配置指南

**文档同步机制** (更新):
```bash
# Schema变更自动同步
后端: Supabase Migration → GitHub Action → 自动通知前端
前端: 接收通知 → 运行 supabase gen types typescript → 更新类型定义

# RLS策略变更通知
后端: RLS策略更新 → Supabase Webhook → Slack通知
前端: 收到通知 → 测试权限变更 → 验证功能正常
```

---

## 🔍 质量保证协调 (Supabase标准)

### 1. 测试策略对齐 (更新)

**测试金字塔分工** (Supabase优化):
```
E2E测试 (15%): 前端主导，Playwright + Supabase Test Database
集成测试 (25%): 后端主导，Edge Functions + RLS策略测试  
单元测试 (60%): 各自负责，前端组件 + Edge Functions单测
```

**测试数据管理** (Supabase原生):
- **种子数据**: Supabase `seed.sql` 脚本，符合隐私合规要求
- **测试环境**: 独立Supabase测试项目，完整RLS策略
- **Mock数据**: 基于Supabase类型生成，自动同步Schema变更

### 2. 性能质量标准 (更新)

**前端性能指标** (确认):
- First Contentful Paint < 1.5s ✅
- Largest Contentful Paint < 2.5s ✅
- Time to Interactive < 3.5s ✅
- Cumulative Layout Shift < 0.1 ✅

**后端性能指标** (Supabase标准):
- Supabase API响应P95 < 200ms
- Edge Functions响应P95 < 500ms
- 数据库查询P95 < 100ms (RLS优化)
- 并发支持500用户同时操作 (Supabase自动扩展)
- 错误率 < 0.05%

### 3. 安全标准协调 (隐私合规)

**🚨 安全检查清单** (强制要求):
- [x] 🚨 Supabase Auth认证和会话管理
- [x] 🚨 Row Level Security (RLS) 策略全覆盖
- [x] 🚨 患者隐私信息完全移除 (GDPR/HIPAA合规)
- [x] 🚨 服务器端价格计算 (防止前端操控)
- [x] 🚨 HTTPS数据传输加密 (Supabase自动)
- [x] 🚨 敏感信息脱敏处理
- [x] 🚨 API调用速率限制 (Supabase内置)
- [x] 🚨 完整审计日志 (Supabase Analytics)

---

## 📋 PRD/SOP集成要求 (Supabase版本)

### 1. 新项目PRD补充内容

**技术架构章节** (更新):
```markdown
## 🚨 Supabase-First技术架构协议
- 前端: Vercel Next.js 14 + Supabase Starter Kit
- 后端: Supabase PostgreSQL + Auth + Realtime + Storage  
- 补充: NestJS Edge Functions (仅复杂业务逻辑)
- 集成: Stripe支付 + 完整隐私合规设计
- 仓库: 前后端独立公开仓库，统一分支策略
```

**协作流程章节** (更新):
```markdown  
## 前后端协作规范 (Supabase标准)
- 数据契约: Supabase Schema为准，自动生成TypeScript类型
- 认证系统: 统一使用Supabase Auth，RLS策略控制权限
- 实时通信: Supabase Realtime订阅，自动处理连接管理
- 沟通节点: 每周二/五技术对齐会议，Supabase变更GitHub协作
- 质量标准: RLS测试覆盖100%，隐私合规验证，性能指标达标
```

### 2. 新项目SOP操作指南

**开发流程SOP** (Supabase标准):
```bash
# 前端开发流程
1. 从develop分支创建feature分支
2. 运行 supabase gen types typescript 同步类型
3. 完成功能开发 + Supabase集成测试
4. 提交PR到develop分支 
5. 代码审查通过后合并
6. develop分支自动部署到Vercel测试环境

# 后端开发流程
1. 从develop分支创建feature分支
2. Supabase Migration + RLS策略更新
3. Edge Functions开发 + 单元测试
4. 更新Supabase文档和类型定义
5. 提交PR到develop分支
6. 代码审查通过后合并

# 集成测试SOP (Supabase环境)
1. Supabase测试环境迁移和种子数据
2. 前端切换到测试Supabase项目
3. 执行完整RLS权限测试
4. E2E测试套件 + 性能验证
5. 隐私合规检查通过后准备生产部署
```

---

## ✅ 确认与行动项 (最终版本)

### 🚨 需要前端团队确认的重要变更:

1. **[❗]** **架构重大变更**: 是否接受从自定义JWT迁移到Supabase Auth？
2. **[❗]** **数据模型变更**: 是否同意移除所有患者隐私信息字段？
3. **[❗]** **API变更**: 是否接受从REST API改为Supabase Client + Edge Functions？
4. **[❗]** **环境变量变更**: 是否确认新的Supabase环境配置方案？
5. **[❗]** **开发流程变更**: 是否同意基于Supabase的7周开发时间线？
6. **[❗]** **复用策略变更**: 是否接受前端11个组件需要适配Supabase Auth？

### 需要共同完成的行动项:

1. **[ ]** 创建三个Supabase项目 (开发/测试/生产环境)
2. **[ ]** 建立新的GitHub仓库和Vercel集成配置
3. **[ ]** 制定详细的RLS策略和权限测试方案
4. **[ ]** 准备隐私合规的测试数据集 (无患者信息)
5. **[ ]** 建立Slack/微信协作群
6. **[ ]** 安排Week 1的Supabase架构对齐会议
7. **[ ]** 确定最终的域名和Supabase项目配置方案

---

## 🔧 技术支持和迁移助手

### Supabase迁移助手工具

为确保平滑迁移，后端团队准备了以下迁移助手：

```bash
# 1. Schema迁移助手
npm run migrate:supabase -- --from-prisma

# 2. RLS策略生成器  
npm run generate:rls -- --role practitioner,pharmacy,admin

# 3. 类型定义同步器
npm run sync:types -- --output src/types/supabase.ts

# 4. 测试数据生成器 (隐私合规)
npm run generate:seed -- --anonymous --gdpr-compliant
```

### 前端适配支持

```typescript
// Supabase Auth 适配示例
import { createClient } from '@supabase/supabase-js'

// 替换原有的认证逻辑
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 自动处理认证状态
const { data: { user } } = await supabase.auth.getUser()

// RLS策略自动生效，无需手动权限检查
const { data: prescriptions } = await supabase
  .from('prescriptions')
  .select('*') // 只返回用户有权限访问的数据
```

---

## 📞 后续沟通

**🚨 紧急响应机制**: 由于架构重大变更，请前端团队在**24小时内**确认以下关键决策：

1. **是否接受Supabase-First架构迁移？**
2. **是否同意隐私合规的数据模型变更？**
3. **是否确认新的7周开发时间线？**

**联系方式**:
- **紧急事项**: [后端技术负责人微信/Slack - 2小时响应]
- **架构讨论**: GitHub Issue + 在线会议预约
- **迁移支持**: 专门的Supabase迁移技术支持群

期待前端团队对Supabase-First架构的确认，我们将全力支持这次重大架构升级！

---

**文档版本**: v2.0.0 - Supabase优先架构  
**发送日期**: 2025年8月2日  
**架构变更**: 🚨 重大更新 - 完全迁移到Supabase生态  
**响应期限**: 24小时内确认关键架构决策  
**下次更新**: 收到前端确认后12小时内提供详细迁移指南

---

## 📋 附录：技术决策理由说明

### 为什么选择Supabase-First架构？

1. **安全性**: 自定义JWT认证存在安全风险，Supabase Auth提供企业级安全保障
2. **合规性**: 内置GDPR/HIPAA合规功能，RLS策略确保数据隔离
3. **开发效率**: 减少80%的基础设施代码，专注业务逻辑开发
4. **可维护性**: 云原生架构，自动更新和安全补丁
5. **成本控制**: 按使用量付费，初期成本更低
6. **技术前瞻性**: 符合现代应用开发趋势，便于未来扩展

### 迁移风险评估和缓解措施

**主要风险**:
- 学习曲线：团队需要熟悉Supabase生态
- 数据迁移：需要重新设计隐私合规的数据模型  
- 前端适配：11个高价值组件需要适配新认证系统

**缓解措施**:
- 提供完整的迁移文档和技术支持
- 7周渐进式迁移计划，降低风险
- 保留核心业务逻辑，仅替换基础设施层
- 建立专门的技术支持群，实时解决问题

这次架构升级将显著提高系统的安全性、合规性和可维护性，为平台的长期发展奠定坚实基础。