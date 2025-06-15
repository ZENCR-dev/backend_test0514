```sql
-- 基于PostgreSQL + Supabase

-- 1. 用户表 (继承Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('practitioner', 'patient', 'pharmacy_operator', 'admin')),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 诊所表
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address JSONB NOT NULL, -- {street, city, country, postal_code}
    contact JSONB, -- {phone, email}
    license_number VARCHAR(100),
    owner_id UUID REFERENCES user_profiles(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 药品主表
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) NOT NULL, -- tablet, ml, mg等
    requires_prescription BOOLEAN DEFAULT true,
    base_price DECIMAL(10,2) NOT NULL,
    metadata JSONB, -- 存储额外的药品信息
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 药房表
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address JSONB NOT NULL,
    coordinates POINT, -- PostGIS地理坐标
    contact JSONB NOT NULL,
    license_info JSONB,
    operator_id UUID REFERENCES user_profiles(id),
    service_hours JSONB, -- 营业时间
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 药房库存表 (简化版本)
CREATE TABLE pharmacy_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,  
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    wholesale_price DECIMAL(10,2),
    retail_price DECIMAL(10,2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, medicine_id)
);

-- 6. 处方/订单表 (核心业务实体)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_order_id VARCHAR(50) UNIQUE NOT NULL, -- 对外显示的订单号
    practitioner_id UUID REFERENCES user_profiles(id),
    patient_id UUID REFERENCES user_profiles(id),
    clinic_id UUID REFERENCES clinics(id),
    
    -- 患者信息快照
    patient_info JSONB NOT NULL, -- {name, phone, address, id_info}
    
    -- 订单状态管理
    status VARCHAR(30) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'pending_payment', 'paid', 'dispensing', 'completed', 'cancelled')),
    
    -- 金额信息
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    
    -- 履约信息
    assigned_pharmacy_id UUID REFERENCES pharmacies(id),
    dispensed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- 凭证信息
    qr_code_data TEXT, -- QR码内容
    pdf_url TEXT, -- 处方PDF链接
    
    -- 审计信息
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 订单药品明细表
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id),
    
    -- 药品信息快照
    medicine_snapshot JSONB NOT NULL, -- {name, sku, unit}
    
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- 处方信息
    dosage_instructions TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 支付记录表
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    
    -- 第三方支付信息
    provider VARCHAR(50), -- stripe, paypal等
    provider_transaction_id VARCHAR(255),
    provider_response JSONB,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 履约证明表 (药房提交的配药证明)
CREATE TABLE fulfillment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    pharmacy_id UUID REFERENCES pharmacies(id),
    
    -- 履约证明文件
    proof_files JSONB NOT NULL, -- [{url, type, filename}]
    notes TEXT,
    
    -- 审核状态
    review_status VARCHAR(20) DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES user_profiles(id),
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 系统配置表
CREATE TABLE system_configs (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_patient_id ON orders(patient_id);
CREATE INDEX idx_orders_practitioner_id ON orders(practitioner_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_pharmacy_inventory_pharmacy_medicine ON pharmacy_inventory(pharmacy_id, medicine_id);

-- 地理空间索引 (用于药房查找)
CREATE INDEX idx_pharmacies_coordinates ON pharmacies USING GIST(coordinates);

-- 触发器：自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();