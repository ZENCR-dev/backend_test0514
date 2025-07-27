-- 扩展UserProfile表，添加医师专业信息和APC管理字段
-- MVP2.5 Stage 2 用户管理功能所需字段

-- 医师专业信息
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS clinic VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS qualifications JSON;

-- APC文件管理
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS apc_expiry_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS apc_file_url VARCHAR(500);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS apc_upload_date TIMESTAMP;

-- 添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_profiles_apc_expiry ON user_profiles(apc_expiry_date);
CREATE INDEX IF NOT EXISTS idx_user_profiles_specialization ON user_profiles(specialization);

-- 验证表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;