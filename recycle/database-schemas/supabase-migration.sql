-- 🚨 Supabase Migration SQL - 数据库Schema迁移
-- 复用价值: 100% (完整数据结构和约束)
-- 迁移目标: Supabase PostgreSQL + RLS策略
-- 适配要求: 集成auth.users表和RLS策略

-- =========================================
-- 1. 用户认证表 (集成Supabase Auth)
-- =========================================

-- 扩展Supabase内置auth.users表
-- 注意：不创建users表，使用Supabase原生auth.users

-- 用户扩展信息表
CREATE TABLE user_profiles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    license_number VARCHAR(50) UNIQUE,
    address JSONB,
    preferences JSONB,
    metadata JSONB,
    specialization VARCHAR(100),
    clinic VARCHAR(255),
    qualifications JSONB,
    apc_expiry_date DATE,
    apc_file_url VARCHAR(500),
    apc_upload_date TIMESTAMP(6),
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 为user_profiles创建索引
CREATE INDEX idx_user_profiles_apc_expiry ON user_profiles(apc_expiry_date);
CREATE INDEX idx_user_profiles_specialization ON user_profiles(specialization);

-- =========================================
-- 2. 医师账户管理表
-- =========================================

CREATE TABLE practitioner_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    practitioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(12,2) DEFAULT 0,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    used_credit DECIMAL(12,2) DEFAULT 0,
    available_credit DECIMAL(12,2),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'frozen')),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
    UNIQUE(practitioner_id)
);

CREATE INDEX ON practitioner_accounts(status);

-- 账户交易记录表
CREATE TABLE account_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT REFERENCES practitioner_accounts(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('DEBIT', 'CREDIT', 'REFUND', 'ADJUSTMENT')),
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    credit_before DECIMAL(12,2) NOT NULL,
    credit_after DECIMAL(12,2) NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('ORDER', 'RECHARGE', 'REFUND', 'MANUAL')),
    reference_id TEXT,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON account_transactions(account_id);
CREATE INDEX ON account_transactions(created_at DESC);
CREATE INDEX ON account_transactions(reference_type, reference_id);
CREATE INDEX ON account_transactions(account_id, transaction_type);

-- =========================================
-- 3. 药品主数据表
-- =========================================

CREATE TABLE medicines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    chinese_name VARCHAR(255),
    english_name VARCHAR(255),
    pinyin_name VARCHAR(255),
    sku VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) NOT NULL,
    requires_prescription BOOLEAN DEFAULT true,
    base_price DECIMAL(10,6) NOT NULL CHECK (base_price >= 0),
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON medicines(name);
CREATE INDEX ON medicines(category);
CREATE INDEX ON medicines(status);
CREATE INDEX ON medicines(chinese_name);
CREATE INDEX ON medicines(english_name);
CREATE INDEX ON medicines(pinyin_name);

-- =========================================
-- 4. 处方管理表 (匿名化设计)
-- =========================================

CREATE TABLE prescriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id TEXT UNIQUE NOT NULL,
    doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PAID', 'FULFILLED', 'COMPLETED', 'CANCELLED')),
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    notes TEXT,
    qr_code_data TEXT,
    version INTEGER DEFAULT 1,
    copies INTEGER NOT NULL CHECK (copies > 0),
    expires_at TIMESTAMPTZ(6),
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON prescriptions(doctor_id);
CREATE INDEX ON prescriptions(status);
CREATE INDEX ON prescriptions(created_at DESC);
CREATE INDEX ON prescriptions(doctor_id, status);

-- 处方药品明细表
CREATE TABLE prescription_medicines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id TEXT REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_id TEXT REFERENCES medicines(id) ON DELETE CASCADE,
    dosage_instructions TEXT NOT NULL,
    notes TEXT,
    weight DECIMAL(8,2) NOT NULL CHECK (weight > 0),
    additional_notes TEXT,
    created_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON prescription_medicines(prescription_id);
CREATE INDEX ON prescription_medicines(medicine_id);

-- =========================================
-- 5. 药房管理表
-- =========================================

CREATE TABLE pharmacies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address JSONB NOT NULL,
    coordinates TEXT,
    contact JSONB NOT NULL,
    license_info JSONB,
    operator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    service_hours JSONB,
    status VARCHAR(20) DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
    UNIQUE(operator_id)
);

CREATE INDEX ON pharmacies(status);

-- 药房账户表
CREATE TABLE pharmacy_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id TEXT REFERENCES pharmacies(id) ON DELETE CASCADE,
    balance DECIMAL(12,2) DEFAULT 0,
    pending_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
    UNIQUE(pharmacy_id)
);

-- 药房交易记录表
CREATE TABLE pharmacy_account_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT REFERENCES pharmacy_accounts(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ(6) DEFAULT NOW()
);

-- =========================================
-- 6. 订单管理表
-- =========================================

CREATE TABLE orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_order_id VARCHAR(50) UNIQUE NOT NULL,
    practitioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PAYMENT_FAILED', 'PAID', 'PENDING_REVIEW', 'REJECTED', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED')),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    assigned_pharmacy_id TEXT REFERENCES pharmacies(id),
    dispensed_at TIMESTAMPTZ(6),
    completed_at TIMESTAMPTZ(6),
    qr_code_data TEXT,
    pdf_url TEXT,
    notes TEXT,
    version INTEGER DEFAULT 1,
    idempotency_key VARCHAR(255) UNIQUE,
    expires_at TIMESTAMPTZ(6),
    copies INTEGER NOT NULL,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON orders(status);
CREATE INDEX ON orders(practitioner_id);
CREATE INDEX ON orders(created_at DESC);
CREATE INDEX ON orders(practitioner_id, status);

-- 订单明细表
CREATE TABLE order_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id TEXT REFERENCES medicines(id) ON DELETE CASCADE,
    medicine_snapshot JSONB NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    dosage_instructions TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ(6) DEFAULT NOW()
);

-- =========================================
-- 7. 支付管理表
-- =========================================

CREATE TABLE payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NZD',
    payment_method VARCHAR(50) NOT NULL,
    provider VARCHAR(50),
    provider_transaction_id VARCHAR(255),
    provider_response JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    processed_at TIMESTAMPTZ(6),
    metadata JSONB,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

-- =========================================
-- 8. 履约证明和采购订单表
-- =========================================

CREATE TABLE fulfillment_proofs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    pharmacy_id TEXT REFERENCES pharmacies(id) ON DELETE CASCADE,
    proof_files JSONB NOT NULL,
    notes TEXT,
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES auth.users(id),
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ(6),
    metadata JSONB,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON fulfillment_proofs(order_id);
CREATE INDEX ON fulfillment_proofs(pharmacy_id);
CREATE INDEX ON fulfillment_proofs(review_status);

-- 采购订单表
CREATE TABLE purchase_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT UNIQUE NOT NULL,
    pharmacy_id TEXT REFERENCES pharmacies(id) ON DELETE CASCADE,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    prescription_id TEXT REFERENCES prescriptions(id),
    fulfillment_proof_id TEXT REFERENCES fulfillment_proofs(id) ON DELETE CASCADE,
    items JSONB NOT NULL,
    medicine_items JSONB,
    total_amount DECIMAL(12,2) NOT NULL,
    gst_amount DECIMAL(12,2),
    net_amount DECIMAL(12,2),
    status TEXT DEFAULT 'pending_review',
    review_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
    UNIQUE(fulfillment_proof_id)
);

CREATE INDEX ON purchase_orders(prescription_id);

-- =========================================
-- 9. 提现申请表
-- =========================================

CREATE TABLE withdrawal_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id TEXT REFERENCES pharmacies(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    purchase_order_ids JSONB NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    bank_details JSONB NOT NULL,
    status TEXT DEFAULT 'pending_review',
    notes TEXT,
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

-- =========================================
-- 10. 价格表管理表
-- =========================================

CREATE TABLE pharmacy_price_lists (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id TEXT REFERENCES pharmacies(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    effective_date DATE NOT NULL,
    items JSONB NOT NULL,
    status TEXT DEFAULT 'pending_approval',
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

-- =========================================
-- 11. 系统配置和日志表
-- =========================================

CREATE TABLE system_configs (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE TABLE event_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    payload JSONB NOT NULL,
    metadata JSONB,
    processing_status TEXT DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING')),
    processing_attempts INTEGER DEFAULT 0,
    last_processing_error TEXT,
    processed_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON event_logs(event_type);
CREATE INDEX ON event_logs(processing_status);
CREATE INDEX ON event_logs(created_at);

-- =========================================
-- 12. API监控表
-- =========================================

CREATE TABLE api_call_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_agent VARCHAR(500),
    ip VARCHAR(45),
    duration INTEGER NOT NULL, -- Response time in milliseconds
    request_size INTEGER, -- Request body size in bytes
    response_size INTEGER, -- Response body size in bytes
    error_message TEXT,
    request_headers JSONB,
    query_params JSONB,
    request_body JSONB, -- Optional storage for debugging
    response_body JSONB, -- Optional storage for debugging
    metadata JSONB, -- Additional context data
    created_at TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE INDEX ON api_call_logs(user_id, created_at DESC);
CREATE INDEX ON api_call_logs(endpoint, created_at DESC);
CREATE INDEX ON api_call_logs(status_code, created_at DESC);
CREATE INDEX ON api_call_logs(created_at DESC);
CREATE INDEX ON api_call_logs(endpoint, method);

-- =========================================
-- 13. 创建触发器函数（自动更新updated_at）
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有需要的表创建更新触发器
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_practitioner_accounts_updated_at BEFORE UPDATE ON practitioner_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacies_updated_at BEFORE UPDATE ON pharmacies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_accounts_updated_at BEFORE UPDATE ON pharmacy_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fulfillment_proofs_updated_at BEFORE UPDATE ON fulfillment_proofs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON withdrawal_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_price_lists_updated_at BEFORE UPDATE ON pharmacy_price_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_logs_updated_at BEFORE UPDATE ON event_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();