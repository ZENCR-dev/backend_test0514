#\!/usr/bin/env node
/**
 * 执行数据库迁移 - amounts → copies
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function executeMigration() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "postgresql://postgres.ogfpdeaoknxpwzwmfnmp:YS$a\!8yMy-jDxE2@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
      }
    }
  });

  try {
    console.log('🔄 开始执行数据库迁移...');
    
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 1. 执行Prescription表迁移
    console.log('\n1. 执行Prescription表迁移:');
    const prescriptionScript = fs.readFileSync('./migration-prescription-amounts-to-copies.sql', 'utf8');
    
    try {
      await prisma.$executeRawUnsafe(prescriptionScript);
      console.log('   ✅ Prescription表迁移成功');
    } catch (error) {
      console.log(`   ❌ Prescription表迁移失败: ${error.message}`);
      throw error;
    }

    // 2. 执行Order表迁移
    console.log('\n2. 执行Order表迁移:');
    const orderScript = fs.readFileSync('./migration-order-amounts-to-copies.sql', 'utf8');
    
    try {
      await prisma.$executeRawUnsafe(orderScript);
      console.log('   ✅ Order表迁移成功');
    } catch (error) {
      console.log(`   ❌ Order表迁移失败: ${error.message}`);
      throw error;
    }

    console.log('\n✅ 数据库迁移完成');
    console.log('🎯 amounts字段已成功重命名为copies');

  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message);
    console.error('📋 建议：检查迁移脚本和数据库权限');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行迁移
executeMigration()
  .then(() => {
    console.log('\n🎉 迁移执行成功完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 迁移执行失败:', error);
    process.exit(1);
  });
EOF < /dev/null