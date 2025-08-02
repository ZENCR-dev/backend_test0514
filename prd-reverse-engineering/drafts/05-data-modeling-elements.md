# PRD逆向工程技术要素文档 - 数据建模要素

## 1. MVP数据库架构设计技术实现

### 1.1 PostgreSQL数据库技术栈配置
**数据库选型技术决策**：
- PostgreSQL 14+作为主数据库，提供ACID事务保证和高级JSON支持
- Prisma 6.x作为类型安全ORM，实现数据访问层的现代化管理
- 时区标准化：统一使用@db.Timestamptz(6)确保跨时区时间处理一致性
- 数据精度控制：金额字段使用@db.Decimal(12,2)确保财务计算精度

**连接池配置技术策略**：
- Prisma Client内置连接池管理，默认配置适用于MVP并发需求
- DATABASE_URL环境变量驱动的数据库连接配置
- DIRECT_URL支持直接数据库连接绕过连接池限制
- 多平台二进制目标支持：native、darwin-arm64、windows

### 1.2 MVP数据建模核心原则
**领域驱动设计简化实现**：
- 10张核心业务表覆盖完整业务流程，避免过度建模
- 聚合根设计：User、Prescription、Order、Pharmacy作为主要聚合根
- 关联关系最小化：减少复杂JOIN查询，优化查询性能
- JSON字段灵活扩展：metadata、address、contact等使用JSON存储

**数据一致性技术保障**：
- 外键约束确保引用完整性和级联删除安全
- 版本字段支持乐观锁并发控制
- 唯一约束防止业务逻辑重复数据
- 索引策略优化查询性能和数据访问模式

## 2. 用户认证数据模型技术架构

### 2.1 User表核心设计技术实现
**用户身份管理技术架构**：
- id字段使用@default(cuid())生成全局唯一标识符
- email字段@unique约束和@db.VarChar(255)长度限制
- role枚举：practitioner、pharmacy_operator、admin（MVP阶段移除patient角色）
- status枚举：pending、approved、suspended实现用户状态管理

**认证安全技术机制**：
- password字段存储bcrypt哈希值，默认值防止数据迁移异常
- refreshToken字段@db.VarChar(64)存储哈希后的刷新令牌
- refreshTokenExp时间戳字段实现令牌过期控制
- referralCode推荐机制支持用户增长策略

**用户关联关系技术设计**：
- practitionerAccount一对一关联医师账户数据
- operatedPharmacy一对一关联药房操作员数据
- profile一对一关联用户扩展信息
- prescriptions一对多关联医师处方数据

### 2.2 UserProfile扩展信息技术架构
**专业信息管理技术实现**：
- licenseNumber医师执业证书编号@unique约束
- specialization专业领域@db.VarChar(100)
- clinic诊所信息@db.VarChar(255)
- qualifications资质信息JSON存储灵活扩展

**APC证书管理技术机制**：
- apc_expiry_date证书过期日期@db.Date类型
- apc_file_url证书文件URL@db.VarChar(500)存储
- apc_upload_date上传时间戳记录
- 专用索引idx_user_profiles_apc_expiry支持过期监控

**灵活扩展技术设计**：
- address地址信息JSON存储支持复杂地址结构
- preferences用户偏好JSON存储个性化配置
- metadata元数据JSON存储业务扩展需求
- 级联删除onDelete: Cascade确保数据一致性

## 3. 业务核心数据模型技术架构

### 3.1 Medicine药品主数据技术实现
**多语言药品信息技术架构**：
- name主名称@db.VarChar(255)作为显示名称
- chineseName、englishName、pinyinName支持多语言检索
- sku全局唯一标识符@unique约束防重复
- category分类@db.VarChar(100)支持药品归类管理

**定价基础数据技术设计**：
- basePrice基准价格@db.Decimal(10,6)高精度存储
- unit计量单位@db.VarChar(50)标准化
- requiresPrescription处方药标识@default(true)
- status状态管理@default("active")支持药品上下架

**业务关联技术实现**：
- prescriptionMedicines关联处方药品清单
- pharmacyPriceLists关联药房价格表管理
- orderItems关联订单明细数据
- 索引优化：name、category、status字段索引

### 3.2 Prescription处方数据技术架构
**处方核心信息技术设计**：
- prescriptionId业务流水号@unique约束
- doctorId医师关联外键约束
- status处方状态@default("DRAFT")支持状态流转
- totalAmount总金额@db.Decimal(12,2)财务精度

**处方生命周期技术管理**：
- copies帖数字段支持中医处方业务
- expiresAt过期时间@db.Timestamptz(6)支持时效控制
- qrCodeData二维码数据存储
- version版本字段@default(1)支持乐观锁

**处方药品关联技术实现**：
- medicines关联PrescriptionMedicine明细表
- purchaseOrders关联药房采购订单
- 复合索引优化：doctorId+status、status+createdAt
- 级联删除保护：onDelete: Cascade

### 3.3 PrescriptionMedicine处方药品技术设计
**药品明细信息技术架构**：
- prescriptionId处方关联外键
- medicineId药品关联外键
- weight克重@db.Decimal(8,2)精确计量
- dosageInstructions用药说明文本存储

**关联约束技术实现**：
- 双外键约束确保数据完整性
- 级联删除onDelete: Cascade维护数据一致性
- 索引优化：prescriptionId、medicineId独立索引
- additionalNotes补充说明支持业务扩展

## 4. 账户财务数据模型技术架构

### 4.1 PractitionerAccount医师账户技术实现
**账户核心信息技术设计**：
- practitionerId用户关联@unique约束一对一关系
- balance账户余额@db.Decimal(12,2)高精度财务数据
- creditLimit信用额度@default(0)（MVP阶段搁置）
- status账户状态active/suspended/frozen枚举控制

**并发安全技术保障**：
- version字段@default(1)支持乐观锁机制
- 复合索引优化account查询性能
- 外键约束确保用户关联完整性
- 时间戳字段支持审计和监控需求

### 4.2 AccountTransaction交易记录技术架构
**交易信息完整记录技术实现**：
- accountId账户关联外键约束
- transactionType交易类型：DEBIT、CREDIT、REFUND、ADJUSTMENT
- amount交易金额@db.Decimal(12,2)精确存储
- balanceBefore/balanceAfter余额快照确保审计完整性

**交易追踪技术机制**：
- referenceType/referenceId关联业务对象
- description交易描述文本
- createdBy操作员记录支持责任追溯
- 多维度索引：accountId、createdAt、referenceType组合索引

**信用额度技术支持**：
- creditBefore/creditAfter信用额度变化记录
- ReferenceType枚举：ORDER、RECHARGE、REFUND、MANUAL
- 时序索引createdAt(sort: Desc)支持交易历史查询
- 批量交易查询优化索引策略

## 5. 药房运营数据模型技术架构

### 5.1 Pharmacy药房主数据技术实现
**药房基础信息技术设计**：
- name药房名称@db.VarChar(255)
- address地址信息JSON存储复杂地址结构
- coordinates坐标信息字符串存储
- contact联系方式JSON存储多种联系方式

**运营管理技术架构**：
- operatorId操作员关联@unique约束一对一关系
- serviceHours营业时间JSON存储灵活时间配置
- licenseInfo许可证信息JSON存储证照数据
- status状态管理@default("active")支持药房启停

**业务关联技术实现**：
- account关联PharmacyAccount账户数据
- priceLists关联PharmacyPriceList价格表管理
- priceListVersions关联价格表版本历史
- purchaseOrders关联PurchaseOrder采购订单

### 5.2 PharmacyAccount药房账户技术架构
**账户信息技术设计**：
- pharmacyId药房关联@unique约束
- balance可提现余额@db.Decimal(12,2)
- pendingAmount待确认金额@db.Decimal(12,2)
- version乐观锁版本控制@default(1)

**资金流管理技术实现**：
- transactions关联PharmacyAccountTransaction交易记录
- 级联删除onDelete: Cascade维护数据完整性
- status账户状态@default("active")
- 时间戳字段支持审计追踪

### 5.3 PharmacyPriceList药房价格表管理技术架构
**价格表核心信息技术设计**：
- pharmacyId药房关联外键@db.VarChar(255)
- version版本号自增序列@default(1)管理
- priceListName价格表名称@db.VarChar(255)
- uploadedBy上传操作员关联外键

**价格表版本控制技术实现**：
- status审核状态：pending_approval、approved、rejected、expired
- effectiveDate生效日期@db.Date类型
- expiryDate失效日期@db.Date类型
- items价格明细JSON存储药品价格结构
- medicineDataStructure药品信息字段标准化JSON模板

**药品信息字段一致性技术保障**：
- medicineSku药品SKU@db.VarChar(100)与Medicine.sku一致
- medicineName药品名称@db.VarChar(255)与Medicine.name一致
- medicineUnit计量单位@db.VarChar(50)与Medicine.unit一致
- medicineCategory药品分类@db.VarChar(100)与Medicine.category一致
- pharmacyPrice药房定价@db.Decimal(10,6)高精度存储

**管理员审核流程技术支持**：
- approvedBy审批管理员关联外键
- approvedAt审批时间@db.Timestamptz(6)
- reviewNotes审核意见@db.Text
- rejectionReason拒绝原因@db.Text
- priceViolations价格违规告警JSON存储

**basePrice约束验证技术机制**：
- violationCount违规药品数量统计
- violationSeverity风险等级：low、medium、high、critical
- alertLevel告警级别：info、warning、error
- autoApproval自动审批标识@default(false)
- manualReviewRequired强制人工审核@default(true)

### 5.4 PurchaseOrder采购订单技术架构
**采购订单信息技术设计**：
- poNumber采购单号@unique约束
- pharmacyId药房关联外键
- prescriptionId处方关联外键@db.VarChar(255)
- priceListId关联生效价格表外键
- fulfillmentProofId履约凭证关联@unique约束

**处方药品信息技术集成**：
- prescriptionMedicines处方药品明细JSON快照
- medicineWeights药品克重信息JSON存储
- copies处方帖数@db.Int字段
- dosageInstructions用药说明JSON存储
- medicineSkus药品SKU列表JSON存储

**价格计算技术实现**：
- totalAmount订单总额@db.Decimal(12,2)
- gstAmount消费税金额@db.Decimal(12,2)
- netAmount净金额@db.Decimal(12,2)
- priceListSnapshot价格表快照JSON存储
- calculationDetails价格计算明细JSON存储

**审核流程技术支持**：
- status状态@default("pending_review")
- reviewNotes审核备注
- reviewedBy审核人员记录
- reviewedAt审核时间戳@db.Timestamptz(6)

## 6. 处方支付订单数据模型技术架构

### 6.1 处方支付订单设计决策技术分析
**数据模型简化技术策略**：
- Prescription表直接支持支付状态管理，无需独立Order表
- PrescriptionMedicine表直接关联价格信息，无需OrderItem冗余
- 处方状态扩展：DRAFT、PAID、PENDING_REVIEW、FULFILLED、CANCELLED
- 支付信息直接关联处方ID，简化数据关系

**处方支付状态技术流转**：
- paymentStatus支付状态@default("unpaid")
- paymentAmount实付金额@db.Decimal(12,2)
- paymentMethod支付方式@db.VarChar(50)
- paidAt支付完成时间@db.Timestamptz(6)@nullable
- assignedPharmacyId分配药房ID@nullable

**处方业务关联技术优化**：
- purchaseOrders直接关联处方采购订单
- payments支付记录关联处方而非独立订单
- qrCodeData二维码数据存储支持药房扫码
- fulfillmentProof履约凭证直接关联处方

### 6.2 PrescriptionMedicine增强技术架构
**药品明细价格技术集成**：
- weight克重@db.Decimal(8,2)精确计量
- unitPrice单价@db.Decimal(10,6)来源于药房价格表
- totalPrice小计金额@db.Decimal(12,2)自动计算
- priceSource价格来源标识：pharmacy_price_list
- dosageInstructions用药说明文本存储

**价格计算技术实现**：
- pharmacyPriceSnapshot药房价格快照JSON存储
- calculatedAt价格计算时间@db.Timestamptz(6)
- priceListVersion关联价格表版本信息
- 复合索引优化：prescriptionId、medicineId、priceSource

### 6.3 Payment支付记录技术架构
**处方关联支付技术管理**：
- prescriptionId处方关联外键@db.VarChar(255) 
- amount支付金额@db.Decimal(10,2)
- currency货币代码@default("NZD")
- paymentMethod支付方式@db.VarChar(50)

**第三方集成技术支持**：
- provider支付提供商@db.VarChar(50)
- providerTransactionId第三方交易号
- providerResponse第三方响应JSON存储
- status支付状态PaymentStatus枚举

**支付状态技术流转**：
- pending待处理
- processing处理中
- completed完成
- failed失败
- refunded已退款

## 7. 履约审核数据模型技术架构

### 7.1 FulfillmentProof履约凭证技术实现
**凭证信息技术设计**：
- prescriptionId处方关联外键@db.VarChar(255)
- pharmacyId药房关联外键
- proofFiles凭证文件JSON数组存储
- reviewStatus审核状态FulfillmentReviewStatus枚举

**审核流程技术支持**：
- reviewerId审核员关联
- reviewNotes审核备注
- reviewedAt审核时间@db.Timestamptz(6)
- purchaseOrder关联PurchaseOrder一对一关系

**审核状态技术管理**：
- pending待审核
- approved审核通过
- rejected审核拒绝
- 索引优化：prescriptionId、pharmacyId、reviewStatus

### 7.2 PharmacyPriceList价格表审核技术架构
**价格表审核状态技术管理**：
- pharmacyId药房关联外键
- version版本号序列管理
- reviewStatus审核状态：pending、under_review、approved、rejected
- effectiveDate生效日期@db.Date
- items价格明细JSON存储

**basePrice约束告警技术实现**：
- basePrice基准价格@db.Decimal(10,6)
- violationAlerts价格违规告警JSON存储
- riskLevel风险等级评估：low、medium、high、critical
- alertDetails告警详情：药品SKU、违规金额、风险说明
- adminVisibleOnly管理员专属告警@default(true)

**审批流程技术实现**：
- status状态@default("pending_approval")
- approvedBy审批人员记录@nullable
- approvedAt审批时间@db.Timestamptz(6)@nullable
- reviewNotes审批意见@db.Text@nullable
- 级联删除onDelete: Cascade

### 7.3 WithdrawalRequest提现申请技术架构
**提现申请信息技术设计**：
- pharmacyId药房关联外键
- invoiceNumber发票号@unique约束
- purchaseOrderIds关联PO列表JSON存储
- totalAmount提现总额@db.Decimal(12,2)

**银行信息技术管理**：
- bankDetails银行详情JSON存储
- status处理状态@default("pending_review")
- processedBy处理人员记录
- processedAt处理时间@db.Timestamptz(6)

## 8. 系统监控数据模型技术架构

### 8.1 ApiCallLog API调用日志技术实现
**请求信息技术记录**：
- endpoint请求路径@db.VarChar(255)
- method HTTP方法@db.VarChar(10)
- statusCode响应状态码
- userId用户关联（可选）

**性能指标技术监控**：
- duration响应时间毫秒记录
- requestSize请求体大小字节
- responseSize响应体大小字节
- ip客户端IP@db.VarChar(45)支持IPv6

**调试信息技术存储**：
- requestHeaders请求头JSON存储
- queryParams查询参数JSON存储
- requestBody/responseBody请求响应体JSON存储（可选）
- metadata元数据JSON存储扩展信息

### 8.2 ApiCallMetrics API指标聚合技术架构
**时间窗口技术聚合**：
- timeWindow时间窗口：hourly、daily、weekly
- windowStart/windowEnd窗口时间范围
- endpoint接口路径和method方法组合
- requestCount请求总数统计

**性能统计技术指标**：
- avgDuration平均响应时间
- minDuration/maxDuration最小最大响应时间
- p95Duration/p99Duration百分位响应时间
- errorRate错误率@db.Decimal(5,4)精确计算

**数据聚合技术优化**：
- 复合唯一索引：endpoint+method+userId+timeWindow+windowStart
- 多维度索引支持不同查询模式
- totalDataSize数据传输量统计
- 自动聚合定时任务支持

### 8.3 EventLog事件日志技术架构
**事件信息技术记录**：
- eventType事件类型@db.VarChar(100)
- eventId事件标识符@db.VarChar(255)
- payload事件负载JSON存储
- processingStatus处理状态枚举

**事件处理技术状态**：
- PENDING待处理
- PROCESSING处理中
- COMPLETED完成
- FAILED失败
- RETRYING重试中

**可靠性技术保障**：
- processingAttempts处理尝试次数
- lastProcessingError最后错误信息
- processedAt处理完成时间
- 索引优化：eventType、processingStatus、createdAt

## 9. MVP数据建模技术总结

### 9.1 数据模型技术成熟度评估
**当前数据建模完成度分析**：
- 核心业务表设计：100%完成，简化为8张核心表覆盖完整业务流程
- 关联关系设计：100%完成，外键约束和级联删除完善，消除Order/OrderItem冗余
- 索引优化策略：95%完成，主要查询路径索引覆盖，处方业务查询优化
- 数据类型精度：100%完成，金额和时间戳精度标准化
- JSON扩展字段：90%完成，药品信息字段一致性保障机制完善

### 9.2 MVP数据架构技术优势
**PostgreSQL技术栈优势**：
- ACID事务保证关键业务操作数据一致性
- JSON字段支持灵活业务扩展和复杂数据结构
- 时区感知时间戳确保跨时区业务准确性
- 高精度Decimal类型确保财务计算准确性

**Prisma ORM技术优势**：
- 类型安全查询防止SQL注入和运行时错误
- 自动迁移管理简化数据库结构演进
- 关联查询优化减少N+1查询问题
- 内置连接池管理优化数据库连接性能

### 9.3 数据建模技术规范
**字段命名技术标准**：
- 统一使用snake_case数据库字段命名
- @map装饰器实现Prisma模型camelCase命名
- 外键字段统一Id后缀命名规范
- 时间戳字段createdAt/updatedAt标准化

**数据类型技术标准**：
- 金额字段统一@db.Decimal(12,2)精度
- 时间戳统一@db.Timestamptz(6)时区感知
- 字符串长度合理限制VarChar类型
- JSON字段用于复杂数据结构存储

**索引策略技术标准**：
- 外键字段自动索引创建
- 业务查询路径复合索引优化
- 时间序列查询sort: Desc索引
- 唯一约束防止业务逻辑重复

### 9.4 MVP数据模型扩展性设计
**未来扩展技术预留**：
- JSON字段metadata为业务扩展预留空间
- version字段为乐观锁和数据版本控制预留
- status字段为业务状态扩展预留
- 模块化表设计支持微服务拆分

**性能优化技术预留**：
- 索引策略为高并发查询优化预留
- 分页查询支持大数据集处理
- 连接池配置为高并发访问预留
- 读写分离架构为性能扩展预留

**合规扩展技术预留**：
- 审计字段createdBy/updatedAt完整记录
- 软删除字段为数据保护法规预留
- 数据脱敏字段为隐私保护预留
- 数据导出接口为用户权利预留
