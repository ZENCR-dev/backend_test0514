# 后端技术转移重启方案 - 技术概览

## 1. 项目技术总览

### 1.1 业务核心定义
**B2B2C中医处方履约平台**：
- **医师端**：处方创建、账户余额管理、QR码生成
- **药房端**：扫码履约、价格表管理、批量结算
- **平台端**：差价盈利、审核管理、资金调控

**收益模式**：basePrice(医师收费) - pharmacyPrice(药房成本) = 平台收益

### 1.2 技术栈确定规范
**🚨 SUPABASE优先架构**（强制要求）：
- **Database + Auth**: Supabase（PostgreSQL + GoTrue认证）
- **Frontend**: Vercel Next.js 14 + Supabase Starter Kit
- **Real-time**: Supabase Real-time subscriptions
- **Row Level Security**: Supabase RLS policies
- **Authentication**: Supabase Auth (替代自定义JWT)

**后端补充技术栈**：
- **Runtime**: Node.js 18+ LTS
- **API Framework**: NestJS 10.x（可选，主要用于复杂业务逻辑）
- **Data Access**: Supabase Client (替代Prisma)
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI 3.0

**第三方服务集成**（必需配置）：
- **Payment**: Stripe API（支付处理）
- **Email**: Supabase Email (或 Nodemailer)
- **File Storage**: Supabase Storage (替代本地文件系统)
- **Currency**: NZD cents精确到分（不采集患者隐私信息）

### 1.3 数据架构核心设计
**Supabase集成数据架构**（精确定义）：
1. **auth.users** - Supabase内置用户认证表（替代自定义User表）
2. **user_profiles** - 用户扩展信息（关联auth.users.id）
3. **medicines** - 药品主数据（basePrice基准价格，NZD cents）
4. **prescriptions** - 处方主表（❌不包含患者隐私信息）
5. **prescription_medicines** - 处方药品明细（重量+用法）
6. **practitioner_accounts** - 医师账户余额管理
7. **pharmacies + pharmacy_accounts** - 药房信息和账户余额
8. **pharmacy_price_lists** - 药房价格表和审核流程
9. **purchase_orders + fulfillment_proofs** - 履约订单和凭证
10. **withdrawal_requests** - 批量提现申请

**Row Level Security (RLS)策略**：
- 医师仅能访问自有数据（基于auth.uid()）
- 药房仅能处理分配的订单
- 管理员全局访问权限

**系统监控表**（可选）：
- **ApiCallLog** - API调用日志和性能监控

### 1.4 业务流程核心路径
**处方完整生命周期**：
```
医师登录 → 处方创建(DRAFT) → 账户扣款 → 处方支付(PAID) 
→ QR码生成 → 药房扫码 → 履约上传 → PO生成(PENDING_REVIEW) 
→ 管理员审核 → PO通过(APPROVED) → 药房余额更新 → 批量提现申请
```

**关键业务规则**（不可变更）：
- 医师仅能访问自有处方数据
- 药房价格表必须 ≤ basePrice（管理员审核）
- 所有资金操作使用Prisma事务保证
- 支付成功后立即确认平台收入
- PO审核通过后确认平台成本

## 2. 技术转移清单

### 2.1 开发环境必需配置
**本地开发环境**：
- [ ] Node.js 18+ + npm/yarn
- [ ] PostgreSQL 14+ 或 Docker
- [ ] VS Code + Extensions
- [ ] Git + GitHub CLI

**环境变量配置**：
- [ ] Supabase DATABASE_URL
- [ ] Stripe API Keys (Test/Live)  
- [ ] JWT SECRET_KEY
- [ ] SMTP配置

**开发工具集成**：
- [ ] Prisma CLI + Studio
- [ ] Stripe CLI (Webhook testing)
- [ ] Docker Compose (可选)
- [ ] MCP Context tools

### 2.2 代码仓库迁移
**GitHub仓库设置**：
- [ ] 新仓库创建和权限配置
- [ ] main分支保护规则
- [ ] PR模板和代码审查流程
- [ ] CI/CD Actions配置

**代码质量控制**：
- [ ] ESLint + Prettier配置
- [ ] Husky pre-commit hooks
- [ ] Jest测试环境配置
- [ ] TypeScript严格模式

### 2.3 部署运维准备
**容器化部署**（推荐）：
- [ ] Dockerfile多阶段构建
- [ ] docker-compose.yml编排
- [ ] 环境配置管理
- [ ] 健康检查配置

**监控告警系统**：
- [ ] API响应时间监控
- [ ] 数据库性能监控  
- [ ] 错误率告警配置
- [ ] 业务指标监控

## 3. 实施时间线

### 3.1 第一阶段：环境搭建（Week 1）
- Day 1-2：开发环境配置和依赖安装
- Day 3-4：数据库Schema迁移和种子数据
- Day 5：API基础框架和认证系统

### 3.2 第二阶段：核心功能（Week 2-3）
- Week 2：用户管理、处方管理、支付系统
- Week 3：药房管理、价格表审核、履约系统

### 3.3 第三阶段：集成测试（Week 4）
- Day 1-3：单元测试和集成测试
- Day 4-5：端到端测试和性能优化

### 3.4 第四阶段：部署上线（Week 5）
- Day 1-2：生产环境部署和配置
- Day 3-5：监控系统集成和上线验证

## 4. 成功验收标准

### 4.1 功能完整性验收
- [ ] 医师注册登录、处方创建、支付完成
- [ ] 药房注册登录、价格表管理、履约上传
- [ ] 管理员审核、PO处理、资金管理
- [ ] API文档完整、错误处理规范

### 4.2 性能质量验收
- [ ] API响应时间P95 < 500ms
- [ ] 数据库查询优化和索引覆盖
- [ ] 并发支持100用户同时操作
- [ ] 测试覆盖率 > 80%

### 4.3 安全合规验收
- [ ] JWT认证和RBAC权限控制
- [ ] 数据传输HTTPS加密
- [ ] 敏感信息脱敏和加密存储
- [ ] API调用审计日志完整

## 5. 风险控制措施

### 5.1 技术风险缓解
- **依赖版本锁定**：package-lock.json版本精确控制
- **数据库迁移安全**：Prisma迁移脚本review
- **第三方服务降级**：支付、邮件服务故障应急方案
- **性能瓶颈预防**：关键查询索引优化和监控

### 5.2 业务风险控制
- **数据一致性保证**：关键业务操作事务包装
- **账户安全防护**：并发扣款乐观锁机制
- **价格合规检查**：basePrice约束自动验证
- **审计合规要求**：完整操作日志和数据追踪

---

**后续文档导航**：
- 02-Development-Environment-Setup.md：完整开发环境配置指南
- 03-Backend-Architecture-Specification.md：系统架构和业务逻辑规范
- 04-Database-Schema-Implementation.md：数据库Schema和Prisma配置
- 05-API-Implementation-Guide.md：API设计和实现指南
- 06-Deployment-Operations-Guide.md：部署运维和监控指南