# API设计规范指南

## 1. API架构设计原则

### 1.1 RESTful API设计标准
**API版本控制策略**：
- URI版本控制模式：`/api/v1/{resource}`统一路径结构
- 版本递增策略：主版本号递增确保向后兼容性
- 默认版本机制：v1作为当前唯一版本基准
- 弃用策略：通过Sunset头部提供6个月迁移期

**HTTP方法语义规范**：
- GET方法：资源查询操作（幂等、安全）
- POST方法：资源创建操作（非幂等）
- PUT方法：完整资源更新（幂等）
- PATCH方法：部分资源更新（非幂等）
- DELETE方法：资源删除操作（幂等）

### 1.2 统一响应格式标准
**ApiResponse标准化设计**：
- success字段：Boolean类型表示操作成功状态
- data字段：泛型数据载荷承载业务数据
- error字段：错误信息对象包含code、message、details
- pagination字段：分页信息包含page、limit、total、totalPages

**响应格式一致性原则**：
- 成功响应：success=true，data包含业务数据
- 错误响应：success=false，error包含详细错误信息
- 时间戳标准：ISO 8601格式统一时间表示
- 请求追踪：requestId字段支持请求链路追踪

### 1.3 认证授权设计标准
**JWT Bearer Token认证**：
- Authorization头部：Bearer <jwt_token>标准格式
- JWT载荷设计：userId、email、role核心用户信息
- 令牌过期管理：access_token短期、refresh_token长期策略
- 权限控制：基于角色的端点访问控制

**权限验证装饰器模式**：
- @UseGuards装饰器：JwtAuthGuard、RolesGuard组合验证
- @Roles装饰器：声明式角色权限要求
- @User装饰器：用户上下文信息注入
- 权限继承：管理员权限包含其他角色权限

## 2. 用户认证API设计

### 2.1 认证端点设计规范
**核心认证功能端点**：
- POST /api/v1/auth/register：用户注册端点
- POST /api/v1/auth/login：用户登录端点
- POST /api/v1/auth/refresh：令牌刷新端点
- POST /api/v1/auth/logout：用户登出端点
- GET /api/v1/auth/profile：用户信息获取端点

**注册流程设计**：
- 输入验证：邮箱格式、密码强度、角色有效性
- 数据处理：密码加密、用户状态初始化、推荐码生成
- 响应设计：用户基础信息返回，敏感信息脱敏
- 异常处理：邮箱重复、验证失败的标准错误响应

### 2.2 认证DTO设计规范
**RegisterDto验证规则**：
- email字段：@IsEmail验证、@IsNotEmpty非空约束
- password字段：@MinLength(8)长度、@Matches复杂度验证
- role字段：@IsEnum(UserRole)枚举验证
- profile字段：@ValidateNested嵌套对象验证

**LoginDto设计原则**：
- 最小化输入：仅email和password必需字段
- 输入验证：邮箱格式和密码非空验证
- 安全考虑：避免敏感信息在URL中传输
- 响应设计：包含访问令牌、刷新令牌、用户信息

### 2.3 会话管理设计
**令牌管理策略**：
- 访问令牌：短期有效期（默认7天）用于API访问
- 刷新令牌：长期有效期（默认30天）用于令牌续期
- 令牌撤销：支持主动登出和令牌黑名单机制
- 安全传输：HTTPS强制要求和安全存储建议

## 3. 处方管理API设计

### 3.1 处方CRUD端点规范
**处方核心端点设计**：
- POST /api/v1/prescriptions：创建处方（医师权限）
- GET /api/v1/prescriptions：获取处方列表（医师、管理员）
- GET /api/v1/prescriptions/:id：获取处方详情（医师、管理员）
- POST /api/v1/prescriptions/:id/pay：支付处方（医师权限）
- POST /api/v1/prescriptions/:id/fulfill：履约处方（药房权限）

**查询参数设计标准**：
- 分页参数：page（页码）、limit（每页数量）
- 过滤参数：status（处方状态）、startDate/endDate（时间范围）
- 排序参数：sortBy（排序字段）、sortOrder（排序方向）
- 搜索参数：prescriptionId（处方号）、doctorId（医师ID）

### 3.2 处方业务DTO设计
**CreatePrescriptionDto结构**：
- copies字段：@IsInt、@Min(1)、@Max(30)帖数验证
- medicines字段：@ValidateNested数组、@ArrayMinSize(1)非空验证
- 每个药品项：medicineId、weight、dosageInstructions、additionalNotes

**PrescriptionDto响应设计**：
- 基础信息：id、prescriptionId、doctorId、copies、totalAmount
- 状态信息：status、paymentStatus、paymentAmount、paidAt
- 关联数据：medicines数组、qrCodeData、创建更新时间
- 敏感信息控制：基于用户角色的数据可见性

### 3.3 处方支付流程设计
**支付端点设计原则**：
- 幂等性保障：支付操作的重复请求保护
- 事务控制：账户扣费与状态更新的原子性
- 异常处理：余额不足、支付失败的错误响应
- 状态流转：DRAFT → PAID状态的严格控制

## 4. 药房管理API设计

### 4.1 药房基础信息端点
**药房信息管理端点**：
- GET /api/v1/pharmacy/profile：获取药房信息（药房、管理员）
- PUT /api/v1/pharmacy/profile：更新药房信息（药房权限）
- GET /api/v1/pharmacy/account：获取账户信息（药房、管理员）
- POST /api/v1/pharmacy/withdrawal-requests：申请提现（药房权限）

### 4.2 价格表管理端点设计
**价格表核心端点**：
- POST /api/v1/pharmacy/price-lists：上传价格表（药房权限）
- GET /api/v1/pharmacy/price-lists：获取价格表列表（药房、管理员）
- GET /api/v1/pharmacy/price-lists/:id：获取价格表详情
- POST /api/v1/pharmacy/price-lists/:id/approve：审核通过（管理员）
- POST /api/v1/pharmacy/price-lists/:id/reject：审核拒绝（管理员）

**价格表上传设计**：
- 文件格式：支持CSV、Excel格式文件上传
- 数据验证：药品SKU、价格格式、数据完整性验证
- basePrice约束：自动检测价格违规和风险评估
- 版本控制：自动生成版本号和生效时间管理

### 4.3 采购订单管理设计
**采购订单端点规范**：
- GET /api/v1/purchase-orders：获取采购订单列表（药房、管理员）
- GET /api/v1/purchase-orders/:id：获取订单详情
- POST /api/v1/purchase-orders/:id/approve：审核通过（管理员）
- POST /api/v1/purchase-orders/:id/reject：审核拒绝（管理员）

**履约流程设计**：
- 扫码验证：基于QR码的处方验证机制
- 凭证上传：支持多文件上传的履约证明
- 自动生成：基于履约数据自动生成采购订单
- 审核机制：管理员审核履约真实性和完整性

## 5. 账户管理API设计

### 5.1 医师账户端点设计
**医师账户管理端点**：
- GET /api/v1/practitioner/account：获取账户信息（医师、管理员）
- POST /api/v1/practitioner/account/recharge：账户充值（医师权限）
- GET /api/v1/practitioner/account/transactions：交易记录（医师、管理员）
- GET /api/v1/practitioner/account/balance：余额查询（医师、管理员）

**充值流程设计**：
- 支付集成：Stripe支付网关集成和回调处理
- 金额验证：充值金额范围和格式验证
- 支付确认：异步支付确认和账户余额更新
- 交易记录：完整的充值交易记录和审计日志

### 5.2 药房账户端点设计
**药房账户管理端点**：
- GET /api/v1/pharmacy/account：获取账户信息（药房、管理员）
- GET /api/v1/pharmacy/account/transactions：交易记录查询
- POST /api/v1/pharmacy/withdrawal-requests：提现申请创建
- GET /api/v1/pharmacy/withdrawal-requests：提现申请列表

**提现流程设计**：
- 批量选择：支持多个PO的批量提现申请
- 银行信息：银行账户信息的安全存储和验证
- 发票管理：提现申请的发票号码生成和管理
- 审批流程：管理员审批和自动转账处理

## 6. 管理员API设计

### 6.1 系统管理端点规范
**管理员专用端点**：
- GET /api/v1/admin/users：用户管理（列表、审核、状态控制）
- GET /api/v1/admin/prescriptions：全局处方监控和管理
- GET /api/v1/admin/metrics/dashboard：业务指标仪表板
- GET /api/v1/admin/api-logs：API调用日志查询和分析

**用户审核流程**：
- 用户状态管理：pending → approved → suspended状态流转
- 审核权限：管理员专属的用户状态变更权限
- 审核记录：完整的审核操作记录和审计日志
- 批量操作：支持批量用户审核和状态更新

### 6.2 监控告警端点设计
**系统监控端点**：
- GET /api/v1/admin/metrics/api：API性能指标监控
- GET /api/v1/admin/metrics/business：业务关键指标监控
- GET /api/v1/admin/alerts：系统告警信息查询
- POST /api/v1/admin/alerts/:id/resolve：告警处理和解决

## 7. 通用API功能设计

### 7.1 健康检查端点
**系统健康监控**：
- GET /api/v1/health：基础健康检查（无需认证）
- GET /api/v1/health/detailed：详细健康检查（管理员权限）
- 检查项目：数据库连接、第三方服务、系统资源
- 响应格式：统一的健康状态响应结构

### 7.2 文件上传端点设计
**文件管理端点**：
- POST /api/v1/upload/fulfillment-proof：履约凭证上传
- POST /api/v1/upload/price-list：价格表文件上传
- POST /api/v1/upload/documents：通用文档上传
- 安全控制：文件类型、大小限制和恶意文件检测

### 7.3 Webhook集成设计
**外部服务集成**：
- POST /api/v1/webhooks/stripe：Stripe支付回调处理
- 签名验证：Webhook签名验证确保请求真实性
- 幂等处理：重复回调的幂等性保护机制
- 异步处理：回调数据的异步处理和状态更新

## 8. API文档和测试规范

### 8.1 OpenAPI文档标准
**Swagger文档配置**：
- API元信息：标题、描述、版本、联系方式
- 认证配置：JWT Bearer认证方案描述
- 标签分类：按业务模块组织API端点
- 示例数据：请求响应的完整示例

**文档内容规范**：
- 端点描述：清晰的操作描述和业务场景
- 参数说明：详细的参数类型、格式、验证规则
- 响应示例：成功和错误响应的完整示例
- 状态码说明：HTTP状态码的业务含义解释

### 8.2 API测试策略
**测试分层设计**：
- 单元测试：Controller层的独立功能测试
- 集成测试：Service层的业务逻辑测试
- E2E测试：完整业务流程的端到端测试
- 性能测试：API响应时间和并发能力测试

**测试数据管理**：
- 测试数据库：独立的测试环境数据库
- 数据清理：测试前后的数据清理策略
- Mock服务：第三方服务的Mock和Stub
- 测试覆盖率：代码覆盖率和业务场景覆盖率

## 9. API安全和性能规范

### 9.1 安全设计原则
**输入验证和过滤**：
- DTO验证：class-validator装饰器的输入验证
- SQL注入防护：Prisma ORM的参数化查询保护
- XSS防护：输出数据的HTML转义和CSP配置
- CSRF防护：状态令牌和同源策略验证

**访问控制和审计**：
- 权限验证：端点级别的角色权限控制
- 数据隔离：基于用户身份的数据访问限制
- 操作审计：关键操作的完整审计日志
- 异常监控：安全事件的实时监控和告警

### 9.2 性能优化设计
**查询优化策略**：
- 分页查询：合理的分页大小和游标分页
- 数据预加载：减少N+1查询问题的关联查询
- 缓存策略：热点数据的内存缓存和Redis缓存
- 索引优化：数据库查询的索引覆盖和性能优化

**并发控制设计**：
- 限流保护：API端点的请求频率限制
- 并发控制：关键资源的并发访问控制
- 超时设置：API请求的合理超时时间配置
- 熔断机制：系统过载时的服务降级和保护

---

**API设计技术转移完成标准**：API规范文档完成后，开发团队应能理解完整的API设计原则，独立完成RESTful API实现和集成测试。