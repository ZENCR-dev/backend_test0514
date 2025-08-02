# 后端架构技术规范

## 1. 系统架构总览

### 1.1 🚨 Supabase优先架构设计
**Supabase原生三层架构**（强制要求）：
- **Frontend Layer（前端层）**：Vercel Next.js + Supabase Client，直接调用Supabase API
- **Supabase Layer（数据服务层）**：PostgreSQL + GoTrue Auth + RLS + Realtime + Storage
- **Backend Layer（补充业务层）**：NestJS Edge Functions，仅处理复杂业务逻辑

**🚨 架构优先级原则**：
- Supabase原生功能优先：Auth、RLS、Realtime、Storage直接使用
- Edge Functions补充：仅在Supabase无法满足时添加后端逻辑
- 避免重复实现：不得重建Supabase已有功能（认证、数据访问、实时订阅）

### 1.2 Supabase模块化架构设计
**🚨 Supabase原生模块**（不可替代）：
- **Supabase Auth Module**：auth.users表 + GoTrue认证（替代自定义AuthModule）
- **Database Module**：PostgreSQL + RLS策略（替代Prisma访问控制）
- **Realtime Module**：实时数据订阅（替代事件驱动架构）
- **Storage Module**：文件上传存储（替代本地文件系统）

**补充业务模块**（必要时添加）：
- **Payment Edge Function**：Stripe集成和复杂支付逻辑
- **Prescription Edge Function**：处方业务规则和价格计算
- **Pharmacy Edge Function**：药房履约和批量结算逻辑
- **Monitoring Edge Function**：API日志聚合和业务指标计算

## 2. 业务逻辑架构

### 2.1 核心业务流程实现策略
**处方完整生命周期技术控制**：
- 处方创建阶段：验证医师权限、药品存在性、业务规则校验
- 支付处理阶段：事务控制账户扣费、状态流转、QR码生成
- 履约审核阶段：药房扫码验证、凭证上传、PO自动生成
- 平台审核阶段：管理员审核、成本确认、资金划转

**业务规则引擎实现**：
- 状态机控制：严格的处方状态转换和前置条件验证
- 价格约束验证：药房价格表basePrice上限控制机制
- 资金安全控制：乐观锁并发控制和事务原子性保障

### 2.2 🚨 服务器端价格计算架构
**安全价格计算策略**（强制要求）：
- **❌ 禁止前端计算**：防止价格操控和安全风险
- **✅ Edge Function计算**：所有价格逻辑在Supabase Edge Functions执行
- **✅ 数据库约束**：basePrice字段设置CHECK约束防止负值
- **✅ RLS策略保护**：价格数据读写权限通过RLS严格控制

**NZD cents精确计算实现**：
- 数据库存储：所有金额以cents为单位存储（INTEGER类型）
- 前端展示：除以100转换为NZD dollar显示
- 计算精度：避免浮点数精度问题和币值舍入错误
- 审计合规：符合金融系统精度要求和审计标准

### 2.3 资金流控制机制
**医师账户管理策略**：
- 余额保障机制：MVP阶段基于余额的账户模式
- 并发扣款控制：乐观锁版本控制防止并发问题
- 事务原子性：关键资金操作使用数据库事务包装
- 异常恢复机制：扣费失败时自动回滚和状态修复

**药房结算管理策略**：
- 延迟结算模式：履约PO审核通过后确认成本
- 批量提现机制：降低结算成本和提高效率
- 审核控制流程：管理员审核异常成本和合规性
- 现金流管理：收入成本时间差形成资金使用空间

## 3. 🚨 Supabase Auth认证架构

### 3.1 Supabase Auth实现策略
**GoTrue认证系统**（替代自定义JWT）：
- **🚨 强制使用**：Supabase Auth (GoTrue) 替代所有自定义认证逻辑
- **JWT自动管理**：Supabase自动处理JWT签发、验证、刷新
- **多种登录方式**：邮箱密码、魔法链接、OAuth提供商
- **会话管理**：基于Cookie的安全会话管理（supabase-ssr）

**认证集成架构**：
- ❌ 移除：JwtAuthGuard、Passport策略、自定义JWT验证
- ✅ 使用：supabase.auth.getClaims()、RLS策略、auth.users表（替代getUser()）
- ✅ JWT验证：推荐使用supabase.auth.getClaims()进行安全令牌验证
- ✅ 权限验证：通过RLS策略在数据库层面控制访问权限
- ✅ 用户上下文：通过auth.users.id关联业务数据

### 3.2 Row Level Security (RLS) 权限控制
**🚨 数据库层权限控制**（替代应用层RBAC）：
- **RLS策略定义**：在PostgreSQL中直接定义数据访问规则
- **用户角色隔离**：基于auth.users.id和user_metadata.role自动过滤数据
- **细粒度权限**：表级、行级、列级权限控制
- **自动执行**：所有数据库查询自动应用RLS策略，无需应用代码干预

**角色权限策略实现**：
```sql
-- 医师仅能访问自有处方
CREATE POLICY practitioner_own_data ON prescriptions 
FOR ALL TO authenticated 
USING (auth.uid() = doctor_id);

-- 药房仅能处理分配订单
CREATE POLICY pharmacy_assigned_orders ON purchase_orders 
FOR ALL TO authenticated 
USING (pharmacy_id IN (SELECT id FROM pharmacies WHERE operator_id = auth.uid()));

-- 管理员全局访问（通过user_metadata.role判断）
CREATE POLICY admin_full_access ON prescriptions 
FOR ALL TO authenticated 
USING (auth.jwt()->>'role' = 'admin');
```

### 3.3 🚨 JWT签名密钥系统架构

**现代JWT签名密钥系统**（替代传统JWT secret）：
- **🚨 推荐算法**：ES256 (NIST P-256椭圆曲线) - 更快速度，更短签名
- **安全优势**：公钥加密体系，私钥不可提取，零停机轮换
- **密钥发现**：自动JWKS端点暴露公钥用于验证
- **兼容性**：Web Crypto API原生支持，跨平台兼容

**JWKS公钥发现端点**：
```http
GET https://project-id.supabase.co/auth/v1/.well-known/jwks.json
```

**密钥验证最佳实践**：
```typescript
// 推荐：使用Supabase官方方法
const { data: claims, error } = await supabase.auth.getClaims()
if (!error && claims) {
  // JWT自动验证完成，claims包含用户信息
}

// 第三方集成：使用JWKS验证
import { jwtVerify, createRemoteJWKSet } from 'jose'

const JWKS = createRemoteJWKSet(
  new URL('https://project-id.supabase.co/auth/v1/.well-known/jwks.json')
)

async function verifyToken(jwt: string) {
  return jwtVerify(jwt, JWKS)
}
```

**零停机密钥轮换流程**：
1. **创建备用密钥**：新密钥进入standby状态，JWKS端点开始广播
2. **等待缓存更新**：等待10分钟缓存刷新，确保所有客户端获取新公钥
3. **执行密钥轮换**：激活新密钥，旧密钥移至previously used状态
4. **验证运行状态**：监控应用，确认JWT验证正常工作
5. **撤销旧密钥**：等待令牌过期（默认1小时）后撤销旧密钥

### 3.4 🚨 隐私合规和安全控制
**患者隐私保护**（强制要求）：
- **❌ 禁止收集**：不得在prescriptions表中存储patientName等个人信息
- **✅ 匿名处方**：处方仅包含医师信息、药品信息、用法用量
- **✅ 数据脱敏**：所有日志和监控数据必须脱敏处理
- **✅ 审计合规**：符合GDPR、HIPAA等隐私保护法规要求

**Supabase安全机制**：
- **密码管理**：Supabase Auth自动处理密码哈希和盐值
- **会话安全**：基于httpOnly Cookie和CSRF保护
- **API安全**：自动HTTPS、CORS配置、请求限流
- **数据加密**：数据库连接和数据传输端到端加密

## 4. 事件驱动架构

### 4.1 事件系统设计原则
**业务事件定义策略**：
- 处方生命周期事件：Created、Paid、Fulfilled、Cancelled
- 账户变更事件：BalanceChanged、TransactionCreated
- 审核流程事件：PriceListApproved、PurchaseOrderReviewed
- 系统监控事件：ApiCallLogged、PerformanceAlert

**事件发布订阅机制**：
- EventEmitter2集成：基于Node.js事件发射器的异步处理
- 事件负载设计：包含必要的业务数据和上下文信息
- 错误处理策略：事件处理失败时的重试和补偿机制
- 性能优化：异步事件处理避免阻塞主业务流程

### 4.2 事件处理器实现策略
**领域事件处理架构**：
- 处方事件处理：支付成功后QR码生成和通知发送
- 履约事件处理：凭证上传后PO生成和审核触发
- 账户事件处理：余额变更时审计日志和监控告警
- 审核事件处理：审核完成后状态更新和资金划转

**事件处理可靠性保障**：
- 事务性事件：关键业务事件与数据库事务绑定
- 补偿处理：事件处理失败时的自动补偿机制
- 幂等性设计：重复事件处理的幂等性保障
- 监控告警：事件处理异常的实时监控和告警

## 5. 错误处理架构

### 5.1 全局异常处理策略
**统一错误响应格式**：
- 标准化错误结构：success、error字段的一致性
- 错误码体系：业务错误码和HTTP状态码映射
- 错误信息国际化：支持多语言错误消息
- 调试信息控制：开发环境详细信息、生产环境安全信息

**异常分类和处理策略**：
- HTTP异常：基于NestJS内置异常的标准处理
- 业务异常：自定义业务异常类型和处理逻辑
- 系统异常：数据库连接、第三方服务异常处理
- 验证异常：数据验证失败的详细错误信息

### 5.2 业务异常设计原则
**自定义异常体系**：
- InsufficientBalanceException：账户余额不足异常
- PriceListViolationException：价格表违规异常
- UnauthorizedAccessException：无权限访问异常
- ValidationException：业务数据验证异常

**异常处理最佳实践**：
- 异常链追踪：完整的异常调用栈和上下文信息
- 敏感信息保护：异常信息中的敏感数据脱敏
- 日志记录策略：异常发生时的详细日志记录
- 用户友好提示：技术异常转换为用户可理解的错误信息

## 6. 🚨 Supabase配置管理架构

### 6.1 🚨 Supabase环境配置策略
**Supabase分层配置管理**：
- **项目环境隔离**：开发、测试、生产三个Supabase项目
- **密钥安全管理**：ANON_KEY公开，SERVICE_ROLE_KEY严格保密
- **自动环境检测**：Supabase SDK自动检测环境和选择配置
- **热更新支持**：Edge Functions支持无停机配置更新

**配置项分类管理**：
- **Supabase核心配置**：
  - NEXT_PUBLIC_SUPABASE_URL（公开配置）
  - NEXT_PUBLIC_SUPABASE_ANON_KEY（公开配置）  
  - SUPABASE_SERVICE_ROLE_KEY（私密配置）
- **业务集成配置**：
  - STRIPE_SECRET_KEY（支付集成）
  - SMTP_CONFIG（邮件服务）
  - ❌ 移除：DATABASE_URL、JWT_SECRET（Supabase自动管理）

### 6.2 🚨 Supabase配置验证和安全
**Supabase配置有效性验证**：
- **SDK连接验证**：启动时自动验证Supabase连接和密钥有效性
- **JWT签名密钥验证**：检查JWKS端点可访问性和密钥算法兼容性
- **RLS策略检查**：自动检测必要的RLS策略是否启用
- **权限验证**：验证ANON_KEY和SERVICE_ROLE_KEY权限范围
- **环境一致性**：确保前后端使用相同Supabase项目

**Supabase安全管理**：
- **密钥轮换**：Supabase Dashboard支持在线密钥重新生成
- **JWT签名密钥管理**：支持ES256等现代算法，零停机轮换
- **访问控制**：基于Supabase组织和项目级别的权限管理
- **审计日志**：Supabase自动记录所有API调用和配置变更，包含密钥轮换历史
- **安全扫描**：Supabase内置安全扫描和漏洞检测机制

## 7. 监控与日志架构

### 7.1 API监控实现策略
**中间件监控架构**：
- 请求响应时间监控：API端点性能指标收集
- 请求量统计：API调用频次和趋势分析
- 错误率监控：API失败率和错误类型统计
- 用户行为分析：基于用户ID的操作行为追踪

**性能指标收集机制**：
- 响应时间分布：P50、P95、P99百分位性能分析
- 吞吐量监控：每秒请求数和并发连接数
- 资源使用监控：CPU、内存、数据库连接使用率
- 慢查询检测：数据库查询性能分析和优化建议

### 7.2 业务监控指标设计
**关键业务指标监控**：
- 处方业务指标：创建量、支付量、履约率、取消率
- 用户活跃指标：日活用户、留存率、转化率
- 财务健康指标：收入、成本、利润率趋势
- 系统健康指标：可用性、响应时间、错误率

**告警机制设计**：
- 阈值告警：关键指标超出预设阈值时自动告警
- 趋势告警：指标异常变化趋势的预警机制
- 业务告警：关键业务流程异常的实时通知
- 系统告警：系统资源和服务可用性告警

### 7.3 日志管理策略
**分层日志设计**：
- 访问日志：HTTP请求响应的详细记录
- 业务日志：关键业务操作和状态变更记录
- 错误日志：异常和错误的详细信息记录
- 审计日志：安全相关操作的完整审计链

**日志处理和分析**：
- 结构化日志：JSON格式的标准化日志结构
- 日志聚合：基于时间窗口的日志数据聚合
- 日志检索：高效的日志查询和过滤机制
- 日志保留：基于合规要求的日志保留策略

---

**架构技术转移完成标准**：Supabase优先架构规范文档完成后，开发团队应能理解Supabase原生功能和补充系统的整体设计思路，独立完成数据库设计、RLS策略实现和Edge Functions开发。