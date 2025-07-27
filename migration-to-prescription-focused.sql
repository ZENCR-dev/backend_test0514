-- 数据迁移脚本：从当前结构迁移到新的以Prescription为核心的结构
-- 创建日期: 2025年7月12日
-- 执行顺序: 先备份，再执行迁移

-- ==================== 第一步：备份现有数据 ====================

-- 创建备份表
CREATE TABLE IF NOT EXISTS backup_prescriptions AS SELECT * FROM prescriptions;
CREATE TABLE IF NOT EXISTS backup_prescription_medicines AS SELECT * FROM prescription_medicines;
CREATE TABLE IF NOT EXISTS backup_orders AS SELECT * FROM orders;
CREATE TABLE IF NOT EXISTS backup_order_items AS SELECT * FROM order_items;

-- ==================== 第二步：添加新字段到现有表 ====================

-- 向Prescription表添加新字段
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS copies INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS net_price DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS is_high_value BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS high_value_warning TEXT,
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 向PrescriptionMedicine表添加新字段
ALTER TABLE prescription_medicines 
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2);

-- 修改字段名称（如果需要）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'prescription_medicines' 
               AND column_name = 'dosage_instructions') THEN
        -- 将dosage_instructions重命名为notes
        ALTER TABLE prescription_medicines 
        RENAME COLUMN dosage_instructions TO notes;
    END IF;
END $$;

-- ==================== 第三步：数据迁移逻辑 ====================

-- 1. 从Order表迁移amounts到Prescription表的copies
UPDATE prescriptions 
SET copies = COALESCE(
    (SELECT amounts 
     FROM orders 
     WHERE orders.practitioner_id = prescriptions.doctor_id 
     AND orders.created_at::date = prescriptions.created_at::date
     LIMIT 1), 
    1
);

-- 2. 从Order表迁移totalAmount到Prescription表的net_price
UPDATE prescriptions 
SET net_price = COALESCE(
    (SELECT total_amount 
     FROM orders 
     WHERE orders.practitioner_id = prescriptions.doctor_id 
     AND orders.created_at::date = prescriptions.created_at::date
     LIMIT 1), 
    total_amount
);

-- 3. 计算gross_weight（总克重）
WITH prescription_weights AS (
    SELECT 
        pm.prescription_id,
        SUM(pm.quantity * COALESCE(m.base_price, 1)) * p.copies as calculated_weight
    FROM prescription_medicines pm
    JOIN medicines m ON pm.medicine_id = m.id
    JOIN prescriptions p ON pm.prescription_id = p.id
    GROUP BY pm.prescription_id, p.copies
)
UPDATE prescriptions 
SET gross_weight = pw.calculated_weight
FROM prescription_weights pw
WHERE prescriptions.id = pw.prescription_id;

-- 4. 更新PrescriptionMedicine表的新字段
UPDATE prescription_medicines 
SET 
    weight = quantity * COALESCE(
        (SELECT base_price FROM medicines WHERE id = medicine_id), 
        1
    ),
    unit_price = COALESCE(
        (SELECT base_price FROM medicines WHERE id = medicine_id), 
        0
    ),
    total_price = quantity * COALESCE(
        (SELECT base_price FROM medicines WHERE id = medicine_id), 
        0
    );

-- 5. 标记高价值处方（超过$500）
UPDATE prescriptions 
SET 
    is_high_value = (net_price >= 500),
    high_value_warning = CASE 
        WHEN net_price >= 500 THEN 'This prescription exceeds $500 NZD. Please confirm with patient.'
        ELSE NULL 
    END;

-- 6. 移除patientInfo字段（隐私合规）
ALTER TABLE prescriptions DROP COLUMN IF EXISTS patient_info;

-- ==================== 第四步：更新Order表结构 ====================

-- 简化Order表，移除重复字段，保留支付相关信息
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS prescription_id VARCHAR UNIQUE,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'UNPAID',
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 如果amounts字段存在，将其数据迁移后删除
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'amounts') THEN
        -- 数据已在上面迁移到prescriptions.copies
        ALTER TABLE orders DROP COLUMN amounts;
    END IF;
END $$;

-- 创建Order和Prescription的关联
UPDATE orders 
SET prescription_id = (
    SELECT p.id 
    FROM prescriptions p 
    WHERE p.doctor_id = orders.practitioner_id 
    AND p.created_at::date = orders.created_at::date
    LIMIT 1
)
WHERE prescription_id IS NULL;

-- ==================== 第五步：创建审计日志表 ====================

CREATE TABLE IF NOT EXISTS prescription_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR,
    ip_address VARCHAR,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_list_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 第六步：应用业务约束 ====================

-- 应用之前定义的约束
\i database-constraints.sql

-- ==================== 第七步：验证迁移结果 ====================

-- 验证数据完整性
DO $$
DECLARE
    prescription_count INT;
    order_count INT;
    medicine_count INT;
BEGIN
    SELECT COUNT(*) INTO prescription_count FROM prescriptions;
    SELECT COUNT(*) INTO order_count FROM orders;
    SELECT COUNT(*) INTO medicine_count FROM prescription_medicines;
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '- Prescriptions: %', prescription_count;
    RAISE NOTICE '- Orders: %', order_count; 
    RAISE NOTICE '- Prescription Medicines: %', medicine_count;
    
    -- 检查关键字段是否正确填充
    SELECT COUNT(*) INTO prescription_count 
    FROM prescriptions 
    WHERE copies IS NULL OR net_price IS NULL OR gross_weight IS NULL;
    
    IF prescription_count > 0 THEN
        RAISE WARNING 'Found % prescriptions with NULL required fields', prescription_count;
    ELSE
        RAISE NOTICE 'All prescriptions have required fields populated';
    END IF;
END $$;

-- ==================== 第八步：清理临时数据 ====================

-- 删除OrderItem表（如果不再需要）
-- DROP TABLE IF EXISTS order_items CASCADE;

-- 创建视图以保持向后兼容（可选）
CREATE OR REPLACE VIEW v_prescription_summary AS
SELECT 
    p.id,
    p.prescription_id,
    p.doctor_id,
    p.copies,
    p.gross_weight,
    p.net_price,
    p.is_high_value,
    p.status,
    p.notes,
    p.created_at,
    u.email as doctor_email,
    prof.full_name as doctor_name,
    COUNT(pm.id) as medicine_count,
    o.payment_status,
    o.paid_at
FROM prescriptions p
JOIN users u ON p.doctor_id = u.id
LEFT JOIN user_profiles prof ON u.id = prof.user_id
LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
LEFT JOIN orders o ON p.id = o.prescription_id
GROUP BY p.id, u.email, prof.full_name, o.payment_status, o.paid_at;

-- 记录迁移完成
INSERT INTO prescription_audit_logs (
    prescription_id, 
    action, 
    new_values, 
    user_id, 
    created_at
) VALUES (
    'SYSTEM', 
    'MIGRATION_COMPLETED', 
    '{"message": "Database migrated to prescription-focused structure", "date": "2025-07-12"}'::jsonb, 
    'SYSTEM', 
    NOW()
);