# 数据库Schema实现指南

## 1. 数据架构技术方案

### 1.1 数据库技术栈决策
**PostgreSQL + Prisma技术组合**：
- PostgreSQL 14+提供ACID事务保证和高级JSON支持
- Prisma 6.x实现类型安全ORM和现代化数据访问层
- Supabase云数据库托管服务（生产环境推荐）
- 时区标准化：统一使用Timestamptz确保跨时区一致性

**数据精度和类型标准**：
- 金额字段：Decimal(12,2)确保财务计算精度
- 时间戳：Timestamptz(6)支持微秒精度和时区感知
- 文本字段：VarChar长度限制和Text类型灵活存储
- JSON字段：复杂数据结构和扩展属性存储

### 1.2 数据建模设计原则
**领域驱动设计简化实现**：
- 8张核心业务表覆盖完整业务流程
- 聚合根设计：User、Prescription、Pharmacy作为主要实体
- 关联关系最小化：减少复杂JOIN查询优化性能
- JSON字段扩展：metadata、address、contact等灵活配置

**数据一致性保障机制**：
- 外键约束确保引用完整性
- 版本字段支持乐观锁并发控制
- 唯一约束防止业务逻辑重复
- 级联删除策略维护数据完整性

## 2. 核心数据模型架构

### 2.1 用户认证数据架构
**User主表设计要素**：
- 全局唯一标识符（CUID生成策略）
- 角色枚举体系：practitioner、pharmacy_operator、admin
- 用户状态管理：pending、approved、suspended
- 认证安全机制：bcrypt密码加密、JWT刷新令牌管理

**UserProfile扩展信息架构**：
- 医师专业信息：执业证书、专业领域、诊所信息
- APC证书管理：过期日期监控、文件URL存储
- 灵活扩展设计：address、preferences、metadata JSON存储
- 数据关联策略：一对一关系和级联删除保护

### 2.2 药品主数据管理
**Medicine药品信息架构**：
- 多语言支持：中文名、英文名、拼音名检索优化
- 全局SKU标识：唯一约束防重复，支持药品追溯
- 基准价格体系：basePrice作为平台定价基础
- 分类管理策略：category字段支持药品归类

**药品业务关联设计**：
- 处方药品明细关联（PrescriptionMedicine）
- 药房价格表管理关联（PharmacyPriceList）
- 状态管理：active、inactive、discontinued枚举

### 2.3 处方业务数据架构
**Prescription处方核心设计**：
- 业务流水号：prescriptionId唯一标识
- 状态流转管理：DRAFT → PAID → PENDING_REVIEW → FULFILLED
- 支付状态集成：paymentStatus、paymentAmount、paidAt时间戳
- 二维码数据存储：qrCodeData支持药房扫码验证

**PrescriptionMedicine明细设计**：
- 药品关联：medicineId外键和克重精确计量
- 价格计算集成：unitPrice、totalPrice基于药房价格表
- 用药说明：dosageInstructions文本存储
- 价格快照机制：pharmacyPriceSnapshot避免历史数据不一致

## 3. 账户财务数据架构

### 3.1 医师账户管理设计
**PractitionerAccount账户架构**：
- 余额管理：balance高精度Decimal存储
- 并发安全：version字段支持乐观锁机制
- 账户状态：active、suspended、frozen枚举控制
- 一对一关联：practitionerId唯一约束

**AccountTransaction交易记录设计**：
- 交易类型：DEBIT、CREDIT、REFUND、ADJUSTMENT枚举
- 余额快照：balanceBefore、balanceAfter确保审计完整
- 业务关联：referenceType、referenceId追踪交易来源
- 时序索引：createdAt降序支持交易历史查询

### 3.2 药房账户管理架构
**PharmacyAccount资金管理**：
- 可提现余额：balance实时资金状态
- 待确认金额：pendingAmount未结算资金
- 版本控制：乐观锁防止并发资金操作
- 交易记录：PharmacyAccountTransaction完整追踪

## 4. 药房运营数据架构

### 4.1 药房基础信息设计
**Pharmacy主表架构**：
- 基础信息：name、address JSON、coordinates坐标
- 运营配置：serviceHours营业时间、licenseInfo许可信息
- 操作员关联：operatorId一对一用户关系
- 状态管理：active、inactive、suspended枚举

### 4.2 价格表管理架构
**PharmacyPriceList核心设计**：
- 版本控制：version序列号和effectiveDate生效管理
- 价格明细：items JSON存储药品价格结构
- 审核流程：status审核状态、approvedBy审批人记录
- 违规检测：violationCount、violationSeverity风险评估

**basePrice约束验证机制**：
- 价格违规告警：priceViolations JSON存储详细信息
- 风险等级评估：low、medium、high、critical分级
- 管理员专属：adminVisibleOnly确保信息安全
- 自动审批控制：autoApproval、manualReviewRequired标识

### 4.3 采购订单管理设计
**PurchaseOrder采购订单架构**：
- 订单标识：poNumber唯一约束和业务追溯
- 处方集成：prescriptionId关联和药品明细快照
- 价格计算：totalAmount、gstAmount、netAmount分层管理
- 履约凭证：fulfillmentProofId关联验证

**价格计算快照机制**：
- 价格表快照：priceListSnapshot JSON避免价格变动影响
- 计算明细：calculationDetails透明化价格形成过程
- 审核支持：reviewNotes、reviewedBy、reviewedAt完整记录

## 5. 履约审核数据架构

### 5.1 履约凭证管理设计
**FulfillmentProof凭证架构**：
- 凭证文件：proofFiles JSON数组存储多文件
- 审核状态：pending、approved、rejected枚举管理
- 审核流程：reviewerId、reviewNotes、reviewedAt完整记录
- 一对一关联：prescriptionId唯一约束确保数据完整

### 5.2 提现申请管理架构
**WithdrawalRequest提现设计**：
- 发票管理：invoiceNumber唯一约束
- PO关联：purchaseOrderIds JSON存储关联订单列表
- 银行信息：bankDetails JSON存储支付信息
- 处理状态：pending_review、approved、rejected、processed

## 6. 系统监控数据架构

### 6.1 API调用日志设计
**ApiCallLog监控架构**：
- 请求信息：endpoint、method、statusCode基础记录
- 性能指标：duration响应时间、requestSize/responseSize数据量
- 调试信息：requestHeaders、queryParams、requestBody可选存储
- 用户关联：userId可选字段支持用户行为分析

### 6.2 性能指标聚合架构
**ApiCallMetrics聚合设计**：
- 时间窗口：hourly、daily、weekly多维度聚合
- 性能统计：avgDuration、p95Duration、p99Duration百分位分析
- 错误监控：errorRate精确计算和趋势分析
- 复合索引：endpoint+method+timeWindow组合优化

## 7. 数据库性能优化策略

### 7.1 索引优化设计
**关键查询路径索引**：
- 用户认证：email+status、role+status组合索引
- 处方业务：doctorId+status+createdAt、paymentStatus+paidAt
- 药房运营：pharmacyId+status+effectiveDate、version时间序列
- 监控日志：endpoint+duration+createdAt、userId+createdAt

### 7.2 查询性能优化
**分页查询策略**：
- 游标分页：基于createdAt时间戳的高效分页
- 复合索引：支持多条件查询的组合索引
- 关联查询优化：减少N+1问题的预加载策略
- 数据量控制：合理的每页数据量和最大查询限制

### 7.3 连接池和并发控制
**数据库连接优化**：
- Prisma连接池：合理配置最大连接数和超时参数
- 连接复用：长连接模式减少连接建立开销
- 事务管理：合理的事务边界和超时控制
- 读写分离：预留读写分离架构扩展能力

## 8. 数据迁移和版本管理

### 8.1 Schema迁移策略
**Prisma迁移管理**：
- 迁移文件版本控制和团队协作
- 数据迁移脚本和回滚策略
- 生产环境迁移的安全执行流程
- 迁移前后数据完整性验证

### 8.2 数据版本控制
**版本管理机制**：
- Schema版本号管理和兼容性检查
- 数据格式升级和向后兼容策略
- 历史数据保留和归档管理
- 紧急回滚和数据恢复预案

---

**数据架构技术转移完成标准**：数据模型设计文档完成后，开发团队应能理解完整的数据关系结构，独立完成Prisma Schema实现和数据库迁移操作。