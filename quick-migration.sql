-- 简化的Prisma数据库迁移脚本
-- 针对当前Supabase数据库的现状执行

-- 1. 添加新字段到Prescription表
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS copies INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS net_price DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS is_high_value BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS high_value_warning TEXT,
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 2. 修改PrescriptionMedicine表字段名
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'prescription_medicines' 
               AND column_name = 'dosage_instructions') THEN
        ALTER TABLE prescription_medicines 
        RENAME COLUMN dosage_instructions TO notes;
    END IF;
END $$;

-- 3. 添加PrescriptionMedicine表新字段
ALTER TABLE prescription_medicines 
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2);

-- 4. 移除patientInfo字段（隐私合规）
ALTER TABLE prescriptions DROP COLUMN IF EXISTS patient_info;

-- 5. 更新Order表结构
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS prescription_id VARCHAR,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'UNPAID',
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 6. 重命名amounts为copies（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'amounts') THEN
        ALTER TABLE orders RENAME COLUMN amounts TO copies_backup;
    END IF;
END $$;

-- 7. 添加基本约束
ALTER TABLE prescriptions 
ADD CONSTRAINT IF NOT EXISTS check_copies_range CHECK (copies >= 1 AND copies <= 30);

ALTER TABLE prescriptions 
ADD CONSTRAINT IF NOT EXISTS check_net_price_positive CHECK (net_price >= 0);

-- 8. 创建高价值处方触发器
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

DROP TRIGGER IF EXISTS trigger_check_high_value_prescription ON prescriptions;
CREATE TRIGGER trigger_check_high_value_prescription
    BEFORE INSERT OR UPDATE ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION check_high_value_prescription();

-- 9. 处方ID生成函数
CREATE OR REPLACE FUNCTION generate_prescription_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.prescription_id IS NULL THEN
        NEW.prescription_id := 'RX-' || 
                              TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                              LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_prescription_id ON prescriptions;
CREATE TRIGGER trigger_generate_prescription_id
    BEFORE INSERT ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION generate_prescription_id();