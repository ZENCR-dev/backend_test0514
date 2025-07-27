-- 数据库索引优化迁移文件
-- 基于实际查询模式优化MVP2.0阶段的关键性能
-- 创建日期: 2025-07-13

-- 1. 药品搜索优化 - 解决多字段模糊搜索性能问题
-- 当前查询模式: OR条件搜索 name, englishName, pinyinName, chineseName, sku
-- 现有索引: 单字段索引 name, category, status
-- 优化策略: 复合索引 + 前缀索引优化

-- 为药品搜索创建复合索引 (status + name 是最频繁的查询组合)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_status_name_search 
ON medicines(status, name text_pattern_ops);

-- 为中文名称搜索优化 (支持中文搜索模式)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_status_chinese_name_search 
ON medicines(status, chinese_name text_pattern_ops) 
WHERE chinese_name IS NOT NULL;

-- 为英文名称搜索优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_status_english_name_search 
ON medicines(status, english_name text_pattern_ops) 
WHERE english_name IS NOT NULL;

-- 为拼音搜索优化 (支持拼音首字母搜索)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_status_pinyin_search 
ON medicines(status, pinyin_name text_pattern_ops) 
WHERE pinyin_name IS NOT NULL;

-- SKU精确查找优化 (SKU通常用于精确匹配)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_status_sku_search 
ON medicines(status, sku) 
WHERE status = 'active';

-- 2. 处方查询优化 - 医师查看处方列表性能提升
-- 当前查询模式: doctorId + status + createdAt排序 + 分页
-- 现有索引: doctorId, status, [doctorId, status], [status, createdAt]
-- 优化策略: 三字段复合索引覆盖完整查询路径

-- 处方医师查询优化 (覆盖WHERE + ORDER BY + 分页)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescription_doctor_status_created 
ON prescriptions(doctorId, status, createdAt DESC);

-- 处方状态统计优化 (用于仪表板数据)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescription_status_created_count 
ON prescriptions(status, createdAt DESC) 
WHERE status IN ('DRAFT', 'PAID', 'DISPENSED', 'COMPLETED');

-- 3. 订单查询优化 - 支持医师和药房的订单管理
-- 当前查询模式: practitionerId + status + 时间范围查询
-- 现有索引: practitionerId, status, [practitionerId, status], [status, createdAt]
-- 优化策略: 覆盖索引 + 特定状态优化

-- 医师订单查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_practitioner_status_created 
ON orders(practitionerId, status, createdAt DESC);

-- 药房分配订单查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_pharmacy_status_created 
ON orders(assignedPharmacyId, status, createdAt DESC) 
WHERE assignedPharmacyId IS NOT NULL;

-- 订单金额范围查询优化 (用于报表和分析)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_amount_created 
ON orders(totalAmount, createdAt DESC) 
WHERE status IN ('PAID', 'DISPENSED', 'COMPLETED');

-- 4. 支付查询优化 - 交易记录和财务报表
-- 当前查询模式: orderId查询 + 支付状态查询 + 时间范围查询

-- 订单支付状态查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_order_status_created 
ON payments(orderId, status, createdAt DESC);

-- 支付方式统计优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_method_status_created 
ON payments(paymentMethod, status, createdAt DESC);

-- 支付金额统计优化 (财务报表需求)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_amount_created_report 
ON payments(amount, createdAt DESC) 
WHERE status = 'completed';

-- 5. 账户交易优化 - 医师账户余额和交易历史
-- 当前查询模式: accountId + transactionType + 时间排序

-- 账户交易查询优化 (已有基础索引，添加覆盖索引)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transaction_type_amount_created 
ON account_transactions(accountId, transactionType, amount DESC, createdAt DESC);

-- 账户余额变化追踪优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_balance_tracking 
ON account_transactions(accountId, createdAt DESC, balanceAfter) 
WHERE transactionType IN ('deduction', 'recharge');

-- 6. 药房账户和价目表优化

-- 药房账户交易优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_account_transaction_type_created 
ON pharmacy_account_transactions(accountId, transactionType, createdAt DESC);

-- 药房价目表版本查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_price_list_effective 
ON pharmacy_price_lists(pharmacyId, effectiveDate DESC, status) 
WHERE status = 'approved';

-- 7. 事件日志优化 - 系统监控和审计

-- 事件类型和处理状态查询优化 (已有基础索引，添加覆盖索引)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_log_type_status_created 
ON event_logs(eventType, processingStatus, createdAt DESC);

-- 错误事件查询优化 (故障排查需求)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_log_errors 
ON event_logs(processingStatus, processingAttempts, createdAt DESC) 
WHERE processingStatus = 'ERROR' OR processingAttempts > 0;

-- 8. 全文搜索优化 (为未来扩展预留)

-- 药品全文搜索索引 (PostgreSQL GIN索引)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_fulltext_search 
-- ON medicines USING gin(to_tsvector('english', 
--   COALESCE(name, '') || ' ' || 
--   COALESCE(chinese_name, '') || ' ' || 
--   COALESCE(english_name, '') || ' ' || 
--   COALESCE(category, '')));

-- 索引维护说明:
-- 1. 使用 CONCURRENTLY 避免锁表，适合生产环境
-- 2. 使用 text_pattern_ops 支持 LIKE 查询优化
-- 3. 部分索引 (WHERE 条件) 减少索引大小
-- 4. 覆盖索引包含查询所需的所有字段，避免回表查询

-- 执行后验证:
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM medicines WHERE status = 'active' AND name ILIKE '%阿%';
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM prescriptions WHERE doctorId = 'doctor-123' AND status = 'DRAFT' ORDER BY createdAt DESC LIMIT 20;