-- 数据库业务约束SQL
-- 创建日期: 2025年7月12日
-- 基于用户确认的业务规则

-- 1. 处方帖数范围约束 (1-30帖)
ALTER TABLE prescriptions 
ADD CONSTRAINT check_copies_range 
CHECK (copies >= 1 AND copies <= 30);

-- 2. 处方金额必须为正数
ALTER TABLE prescriptions 
ADD CONSTRAINT check_net_price_positive 
CHECK (net_price >= 0);

-- 3. 总克重必须为正数
ALTER TABLE prescriptions 
ADD CONSTRAINT check_gross_weight_positive 
CHECK (gross_weight > 0);

-- 4. 药品用量必须为正数
ALTER TABLE prescription_medicines 
ADD CONSTRAINT check_quantity_positive 
CHECK (quantity > 0);

-- 5. 药品克重必须为正数
ALTER TABLE prescription_medicines 
ADD CONSTRAINT check_weight_positive 
CHECK (weight > 0);

-- 6. 药品单价必须为正数
ALTER TABLE prescription_medicines 
ADD CONSTRAINT check_unit_price_positive 
CHECK (unit_price >= 0);

-- 7. 药品小计必须为正数
ALTER TABLE prescription_medicines 
ADD CONSTRAINT check_total_price_positive 
CHECK (total_price >= 0);

-- 8. 医师账户余额不能为负数
ALTER TABLE practitioner_accounts 
ADD CONSTRAINT check_balance_non_negative 
CHECK (balance >= 0);

-- 9. 支付时间必须在创建时间之后
ALTER TABLE orders 
ADD CONSTRAINT check_payment_after_creation 
CHECK (paid_at IS NULL OR paid_at >= created_at);

-- 10. 平台利润必须为正数（PO价格不能超过处方价格）
ALTER TABLE purchase_orders 
ADD CONSTRAINT check_platform_profit_positive 
CHECK (platform_profit >= 0);

-- 11. 药房成本必须为正数
ALTER TABLE purchase_orders 
ADD CONSTRAINT check_wholesale_cost_positive 
CHECK (wholesale_cost >= 0);

-- 12. 版本号必须为正数（乐观锁）
ALTER TABLE prescriptions 
ADD CONSTRAINT check_version_positive 
CHECK (version > 0);

ALTER TABLE orders 
ADD CONSTRAINT check_order_version_positive 
CHECK (version > 0);

-- 13. 状态枚举约束
ALTER TABLE prescriptions 
ADD CONSTRAINT check_prescription_status 
CHECK (status IN ('DRAFT', 'PAID', 'FULFILLED', 'EXPIRED', 'CANCELLED'));

ALTER TABLE orders 
ADD CONSTRAINT check_payment_status 
CHECK (payment_status IN ('UNPAID', 'PAID', 'FAILED', 'REFUNDED'));

ALTER TABLE pharmacy_price_lists 
ADD CONSTRAINT check_price_list_status 
CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'ACTIVE'));

-- 14. 高价值处方逻辑约束
-- 如果金额超过500 NZD，必须标记为高价值
CREATE OR REPLACE FUNCTION check_high_value_prescription()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.net_price >= 500 THEN
        NEW.is_high_value := true;
        IF NEW.high_value_warning IS NULL THEN
            NEW.high_value_warning := 'This prescription exceeds $500 NZD. Please confirm with patient.';
        END IF;
    ELSE
        NEW.is_high_value := false;
        NEW.high_value_warning := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_high_value_prescription
    BEFORE INSERT OR UPDATE ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION check_high_value_prescription();

-- 15. 处方ID生成函数
CREATE OR REPLACE FUNCTION generate_prescription_id()
RETURNS TRIGGER AS $$
BEGIN
    -- 生成格式: RX-YYYYMMDD-序号
    IF NEW.prescription_id IS NULL THEN
        NEW.prescription_id := 'RX-' || 
                              TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                              LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_prescription_id
    BEFORE INSERT ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION generate_prescription_id();

-- 16. 索引优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_high_value 
ON prescriptions (is_high_value) 
WHERE is_high_value = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_doctor_status 
ON prescriptions (doctor_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescription_medicines_prescription 
ON prescription_medicines (prescription_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status 
ON orders (payment_status, created_at DESC);

-- 17. 审计触发器函数
CREATE OR REPLACE FUNCTION audit_prescription_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO prescription_audit_logs (
        prescription_id, 
        action, 
        old_values, 
        new_values, 
        user_id, 
        created_at
    )
    VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
        current_setting('app.current_user_id', true),
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_prescription_changes
    AFTER INSERT OR UPDATE OR DELETE ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION audit_prescription_changes();