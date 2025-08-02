-- 🚨 Supabase RLS策略 - 数据库层权限控制
-- 复用价值: 100% (完整权限控制逻辑)
-- 迁移目标: Supabase PostgreSQL RLS
-- 适配要求: 基于auth.users和user_metadata.role的权限控制

-- =========================================
-- 1. 启用RLS并设置基础策略
-- =========================================

-- 启用所有表的RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioner_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 2. 医师(Practitioner)权限策略
-- =========================================

-- 医师只能访问自己的用户资料
CREATE POLICY "practitioners_own_profile" ON user_profiles
    FOR ALL USING (
        auth.uid() = user_id 
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 医师只能访问自己的账户信息
CREATE POLICY "practitioners_own_account" ON practitioner_accounts
    FOR ALL USING (
        auth.uid() = practitioner_id 
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 医师只能查看自己的交易记录
CREATE POLICY "practitioners_own_transactions" ON account_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM practitioner_accounts 
            WHERE id = account_id 
            AND practitioner_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 医师只能访问自己的处方
CREATE POLICY "practitioners_own_prescriptions" ON prescriptions
    FOR ALL USING (
        auth.uid() = doctor_id 
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 医师只能访问自己处方的药品明细
CREATE POLICY "practitioners_own_prescription_medicines" ON prescription_medicines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM prescriptions 
            WHERE id = prescription_id 
            AND doctor_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 医师只能访问自己的订单
CREATE POLICY "practitioners_own_orders" ON orders
    FOR ALL USING (
        auth.uid() = practitioner_id 
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 医师只能访问自己订单的明细
CREATE POLICY "practitioners_own_order_items" ON order_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE id = order_id 
            AND practitioner_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 医师只能访问自己订单的支付信息
CREATE POLICY "practitioners_own_payments" ON payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE id = order_id 
            AND practitioner_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- =========================================
-- 3. 药房操作员(Pharmacy Operator)权限策略
-- =========================================

-- 药房操作员只能访问自己管理的药房信息
CREATE POLICY "pharmacy_operators_own_pharmacy" ON pharmacies
    FOR ALL USING (
        auth.uid() = operator_id 
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员只能访问自己药房的账户
CREATE POLICY "pharmacy_operators_own_account" ON pharmacy_accounts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pharmacies 
            WHERE id = pharmacy_id 
            AND operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员只能访问自己药房的交易记录
CREATE POLICY "pharmacy_operators_own_transactions" ON pharmacy_account_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pharmacy_accounts pa
            JOIN pharmacies p ON pa.pharmacy_id = p.id
            WHERE pa.id = account_id 
            AND p.operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员只能处理分配给自己药房的订单
CREATE POLICY "pharmacy_operators_assigned_orders" ON orders
    FOR SELECT USING (
        assigned_pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员可以更新分配给自己的订单状态
CREATE POLICY "pharmacy_operators_update_assigned_orders" ON orders
    FOR UPDATE USING (
        assigned_pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员只能访问自己药房的履约证明
CREATE POLICY "pharmacy_operators_own_fulfillment_proofs" ON fulfillment_proofs
    FOR ALL USING (
        pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员只能访问自己药房的采购订单
CREATE POLICY "pharmacy_operators_own_purchase_orders" ON purchase_orders
    FOR ALL USING (
        pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员只能管理自己药房的提现申请
CREATE POLICY "pharmacy_operators_own_withdrawal_requests" ON withdrawal_requests
    FOR ALL USING (
        pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 药房操作员只能管理自己药房的价格表
CREATE POLICY "pharmacy_operators_own_price_lists" ON pharmacy_price_lists
    FOR ALL USING (
        pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- =========================================
-- 4. 管理员(Admin)权限策略
-- =========================================

-- 管理员可以访问所有数据（已在上面的策略中通过OR条件实现）

-- 管理员独有的系统配置访问权限
CREATE POLICY "admin_only_system_configs" ON system_configs
    FOR ALL USING ((auth.jwt() ->> 'role')::text = 'admin');

-- 管理员独有的事件日志访问权限
CREATE POLICY "admin_only_event_logs" ON event_logs
    FOR ALL USING ((auth.jwt() ->> 'role')::text = 'admin');

-- =========================================
-- 5. 公共数据访问策略
-- =========================================

-- 所有认证用户都可以读取药品信息
CREATE POLICY "authenticated_users_read_medicines" ON medicines
    FOR SELECT USING (auth.role() = 'authenticated');

-- 管理员可以管理药品信息
CREATE POLICY "admin_manage_medicines" ON medicines
    FOR ALL USING ((auth.jwt() ->> 'role')::text = 'admin');

-- =========================================
-- 6. API日志访问策略
-- =========================================

-- 用户只能查看自己的API调用日志
CREATE POLICY "users_own_api_logs" ON api_call_logs
    FOR SELECT USING (
        auth.uid() = user_id 
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- 系统可以插入API日志（服务端插入）
CREATE POLICY "system_insert_api_logs" ON api_call_logs
    FOR INSERT WITH CHECK (true);

-- =========================================
-- 7. 特殊业务规则策略
-- =========================================

-- 确保处方只能由医师创建
CREATE POLICY "only_practitioners_create_prescriptions" ON prescriptions
    FOR INSERT WITH CHECK (
        (auth.jwt() ->> 'role')::text IN ('practitioner', 'admin')
        AND auth.uid() = doctor_id
    );

-- 确保账户交易只能由系统或管理员创建
CREATE POLICY "system_admin_create_transactions" ON account_transactions
    FOR INSERT WITH CHECK (
        (auth.jwt() ->> 'role')::text = 'admin'
        OR created_by IS NULL  -- 系统自动创建
    );

-- 确保履约证明只能由对应药房创建
CREATE POLICY "pharmacy_create_fulfillment_proofs" ON fulfillment_proofs
    FOR INSERT WITH CHECK (
        pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

-- =========================================
-- 8. 安全审计策略
-- =========================================

-- 创建审计触发器函数
CREATE OR REPLACE FUNCTION audit_user_actions()
RETURNS TRIGGER AS $$
BEGIN
    -- 记录重要操作到event_logs表
    IF TG_OP = 'DELETE' THEN
        INSERT INTO event_logs (event_type, payload, metadata)
        VALUES (
            TG_TABLE_NAME || '_DELETE',
            row_to_json(OLD),
            jsonb_build_object(
                'user_id', auth.uid(),
                'timestamp', NOW(),
                'table_name', TG_TABLE_NAME
            )
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO event_logs (event_type, payload, metadata)
        VALUES (
            TG_TABLE_NAME || '_UPDATE',
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)),
            jsonb_build_object(
                'user_id', auth.uid(),
                'timestamp', NOW(),
                'table_name', TG_TABLE_NAME
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO event_logs (event_type, payload, metadata)
        VALUES (
            TG_TABLE_NAME || '_INSERT',
            row_to_json(NEW),
            jsonb_build_object(
                'user_id', auth.uid(),
                'timestamp', NOW(),
                'table_name', TG_TABLE_NAME
            )
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为关键表创建审计触发器
CREATE TRIGGER audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION audit_user_actions();
CREATE TRIGGER audit_account_transactions AFTER INSERT OR UPDATE OR DELETE ON account_transactions FOR EACH ROW EXECUTE FUNCTION audit_user_actions();
CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION audit_user_actions();
CREATE TRIGGER audit_withdrawal_requests AFTER INSERT OR UPDATE OR DELETE ON withdrawal_requests FOR EACH ROW EXECUTE FUNCTION audit_user_actions();

-- =========================================
-- 9. 性能优化索引
-- =========================================

-- 为RLS策略查询创建优化索引
CREATE INDEX idx_prescriptions_doctor_id_status ON prescriptions(doctor_id, status);
CREATE INDEX idx_orders_practitioner_id_status ON orders(practitioner_id, status);
CREATE INDEX idx_pharmacies_operator_id ON pharmacies(operator_id);
CREATE INDEX idx_fulfillment_proofs_pharmacy_id_status ON fulfillment_proofs(pharmacy_id, review_status);
CREATE INDEX idx_purchase_orders_pharmacy_id_status ON purchase_orders(pharmacy_id, status);

-- 用户角色查询优化索引（基于Supabase Auth的user_metadata）
-- 注意：这个索引需要在auth schema中创建（如果允许的话）
-- CREATE INDEX IF NOT EXISTS idx_users_metadata_role ON auth.users USING GIN (raw_user_meta_data);

-- =========================================
-- 10. 数据验证和约束函数
-- =========================================

-- 验证basePrice不能被药房价格表超过的函数
CREATE OR REPLACE FUNCTION validate_pharmacy_price_list()
RETURNS TRIGGER AS $$
DECLARE
    price_item JSONB;
    medicine_base_price DECIMAL;
    pharmacy_price DECIMAL;
BEGIN
    -- 遍历价格表中的每个药品
    FOR price_item IN SELECT jsonb_array_elements(NEW.items)
    LOOP
        -- 获取药品的basePrice
        SELECT base_price INTO medicine_base_price
        FROM medicines 
        WHERE sku = (price_item ->> 'sku');
        
        pharmacy_price := (price_item ->> 'price')::DECIMAL;
        
        -- 检查药房价格是否超过basePrice
        IF pharmacy_price > medicine_base_price THEN
            RAISE EXCEPTION 'Pharmacy price %.2f for SKU % exceeds base price %.2f', 
                pharmacy_price, (price_item ->> 'sku'), medicine_base_price;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建价格表验证触发器
CREATE TRIGGER validate_pharmacy_prices 
    BEFORE INSERT OR UPDATE ON pharmacy_price_lists 
    FOR EACH ROW EXECUTE FUNCTION validate_pharmacy_price_list();

-- =========================================
-- 11. 权限授予
-- =========================================

-- 授予authenticated用户基本访问权限
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 授予anon用户读取公共数据的权限（如药品信息）
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON medicines TO anon;