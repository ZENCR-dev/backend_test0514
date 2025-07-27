#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function extendUserProfileTable() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 开始扩展UserProfile表结构...');
    
    // 医师专业信息
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);
    `);
    console.log('✅ 添加specialization字段');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS clinic VARCHAR(255);
    `);
    console.log('✅ 添加clinic字段');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS qualifications JSON;
    `);
    console.log('✅ 添加qualifications字段');
    
    // APC文件管理
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS apc_expiry_date DATE;
    `);
    console.log('✅ 添加apc_expiry_date字段');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS apc_file_url VARCHAR(500);
    `);
    console.log('✅ 添加apc_file_url字段');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS apc_upload_date TIMESTAMP;
    `);
    console.log('✅ 添加apc_upload_date字段');
    
    // 添加索引
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_user_profiles_apc_expiry ON user_profiles(apc_expiry_date);
    `);
    console.log('✅ 创建APC有效期索引');
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_user_profiles_specialization ON user_profiles(specialization);
    `);
    console.log('✅ 创建专业信息索引');
    
    // 验证表结构
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 UserProfile表当前结构:');
    result.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('\n🎉 UserProfile表扩展完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

extendUserProfileTable().catch(console.error);