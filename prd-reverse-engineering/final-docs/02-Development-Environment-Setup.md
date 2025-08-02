# 开发环境配置指南

## 1. 技术转移环境要求

### 1.1 基础运行环境
**Node.js生态系统**：
- Node.js 18+ LTS Runtime（支持最新TypeScript特性）
- npm/yarn包管理器（依赖锁定和版本控制）
- TypeScript 5.x编译器（严格类型检查）

**开发工具链要求**：
- Git版本控制（分支管理和协作开发）
- Docker容器化平台（可选，统一开发环境）
- 代码编辑器（支持TypeScript/NestJS开发）

### 1.2 核心依赖库架构
**🚨 SUPABASE优先技术栈**（强制要求）：
- @supabase/supabase-js（Supabase客户端SDK）
- @supabase/auth-helpers-nextjs（Next.js认证集成）
- @supabase/realtime-js（实时数据订阅）
- @supabase/storage-js（文件存储服务）

**后端补充框架（可选）**：
- @nestjs/common、@nestjs/core（仅用于复杂业务逻辑）
- @nestjs/config（环境配置管理）
- @nestjs/swagger（API文档生成）
- ❌ 移除：@nestjs/jwt、@nestjs/passport、passport相关（被Supabase Auth替代）

**业务集成服务**：
- stripe（支付处理）
- nodemailer（邮件服务）
- bcrypt（密码加密）
- qrcode（二维码生成）

**开发测试工具**：
- class-validator、class-transformer（数据验证）
- jest、supertest（单元和集成测试）
- eslint、prettier（代码质量控制）

## 2. 数据库环境配置

### 2.1 Supabase云数据库集成
**🚨 Supabase原生连接配置**（强制要求）：
- NEXT_PUBLIC_SUPABASE_URL：Supabase项目URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY：客户端公开密钥
- SUPABASE_SERVICE_ROLE_KEY：服务端管理密钥（仅后端）
- 环境变量管理：开发/测试/生产环境隔离

**Supabase项目核心配置**：
- PostgreSQL 15+数据库实例（Supabase托管）
- Supabase Auth（GoTrue）认证服务
- Row Level Security (RLS)策略（替代应用层权限）
- 实时订阅和WebSocket连接
- API自动生成（REST + GraphQL）

### 2.2 Supabase CLI数据库管理
**🚨 Supabase原生迁移管理**（替代Prisma）：
- Supabase CLI：supabase migration new、supabase db push
- SQL迁移文件：supabase/migrations/*.sql
- 类型生成：supabase gen types typescript
- 种子数据：supabase/seed.sql（supabase db reset --include-seed）

**性能和监控（Supabase内置）**：
- 连接池自动管理（PgBouncer）
- 查询优化和自动索引建议
- 实时性能监控（Supabase Dashboard）
- 数据库备份和恢复（自动化）

## 3. 第三方服务集成配置

### 3.1 Stripe支付服务集成
**Stripe账户配置要求**：
- 测试环境密钥（pk_test_、sk_test_）
- 生产环境密钥（pk_live_、sk_live_）
- Webhook端点配置和密钥验证
- 支付方式和货币设置

**Stripe CLI工具集成**：
- 本地Webhook测试环境
- 事件模拟和调试工具
- 日志监控和错误追踪
- 生产环境集成测试

### 3.2 SMTP邮件服务配置
**邮件服务提供商选择**：
- Gmail/Outlook/SendGrid等SMTP服务
- 应用专用密码配置
- 发件人身份验证设置
- 邮件模板和国际化支持

### 3.3 Supabase Storage文件存储
**🚨 Supabase Storage集成**（替代本地存储）：
- Bucket创建和权限配置（RLS策略）
- 文件上传API：supabase.storage.from('bucket')
- 文件类型和大小限制（Storage策略）
- 自动CDN和图片转换
- 安全URL生成和过期控制

## 4. MCP多重上下文协定工具

### 4.1 MCP协议集成配置
**Claude MCP Server设置**：
- 文件系统上下文服务器
- 数据库上下文服务器
- Git版本控制上下文服务器
- 项目特定上下文配置

**上下文协定配置文件**：
- 项目技术栈定义
- 业务领域边界设置
- 开发阶段状态管理
- 协作工作流程配置

### 4.2 开发协作增强
**AI辅助开发环境**：
- 代码补全和智能提示
- 文档生成和维护
- 错误诊断和修复建议
- 重构和优化建议

## 5. GitHub版本管理配置

### 5.1 代码仓库管理策略
**分支管理模型**：
- main主分支（生产环境代码）
- develop开发分支（集成测试环境）
- feature/*功能分支（功能开发）
- hotfix/*热修复分支（紧急修复）

**代码审查流程**：
- Pull Request模板和检查清单
- 代码审查规范和标准
- 自动化测试和构建检查
- 合并策略和分支保护规则

### 5.2 CI/CD自动化流程
**GitHub Actions工作流**：
- 代码质量检查（ESLint、Prettier）
- 单元测试和集成测试执行
- 构建和部署自动化
- 安全扫描和依赖检查

**代码质量控制工具**：
- Husky Git Hooks（提交前检查）
- 代码覆盖率报告
- 依赖安全漏洞扫描
- 性能监控和告警集成

## 6. 环境变量管理

### 6.1 配置分层管理
**环境配置策略**：
- .env.local（本地开发环境）
- .env.test（测试环境）
- .env.production（生产环境）
- 敏感配置加密和安全存储

### 6.2 关键配置项清单
**认证和安全配置**：
- ❌ 移除：JWT_SECRET、JWT_EXPIRES_IN（Supabase Auth自动管理）
- NEXT_PUBLIC_SUPABASE_URL（Supabase项目URL）
- NEXT_PUBLIC_SUPABASE_ANON_KEY（客户端密钥）
- SUPABASE_SERVICE_ROLE_KEY（服务端密钥）
- STRIPE_SECRET_KEY（Stripe支付集成）
- STRIPE_WEBHOOK_SECRET（Webhook验证）

**服务集成配置**：
- ❌ 移除：DATABASE_URL（Supabase SDK自动管理）
- SMTP服务配置（或使用Supabase Email）
- ❌ 移除：文件上传配置（Supabase Storage自动处理）
- Supabase Edge Functions配置（服务端逻辑）
- API限流和监控（Supabase内置）

## 7. 开发环境验证

### 7.1 环境完整性检查
**基础环境验证清单**：
- [ ] Node.js 18+ LTS和npm配置
- [ ] Supabase项目创建和API密钥配置
- [ ] Supabase CLI安装和登录验证
- [ ] Supabase Auth测试（注册/登录/logout）
- [ ] Stripe集成和Webhook测试
- [ ] Supabase Storage上传测试
- [ ] Git仓库和CI/CD配置

### 7.2 集成测试验证
**功能集成测试**：
- Supabase连接和健康检查
- Supabase Auth认证流程测试
- Row Level Security (RLS)权限测试
- Supabase Realtime订阅测试
- Supabase Storage文件操作测试
- Stripe支付集成测试
- Edge Functions部署和调用测试

---

**技术转移完成标准**：开发环境配置完成后，团队成员应能独立完成项目构建、测试运行和基础功能开发。