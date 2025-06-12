
MVP1.0PRDandSOPv1.3Final.md的修订重点：

1.  **内化附录内容：** 将之前作为外部引用的核心设计文档（数据库、API、部署架构、权限矩阵等）的关键内容和图表，直接整合进 SOP v1.3 的正文或附录中，使其成为一个完整的单一文档。
2.  **采纳架构师的 P0 级修正：** 将关于并发控制、数据一致性、幂等性、审计日志等致命缺陷的解决方案，深度融入到数据库设计、API 规范和核心业务流程的描述中。
3.  **采纳产品经理的决策：** 固化最终版的订单状态机和支付流程逻辑。
4.  **细化测试、协作与运维策略：** 根据专家的建议，将测试、协作和监控运维的规划具体化。
5.  **更新开发计划：** 采纳架构师对时间复杂度的评估，将 Phase 1 的开发计划调整为更现实的 6-8 周，并细化各阶段的核心攻关任务。
6.  **保留痕迹与摘要备份：** 对于被删除或重大修改的内容，我会按照要求进行标记和说明。
7.  **标注已完成进度：** 根据 `DEVELOPMENT_PROGRESS_TRACKER.md` 的信息，明确标注已完成的任务。

---

### **新西兰中医处方平台 - MVP 1.0 最终版产品需求与标准操作规程 (PRD & SOP v1.5)**

**文档版本：** 1.5 (Final for MVP 1.0 downsize)
**日期：** [当前日期]
**状态：** **最终版，作为 MVP 1.0 开发阶段的唯一指导性文件。**

---

### **引言：战略聚焦与工程严谨性**

本文件是新西兰中医处方平台 MVP 1.0 阶段的最终指导性文档。它整合了产品、前端、后端及架构师的多轮评审意见，旨在解决所有已识别的 P0 级别（阻塞发布）风险，并为开发团队提供一份清晰、严谨、可执行的技术与产品规程。

**核心决策：**
1.  **范围聚焦：** MVP 1.0 范围已“瘦身”，战略性推迟“处方模板”、“推荐机制”、“用户报表”及“AI 审核”功能，全力保障核心交易流程的稳定与安全。
2.  **架构定型：** 最终采纳 **Hybrid 架构 (Dedicated Backend + Supabase)**，后端技术栈确定为 **Node.js + NestJS + Prisma**。
3.  **风险优先：** 本 SOP 的核心是**在设计阶段解决**并发控制、数据一致性、支付安全等关键技术风险。

---

### **目录**

1.  [项目概述与 MVP 1.0 最终目标](#1-项目概述与-mvp-10-最终目标)
2.  [用户角色与权限](#2-用户角色与权限)
3.  [技术架构与选型 (最终决策)](#3-技术架构与选型-最终决策)
4.  [核心后端服务/模块定义 (聚焦 MVP 1.0)](#4-核心后端服务模块定义-聚焦-mvp-10)
5.  [数据库设计 (Supabase PostgreSQL)](#5-数据库设计-supabase-postgresql)
6.  [API 设计规范与核心端点](#6-api-设计规范与核心端点)
7.  [开发流程、规范与风险应对](#7-开发流程-规范与风险应对)
8.  [MVP 1.0 后端开发任务拆解与顺序 (修订版)](#8-mvp-10-后端开发任务拆解与顺序-修订版)
9.  [风险识别与应对 (最终版)](#9-风险识别与应对-最终版)
10. [附录：核心设计图表与规范](#10-附录核心设计图表与规范)

---

### **1. 项目概述与 MVP 1.0 最终目标**

*   **1.1. 项目愿景:**
    为新西兰中医师提供一个高效、便捷、合规的电子处方和草药调配协作平台，解决其自建药房成本高、运营复杂的痛点。
*   **1.2. MVP 1.0 核心功能范围 (最终版):**
    *   **核心业务闭环 (P0 - Must-Have):**
        1.  **医生开方与订单创建:** 医生搜索药品、创建电子处方。
        2.  **诊所账户支付:** 系统从诊所的预付/信用账户中**实时、原子性地扣款**。
        3.  **凭证生成与交付:** 支付成功后，生成包含 QR 码的有效电子凭证。
        4.  **药房扫码与订单验证:** 药房通过内部 API 验证订单真实性。
        5.  **药房履约与凭证提交:** 药房上传履约照片。
        6.  **管理员手动审核:** 平台管理员审核履约凭证。
        7.  **平台与药房结算:** 审核通过后，自动生成待结算记录。
    *   **关键支撑功能 (P1 - Should-Have):**
        1.  **用户认证与权限 (RBAC):** 保证系统安全可用。
        2.  **药品目录查询:** 支撑开方。
        3.  **处方历史查看 (简化版):** 满足医生核心工作流需求。
        4.  **患者端药房查找 API:** 提升患者体验。
        5.  **文件上传服务:** 支持履约凭证上传。
        6.  **基础邮件通知:** 支撑关键业务节点的沟通。
*   **1.3. MVP 1.0 成功衡量标准 (KPIs):**
    *   **用户增长与活跃度:** 月活跃医师 (MAU) 数量，医师周平均处方量。
    *   **业务与履约效率:** 月总订单数，订单成功履约率。
    *   **平台财务:** 月度 GTV (基于诊所支付的 B 价总和)，月度毛利 (SUM(B-C))。
    *   **用户反馈:** 通过定性访谈收集至少 [X] 位医生和 [Y] 家药房对核心流程的反馈。

---

### **2. 用户角色与权限**

*   **核心用户角色:** 医生 (Doctor), 药房操作员 (Pharmacy Operator), 平台管理员 (Admin)。
*   **权限模型:** 遵循 **附录 10.4 用户角色权限矩阵**。后端将通过 NestJS Guards 和自定义装饰器实现 RBAC。

---

### **3. 技术架构与选型 (最终决策)**

*   **3.1. 整体架构:** **Hybrid - Supabase for Data/Auth/Storage, Dedicated Backend for API/Logic.**
*   **3.2. 后端技术栈:** **Node.js + NestJS (TypeScript)**, **Prisma** (ORM)。
*   **3.3. 数据库/BaaS:** **Supabase Cloud (Pro Plan)**。
*   **3.4. 部署架构:** 遵循 **附录 10.3 部署架构设计**。
*   **3.5. 核心设计原则:** API First, Stateless Backend, Security by Design, Privacy by Design, **数据一致性优先**, **短事务原则**。

---

### **4. 核心后端服务/模块定义 (聚焦 MVP 1.0)**

*   **服务架构:** 采纳精简后的 **4个核心服务架构**：
    1.  **Core Business Service:** 负责核心交易流程、订单状态机、支付编排、结算逻辑。
    2.  **User & Auth Service:** 负责用户身份、认证、授权、诊所账户管理。
    3.  **External Integration Service:** 负责与第三方服务（支付、邮件、地图）的集成。
    4. Supporting Services & Shared Modules (职责澄清)
        **Medicine/PIM Service (药品信息管理):**
        **职责:**
        提供医师端所需的药品搜索、筛选和详情查询 API。
        提供管理员使用的药品目录 CRUD API。（澄清：这些 API 在 MVP 1.0 阶段主要供开发/运维人员通过工具（如 Postman）或后台脚本调用，用于数据的初始化和维护，不要求有配套的前端管理界面。）
        **核心攻关:**
        高效药品搜索实现 (Prisma full-text search 或其他)。
        新增: 设计并实现一个数据初始化脚本 (seed.ts)，该脚本能够读取标准格式文件（如 CSV），通过调用上述管理员 API 或直接使用 Prisma Client，批量初始化/更新药品目录。
        **Pharmacy Service (药房管理与查找):**
        **职责:**
        提供管理员使用的合作药房信息 CRUD API。
        提供患者端药房查找 API（基于地理位置和药品供应能力）。
        提供 API 允许管理员为合作药房配置其供应能力和结算价格（操作 pharmacy_supplies 表）。（澄清：此功能在 MVP 1.0 阶段由管理员或技术人员通过后台工具执行，不为药房操作员提供前端自助管理界面。）
        **核心攻关:**
        地理位置查询与基于药品供应能力（非实时）的筛选逻辑。
        新增: 在数据初始化脚本中，包含为首批合作药房预设供应目录和结算价的功能。
        File Management Module: (保持不变)
        Notification Module: (保持不变)
        Admin Support Module: (保持不变)
        **Basic Reporting Module:**
        **职责调整与澄清:**
        移除面向医生或药房的前端报表 API。
        保留为管理员提供查询核心 KPI 数据的 API。这些数据初期可通过数据库查询工具由运营人员手动获取，后端 API 的开发优先级为 P3，仅在有余力时实现。
---

### **5. 数据库设计 (Supabase PostgreSQL)**

*   **5.1. 核心表结构:**
    *   **严格遵循 附录 10.1 核心数据库表结构设计**。
    *   **P0 级修正已包含：**
        *   `clinic_accounts` 表已增加 `CHECK` 约束和 `version` 字段。
        *   已新增 `account_transactions` 审计表。
        *   `orders` 表已增加 `idempotency_key` 字段和修正后的 `status` 约束。
*   **5.2. 数据迁移 (Prisma Migrate):**
    *   所有 Schema 变更通过 Prisma Migrate 进行管理。
    *   **核心攻关问题:** 建立严格的迁移流程：本地 `prisma migrate dev` -> Code Review (审查 `migration.sql`) -> CI/CD 中使用 `prisma migrate deploy`。
*   **5.3. 敏感数据加密:**
    *   **MVP 1.0 策略：** 对于 `orders.patient_info` 等字段，后端在存入数据库前，**必须**使用对称加密算法（如 AES-256-GCM）进行字段级加密。加密密钥通过安全的环境变量管理。

---

### **6. API 设计规范与核心端点**

*   **6.1. API 设计原则:**
    *   **遵循 附录 10.2 API设计规范和核心端点**。
    *   **强制要求：**
        *   **幂等性：** 所有创建/修改资源的 `POST/PUT/PATCH` 请求，客户端必须携带 `Idempotency-Key` 请求头。
        *   **统一错误响应格式：** 严格遵循定义的错误响应结构。
        *   **版本控制：** 采用 URL 路径版本控制 (`/api/v1/...`)。
*   **6.2. OpenAPI/Swagger 规范:**
    *   **核心攻关问题:** 在 Phase 1 早期，后端团队必须产出覆盖核心流程的 OpenAPI 3.0 规范，并作为前后端协作的唯一契约。

---

### **7. 开发流程、规范与风险应对**

*   **7.1. 开发流程:** 遵循 Phase 0-1 的任务规划，采用敏捷开发模式。
*   **7.2. 测试策略与质量保证:**
    *   **单元测试 (Jest):** 核心业务逻辑（支付、状态机）覆盖率 > 80%。
    *   **集成测试 (Jest + Supertest):** 覆盖所有核心 API。
    *   **并发测试 (专项):**
        *   **测试场景:** 模拟高并发下诊所账户扣款。
        *   **压力指标:** 1000 并发下无数据不一致，P99 响应时间 < 500ms。
        *   **工具:** JMeter 或 Gatling。
    *   **E2E 测试:** 覆盖核心用户路径，由 QA 或前端主导。
*   **7.3. 协作与沟通机制:**
    *   **API 契约确认:** Week 2 完成核心 API 的 OpenAPI 规范评审。
    *   **Mock 数据提供:** Week 3 提供核心 API 的 Mock 数据 (Prism/MSW)。
    *   **联调测试:** Week 6 开始核心流程的联调测试。
*   **7.4. 监控与运维策略:**
    *   **实时监控:** Supabase 监控 + NestJS 集成 Prometheus/Grafana。
    *   **告警机制:** Sentry (错误追踪) + Grafana (性能告警)。
    *   **日志记录:** NestJS Logger + Winston，所有 API 记录访问日志，敏感操作记录审计日志。

---

### **8. MVP 1.0 后端开发任务拆解与顺序 (修订版)**

**Phase 0: 技术决策与准备 (已完成)** ✅

**Phase 1: 核心基础设施与服务搭建 (修正为 6-8 周)**

| 任务 (Task) | 优先级 | 预计时间 | 核心攻关与产出 | 当前状态 |
| :--- | :---: | :---: | :--- | :---: |
| **1. 数据库 Schema 实现与初始化** | **P0** | Week 1-2 | **攻关:** 实现并发控制约束和审计表。<br>**产出:** 可用的数据库 Schema (Prisma Migrations)。 | ✅ **已完成** |
| **2. NestJS 项目骨架与核心模块搭建** | **P0** | Week 1-2 | **攻关:** 实现全局异常过滤器、幂等性中间件。<br>**产出:** 可运行的 NestJS 项目骨架。 | ✅ **已完成** |
| **3. 用户认证与诊所账户基础服务** | **P0** | Week 2-3 | **攻关:** 实现并发安全的诊所账户 CRUD 和余额查询。<br>**产出:** 可用的用户认证和诊所账户管理 API。 | ✅ **已完成** |
| **4. 药品信息管理服务** | **P1** | Week 3-4 | **攻关:** 实现高效的药品搜索 API。<br>**产出:** 可用的药品查询 API。 | 📋 **待开始** |
| **5. 核心支付服务 (重点攻关)** | **P0** | Week 4-6 | **攻关:** **实现原子性扣款逻辑（乐观锁+事务）**、**幂等性检查**、**完整的错误处理和回滚机制**，并完成压力测试。<br>**产出:** 经过严格测试的、安全可靠的支付处理模块。 | 📋 **待开始** |
| **6. 订单状态管理与业务流程** | **P0** | Week 5-7 | **攻关:** 实现严格的状态机转换控制、**退款与订单过期处理的基础逻辑**。<br>**产出:** 完整的订单生命周期管理 API。 | 📋 **待开始** |
| **7. 文件服务与药房履约** | **P1** | Week 6-8 | **攻关:** 实现安全的文件上传和履约凭证的审核流程。<br>**产出:** 药房履约流程相关的 API。 | 📋 **待开始** |
| **8. 通知服务与监控** | **P1** | Week 7-8 | **攻关:** 实现关键业务节点的通知，并集成基础的监控和告警机制。<br>**产出:** 基础通知服务和监控配置。 | 📋 **待开始** |

**Phase 2: 核心流程完善与管理功能 (后续规划)**
    *   管理员手动审核履约凭证的完整流程实现。
    *   平台与药房结算的完整流程实现 (标记支付、发送回单)。
    *   患者端药房查找 API 的完善。
    *   医生推荐机制的完整实现。
    *   医师处方模板功能的完整实现。
    *   管理后台其他数据管理和操作 API 的完善。
    *   基础报表服务的 API 实现。
    *   安全加固和性能优化。
---

### **9. 风险识别与应对 (最终版)**

*   **9.1. P0 级别风险（阻塞发布）**
    1.  **并发控制风险:**
        *   **风险:** 高并发下账户余额不一致。
        *   **应对:** 强制使用数据库约束 + 乐观锁 + 压力测试验证。
        *   **验收标准:** 1000 并发下无数据不一致。
    2.  **支付安全风险:**
        *   **风险:** 重复扣款、负余额。
        *   **应对:** 幂等性机制 + CHECK 约束 + 完整审计。
        *   **验收标准:** 所有支付操作可追溯，零资金损失。
    3.  **状态一致性风险:**
        *   **风险:** 订单状态与资金状态不匹配。
        *   **应对:** 原子性事务 + 状态机严格控制。
        *   **验收标准:** 所有状态转换符合业务规则。
*   **9.2. 技术债务控制**
    *   **代码审查:** 所有支付相关代码必须经过 2 人以上审查。
    *   **测试覆盖率:** 核心支付逻辑测试覆盖率必须达到 95% 以上。
    *   **性能基准:** 支付接口 P99 响应时间不超过 500ms。
*   **9.3. 上线前检查清单**
    *   [ ] 数据库约束验证通过
    *   [ ] 并发测试通过（1000+ TPS）
    *   [ ] 幂等性测试通过
    *   [ ] 状态机测试覆盖所有转换路径
    *   [ ] 审计日志完整性验证
    *   [ ] 错误处理场景测试
    *   [ ] 监控告警配置完成

---

### **10. 附录：核心设计图表与规范**

#### **10.1. 核心数据库表结构设计 (修订版)**
*本节内联了架构师的 P0 级修正建议。*

##### **10.1.1 用户、诊所、药品、药房基础表**
*(此处省略 `user_profiles`, `clinics`, `medicines`, `pharmacies` 的 `CREATE TABLE` 语句，内容同 v1.2，保持不变)*

##### **10.1.2 处方/订单核心表 (含修正)**
```sql
-- 处方/订单表 (核心业务实体)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_order_id VARCHAR(50) UNIQUE NOT NULL,
    practitioner_id UUID REFERENCES user_profiles(id),
    patient_id UUID REFERENCES user_profiles(id),
    clinic_id UUID REFERENCES clinics(id),
    patient_info JSONB NOT NULL,
    -- 订单状态管理 (采纳统一状态机)
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' 
        CHECK (status IN ('DRAFT', 'PAYMENT_FAILED', 'PAID', 'PENDING_REVIEW', 'REJECTED', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    assigned_pharmacy_id UUID REFERENCES pharmacies(id),
    dispensed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    qr_code_data TEXT,
    pdf_url TEXT,
    -- 新增：版本控制与幂等性
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### **10.1.3 诊所账户表 (关键修正)**
```sql
-- 诊所账户表 (P0 级修正)
CREATE TABLE clinic_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0), -- ✅ 防止负余额
    credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    used_credit DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (used_credit >= 0 AND used_credit <= credit_limit),
    available_credit DECIMAL(12,2) GENERATED ALWAYS AS (credit_limit - used_credit) STORED, -- ✅ 自动计算可用额度
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'frozen')),
    version INTEGER NOT NULL DEFAULT 1, -- ✅ 乐观锁版本控制
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- ✅ 关键约束
    UNIQUE(clinic_id), -- 一个诊所只能有一个账户
    CHECK (balance + available_credit >= 0) -- 总可用资金不能为负
);
```

##### **10.1.4 账户交易审计表 (P0 级新增)**
```sql
-- 资金流水审计表 (P0 级新增)
CREATE TABLE account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES clinic_accounts(id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEBIT', 'CREDIT', 'REFUND', 'ADJUSTMENT')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    credit_before DECIMAL(12,2) NOT NULL,
    credit_after DECIMAL(12,2) NOT NULL,
    reference_type VARCHAR(20) CHECK (reference_type IN ('ORDER', 'RECHARGE', 'REFUND', 'MANUAL')),
    reference_id UUID,
    description TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- ✅ 审计完整性约束
    CHECK (balance_after = balance_before + CASE WHEN transaction_type IN ('CREDIT', 'REFUND') THEN amount ELSE -amount END)
);
```
*(...其他表结构保持不变...)*

#### **10.2. API 设计规范与核心端点 (修订版)**
*本节内联了架构师的 P0 级修正建议。*

##### **10.2.1 API 设计原则 (修订)**
*   **统一响应格式:** (同 v1.2)
*   **认证机制:** (同 v1.2)
*   **分页标准:** (同 v1.2)
*   **幂等性保证 (新增):** 所有创建或修改关键资源（如订单、支付）的 `POST`/`PATCH` 请求，客户端必须在请求头中提供 `Idempotency-Key`。后端必须进行验证，防止重复操作。

##### **10.2.2 核心 API 端点定义 (修订)**
*   **`POST /api/v1/orders` (创建订单/处方) - 关键修正:**
    *   **请求头:** 必须包含 `Idempotency-Key: <uuid>`。
    *   **请求体:** 必须包含 `expectedTotal` (前端计算的预期总额)，用于后端校验。
    *   **成功响应:** 明确返回 `status: 'PAID' | 'PAYMENT_FAILED'`，并包含扣款后的账户余额 `accountBalance`。
    *   **错误响应:** 严格遵循定义的支付错误码 (`PaymentErrorCodes`)，并返回详细的错误信息 `details`。

##### **10.2.3 错误码规范 (修订)**
*   **HTTP 状态码:** 明确 `409 Conflict` 用于并发更新失败，`422 Unprocessable Entity` 用于业务规则验证失败（如余额不足）。
*   **业务错误码:** 采纳架构师建议，补充完整的 `PaymentErrorCodes` 和 `BusinessErrorCodes`。

#### **10.3. 部署架构设计**
*(本节内容引用 `MVP 1.0 部署架构设计.md`，保持不变)*

#### **10.4. 用户角色权限矩阵**
*(本节内容引用产品经理提供的最终版)*

#### **10.5. 业务规则决策表**
*(本节内容引用产品经理提供的最终版，需确保与统一的状态机和支付流程一致)*

#### **10.6. 前后端数据交互格式表示例**
*(本节内容引用前端 Leader 提供的最终版，需确保与最新的 API 规范一致)*

#### **10.7. UI 状态与后端状态映射表示例**
*(本节内容引用前端 Leader 提供的最终版，需确保与统一的状态机一致)*

#### **10.8. 统一订单状态机定义 (最终版)**
*   **状态列表:** `DRAFT`, `PAYMENT_FAILED`, `PAID`, `PENDING_REVIEW`, `REJECTED`, `FULFILLED`, `CANCELLED`, `EXPIRED`。
*   **逻辑说明:** (采纳产品经理的最终定义)
    *   `PENDING_PAYMENT` 状态在实时扣款模式下被逻辑上跳过，订单直接从 `DRAFT` 流向 `PAID` 或 `PAYMENT_FAILED`。
    *   `CANCELLED` 和 `EXPIRED` 状态必须触发退款到诊所账户的业务逻辑。

#### **10.9. MVP 1.0 核心支付流程 (原子性扣款 - 最终版)**
*   **流程描述:**
    1.  **预检查:** 验证幂等键、账户状态、订单基本信息。
    2.  **原子性扣款 (数据库事务):**
        *   使用**乐观锁** (`version` 字段) 和 `WHERE` 子句中的余额检查，在一个 `UPDATE` 语句中安全地更新 `clinic_accounts`。
        *   若更新失败（行数为0），则回滚并返回并发冲突或余额不足错误。
        *   在 `orders` 表中创建状态为 `PAID` 的订单。
        *   在 `account_transactions` 表中记录详细的 `DEBIT` 流水。
        *   提交事务。
    3.  **凭证生成:** 事务成功后，再执行 QR 码和 PDF 的生成。

#### **10.10. 并发控制与事务管理策略 (新增)**
*   **并发控制:**
    *   **核心机制:** 乐观并发控制 (OCC)。
    *   **实现:** 在所有需要并发安全更新的表（如 `clinic_accounts`, `orders`）中添加 `version` 字段。每次 `UPDATE` 操作都必须检查并递增 `version`。
    *   **重试策略:** 对于因 `version` 冲突导致的更新失败，应用层（Backend）应实现带指数退避的重试机制（最多3次）。
*   **事务管理:**
    *   **工具:** Prisma `$transaction` API。
    *   **原则:** 仅将必须保持原子性的数据库写操作放入事务中。避免在事务中包含耗时的 I/O 操作或第三方 API 调用。
    *   **隔离级别:** 关键支付事务推荐使用 `SERIALIZABLE` 隔离级别，以提供最高级别的一致性保证。