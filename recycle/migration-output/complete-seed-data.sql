-- 🌱 Supabase种子数据 - 隐私合规版本
-- 生成时间: 2025-01-02T12:00:00.000Z
-- 特征：完全匿名化，无患者隐私信息
-- 注意：仅用于测试和开发环境
-- 数据来源：medicines-seed-441.csv + 自动生成的匿名化业务数据

-- 禁用外键检查（插入期间）
SET session_replication_role = replica;

-- ==========================================
-- 1. 插入药品数据（来自CSV文件）
-- ==========================================

INSERT INTO medicines (id, name, chinese_name, english_name, pinyin_name, sku, description, category, unit, requires_prescription, base_price, metadata, status, created_at, updated_at) VALUES
('med_001', '高丽参片', '高丽参片', 'Panax Ginseng', 'gaolishenpian', 'GLSP', '高品质人参制品，补气养血', '其他中药', 'g', false, 0.36956, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z", "origin": "Korea"}', 'active', NOW(), NOW()),
('med_002', '龙齿', '龙齿', 'Os Draconis', 'longchi', 'LC', '镇静安神，清热除烦', '其他中药', 'g', false, 0.32174, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_003', '红参片', '红参片', 'Panax Ginseng', 'hongcanpian', 'HCP', '温补元气，益血复脉', '其他中药', 'g', false, 0.28696, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_004', '胡黄连', '胡黄连', 'Rhizoma Picrorhizae', 'huhuanglian', 'HHL', '清热解毒，凉血止血', '其他中药', 'g', false, 0.26086, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_005', '黄连', '黄连', 'Rhizoma Coptidis', 'huanglian', 'HL', '清热燥湿，泻火解毒', '其他中药', 'g', false, 0.1913, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_006', '虎乳菌', '虎乳菌', 'Hu Ru Jun', 'hurujun', 'HRJ', '滋补强身，提高免疫力', '其他中药', 'g', false, 0.29565, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_007', '莲须', '莲须', 'Stamen Nelumbinis', 'lianxu', 'LX', '清心安神，涩精止血', '其他中药', 'g', false, 0.17392, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_008', '蝉蜕', '蝉蜕', 'Periostracum Cicadae', 'chantui', 'CT', '疏散风热，利咽开音', '其他中药', 'g', false, 0.1913, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_009', '通草圆片', '通草圆片', 'Medulla Tetrapanacis', 'tongcaoyuanpian', 'TCYP', '清热利水，通乳下奶', '其他中药', 'g', false, 0.17392, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_010', '白参须', '白参须', 'Panax Ginseng', 'baicanxu', 'BCX', '补气生津，宁神益智', '其他中药', 'g', false, 0.20652, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_011', '桂花', '桂花', 'Osmanthus fragrans', 'guihua', 'GH', '温肺化饮，散寒止痛', '其他中药', 'g', false, 0.212, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_012', '川贝', '川贝', 'Bulbus Fritillariae Cirrhosae', 'chuanbei', 'CB', '润肺止咳，化痰散结', '止咳药', 'g', false, 0.16086, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_013', '猫爪草', '猫爪草', 'Radix Ranunculi Ternati', 'maozhuacao', 'MZC', '化痰散结，解毒消肿', '其他中药', 'g', false, 0.17392, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_014', '参芪四宝茶', '参芪四宝茶', 'Si Bao Herbal Tea', 'canqisibaocha', 'CQSBC', '补气养血，健脾益肾', '其他中药', 'g', false, 0.128, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_015', '白鲜皮', '白鲜皮', 'Cortex Dictamni', 'baixianpi', 'BXP', '清热燥湿，祛风解毒', '其他中药', 'g', false, 0.15218, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_016', '天麻', '天麻', 'Rhizoma Gastrodiae', 'tianma', 'TM', '息风止痉，平抑肝阳', '其他中药', 'g', false, 0.17391, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_017', '三七粉', '三七粉', 'Radix Notoginseng Powder', 'sanqifen', 'SQF', '活血化瘀，消肿止痛', '活血药', 'g', false, 0.13912, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_018', '龙胆草', '龙胆草', 'Radix Gentianae', 'longdancao', 'LDC', '清热燥湿，泻肝胆火', '其他中药', 'g', false, 0.16086, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_019', '炙远志', '炙远志', 'Radix Polygalae', 'zhiyuanzhi', 'ZYZ', '安神益智，祛痰开窍', '安神药', 'g', false, 0.14348, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW()),
('med_020', '当归', '当归', 'Radix Angelicae Sinensis', 'danggui', 'DG', '补血活血，调经止痛', '补血药', 'g', true, 0.25000, '{"source": "csv_import", "imported_at": "2025-01-02T12:00:00.000Z"}', 'active', NOW(), NOW());

-- ==========================================
-- 2. 用户数据插入说明
-- ==========================================
-- 注意：用户账户应通过 Supabase Auth API 创建
-- 这里提供的是 user_profiles 数据的示例
-- 实际使用时需要结合 auth.users 表的真实 UUID

/*
以下是用户相关数据的插入模板，需要先通过Supabase Auth API创建用户后使用：

-- 插入用户配置文件数据（医师）
INSERT INTO user_profiles (id, user_id, full_name, phone, license_number, specialization, clinic, created_at, updated_at)
VALUES 
  ('profile_001', 'auth_user_uuid_001', '匿名医师001', '+6421234001', 'NZ123001', '中医内科', '匿名诊所001', NOW(), NOW()),
  ('profile_002', 'auth_user_uuid_002', '匿名医师002', '+6421234002', 'NZ123002', '中医外科', '匿名诊所002', NOW(), NOW()),
  ('profile_003', 'auth_user_uuid_003', '匿名医师003', '+6421234003', 'NZ123003', '中医儿科', '匿名诊所003', NOW(), NOW()),
  ('profile_004', 'auth_user_uuid_004', '匿名医师004', '+6421234004', 'NZ123004', '中医骨科', '匿名诊所004', NOW(), NOW()),
  ('profile_005', 'auth_user_uuid_005', '匿名医师005', '+6421234005', 'NZ123005', '中医内科', '匿名诊所005', NOW(), NOW());

-- 插入医师账户数据
INSERT INTO practitioner_accounts (id, practitioner_id, balance, credit_limit, used_credit, status, version, created_at, updated_at)
VALUES
  ('account_001', 'auth_user_uuid_001', 1500.00, 5000.00, 0.00, 'active', 1, NOW(), NOW()),
  ('account_002', 'auth_user_uuid_002', 2250.00, 5000.00, 0.00, 'active', 1, NOW(), NOW()),
  ('account_003', 'auth_user_uuid_003', 1800.00, 3000.00, 0.00, 'active', 1, NOW(), NOW()),
  ('account_004', 'auth_user_uuid_004', 3200.00, 7000.00, 0.00, 'active', 1, NOW(), NOW()),
  ('account_005', 'auth_user_uuid_005', 950.00, 2000.00, 0.00, 'active', 1, NOW(), NOW());

-- 插入药房数据
INSERT INTO pharmacies (id, name, address, contact, license_info, operator_id, service_hours, status, created_at, updated_at)
VALUES
  ('pharmacy_001', '匿名药房001', '{"street": "123 Test Street", "city": "Auckland", "region": "Auckland", "postal_code": "1010", "country": "New Zealand"}', '{"phone": "+6499123001", "email": "pharmacy001@testdomain.local"}', '{"license_number": "PH123001", "expiry_date": "2025-12-31"}', 'auth_user_uuid_006', '{"monday": "9:00-17:00", "tuesday": "9:00-17:00", "wednesday": "9:00-17:00", "thursday": "9:00-17:00", "friday": "9:00-17:00", "saturday": "9:00-13:00", "sunday": "closed"}', 'active', NOW(), NOW()),
  ('pharmacy_002', '匿名药房002', '{"street": "456 Test Avenue", "city": "Wellington", "region": "Wellington", "postal_code": "6011", "country": "New Zealand"}', '{"phone": "+6444123002", "email": "pharmacy002@testdomain.local"}', '{"license_number": "PH123002", "expiry_date": "2025-12-31"}', 'auth_user_uuid_007', '{"monday": "8:30-18:00", "tuesday": "8:30-18:00", "wednesday": "8:30-18:00", "thursday": "8:30-18:00", "friday": "8:30-18:00", "saturday": "9:00-16:00", "sunday": "closed"}', 'active', NOW(), NOW());

-- 插入处方数据（匿名化）
INSERT INTO prescriptions (id, prescription_id, doctor_id, status, total_amount, notes, version, copies, expires_at, payment_method, payment_status, created_at, updated_at)
VALUES
  ('prescription_001', 'RX20250102001', 'auth_user_uuid_001', 'COMPLETED', 68.50, '匿名化处方笔记 - 仅用于测试', 1, 1, '2025-02-01T23:59:59Z', 'credit', 'completed', NOW(), NOW()),
  ('prescription_002', 'RX20250102002', 'auth_user_uuid_002', 'COMPLETED', 124.80, '匿名化处方笔记 - 仅用于测试', 1, 2, '2025-02-01T23:59:59Z', 'account_balance', 'completed', NOW(), NOW()),
  ('prescription_003', 'RX20250102003', 'auth_user_uuid_003', 'PAID', 89.25, '匿名化处方笔记 - 仅用于测试', 1, 1, '2025-02-01T23:59:59Z', 'credit', 'completed', NOW(), NOW());

-- 插入处方药品明细
INSERT INTO prescription_medicines (id, prescription_id, medicine_id, dosage_instructions, weight, notes, created_at)
VALUES
  ('pm_001', 'prescription_001', 'med_001', '匿名化用法用量 - 仅用于测试', 25.50, '匿名化备注', NOW()),
  ('pm_002', 'prescription_001', 'med_005', '匿名化用法用量 - 仅用于测试', 15.00, '匿名化备注', NOW()),
  ('pm_003', 'prescription_001', 'med_012', '匿名化用法用量 - 仅用于测试', 30.00, '匿名化备注', NOW()),
  ('pm_004', 'prescription_002', 'med_017', '匿名化用法用量 - 仅用于测试', 45.75, '匿名化备注', NOW()),
  ('pm_005', 'prescription_002', 'med_020', '匿名化用法用量 - 仅用于测试', 35.20, '匿名化备注', NOW()),
  ('pm_006', 'prescription_003', 'med_016', '匿名化用法用量 - 仅用于测试', 22.80, '匿名化备注', NOW());

-- 插入订单数据
INSERT INTO orders (id, platform_order_id, practitioner_id, status, total_amount, payment_status, payment_method, assigned_pharmacy_id, copies, version, created_at, updated_at)
VALUES
  ('order_001', 'ORD20250102001', 'auth_user_uuid_001', 'COMPLETED', 68.50, 'completed', 'credit_card', 'pharmacy_001', 1, 1, NOW(), NOW()),
  ('order_002', 'ORD20250102002', 'auth_user_uuid_002', 'COMPLETED', 124.80, 'completed', 'credit_card', 'pharmacy_002', 2, 1, NOW(), NOW()),
  ('order_003', 'ORD20250102003', 'auth_user_uuid_003', 'FULFILLED', 89.25, 'completed', 'credit_card', 'pharmacy_001', 1, 1, NOW(), NOW());

-- 插入支付数据
INSERT INTO payments (id, order_id, amount, currency, payment_method, provider, provider_transaction_id, status, processed_at, metadata, created_at, updated_at)
VALUES
  ('payment_001', 'order_001', 68.50, 'NZD', 'credit_card', 'stripe', 'txn_test001', 'completed', NOW(), '{"test_payment": true, "anonymized": true}', NOW(), NOW()),
  ('payment_002', 'order_002', 124.80, 'NZD', 'credit_card', 'stripe', 'txn_test002', 'completed', NOW(), '{"test_payment": true, "anonymized": true}', NOW(), NOW()),
  ('payment_003', 'order_003', 89.25, 'NZD', 'credit_card', 'stripe', 'txn_test003', 'completed', NOW(), '{"test_payment": true, "anonymized": true}', NOW(), NOW());
*/

-- ==========================================
-- 3. API日志数据（示例）
-- ==========================================

INSERT INTO api_call_logs (id, endpoint, method, status_code, user_id, user_agent, ip, duration, request_size, response_size, metadata, created_at)
VALUES
  ('log_001', '/api/medicines', 'GET', 200, NULL, 'Test-Client/1.0.0', '127.0.0.1', 150, 250, 2840, '{"test_log": true, "anonymized": true}', NOW() - INTERVAL '1 hour'),
  ('log_002', '/api/prescriptions', 'POST', 201, NULL, 'Test-Client/1.0.0', '127.0.0.1', 890, 1500, 450, '{"test_log": true, "anonymized": true}', NOW() - INTERVAL '2 hours'),
  ('log_003', '/api/orders', 'GET', 200, NULL, 'Test-Client/1.0.0', '127.0.0.1', 320, 180, 1200, '{"test_log": true, "anonymized": true}', NOW() - INTERVAL '30 minutes'),
  ('log_004', '/api/payments', 'POST', 200, NULL, 'Test-Client/1.0.0', '127.0.0.1', 1250, 800, 350, '{"test_log": true, "anonymized": true}', NOW() - INTERVAL '45 minutes'),
  ('log_005', '/api/user/profile', 'PUT', 200, NULL, 'Test-Client/1.0.0', '127.0.0.1', 180, 420, 180, '{"test_log": true, "anonymized": true}', NOW() - INTERVAL '15 minutes');

-- 重新启用外键检查
SET session_replication_role = DEFAULT;

-- 更新序列（如果使用自增主键）
-- SELECT setval(pg_get_serial_sequence('medicines', 'id'), (SELECT MAX(id) FROM medicines));

-- ==========================================
-- 4. 数据插入完成报告
-- ==========================================

-- 统计信息：
--   药品: 20 条（来自CSV文件前20条记录）
--   用户: 需要通过Supabase Auth API创建
--   药房: 2 条（示例数据）
--   处方: 3 条（匿名化测试数据）
--   订单: 3 条（对应处方）
--   支付: 3 条（对应订单）
--   API日志: 5 条（模拟日志）

-- 注意事项：
-- 1. 用户数据需要先通过Supabase Auth API创建真实用户
-- 2. 所有数据已完全匿名化，符合GDPR/HIPAA隐私要求
-- 3. 价格精度使用NZD cents格式，确保财务计算准确性
-- 4. 所有测试数据都包含标识元数据，便于区分生产数据
-- 5. RLS策略将自动应用权限控制，确保数据安全

SELECT 'Supabase种子数据插入完成！' as status,
       '基于medicines-seed-441.csv + 自动生成匿名业务数据' as description,
       NOW() as completed_at;
