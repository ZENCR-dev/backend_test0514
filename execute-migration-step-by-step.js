const { PrismaClient } = require('@prisma/client');

async function executeMigration() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "postgresql://postgres.ogfpdeaoknxpwzwmfnmp:YS$a!8yMy-jDxE2@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
      }
    }
  });

  try {
    console.log('🔄 开始执行数据库迁移...');
    
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 1. 执行Prescription表迁移
    console.log('\n1. 执行Prescription表迁移:');
    
    // 分步执行SQL语句
    try {
      // 添加copies列
      await prisma.$executeRaw`ALTER TABLE prescriptions ADD COLUMN copies INT`;
      console.log('   ✅ 添加copies列成功');
      
      // 复制数据
      await prisma.$executeRaw`UPDATE prescriptions SET copies = amounts`;
      console.log('   ✅ 数据复制成功');
      
      // 设置NOT NULL约束
      await prisma.$executeRaw`ALTER TABLE prescriptions ALTER COLUMN copies SET NOT NULL`;
      console.log('   ✅ 设置NOT NULL约束成功');
      
      // 删除旧列
      await prisma.$executeRaw`ALTER TABLE prescriptions DROP COLUMN amounts`;
      console.log('   ✅ 删除amounts列成功');
      
      // 添加检查约束
      await prisma.$executeRaw`ALTER TABLE prescriptions ADD CONSTRAINT check_copies_positive CHECK (copies > 0 AND copies <= 100)`;
      console.log('   ✅ 添加检查约束成功');
      
    } catch (error) {
      console.log(`   ❌ Prescription表迁移失败: ${error.message}`);
      throw error;
    }

    // 2. 执行Order表迁移
    console.log('\n2. 执行Order表迁移:');
    
    try {
      // 添加copies列
      await prisma.$executeRaw`ALTER TABLE orders ADD COLUMN copies INT`;
      console.log('   ✅ 添加copies列成功');
      
      // 复制数据
      await prisma.$executeRaw`UPDATE orders SET copies = amounts`;
      console.log('   ✅ 数据复制成功');
      
      // 设置NOT NULL约束
      await prisma.$executeRaw`ALTER TABLE orders ALTER COLUMN copies SET NOT NULL`;
      console.log('   ✅ 设置NOT NULL约束成功');
      
      // 删除旧列
      await prisma.$executeRaw`ALTER TABLE orders DROP COLUMN amounts`;
      console.log('   ✅ 删除amounts列成功');
      
      // 添加检查约束
      await prisma.$executeRaw`ALTER TABLE orders ADD CONSTRAINT check_order_copies_positive CHECK (copies > 0 AND copies <= 100)`;
      console.log('   ✅ 添加检查约束成功');
      
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