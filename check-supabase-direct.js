#!/usr/bin/env node
/**
 * 直接连接Supabase数据库检查真实状况
 */

const { PrismaClient } = require('@prisma/client');

async function checkSupabaseDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "postgresql://postgres.ogfpdeaoknxpwzwmfnmp:YS$a!8yMy-jDxE2@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
      }
    }
  });

  try {
    console.log('🔄 连接到Supabase数据库...');
    
    // 检查数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 检查所有表的记录数
    const tables = [
      { name: 'User', query: () => prisma.user.count() },
      { name: 'Medicine', query: () => prisma.medicine.count() },
      { name: 'Pharmacy', query: () => prisma.pharmacy.count() },
      { name: 'Prescription', query: () => prisma.prescription.count() },
      { name: 'Order', query: () => prisma.order.count() },
      { name: 'SystemConfiguration', query: () => prisma.systemConfiguration.count() },
      { name: 'PharmacyInventory', query: () => prisma.pharmacyInventory.count() },
      { name: 'PharmacyAccount', query: () => prisma.pharmacyAccount.count() },
      { name: 'PractitionerAccount', query: () => prisma.practitionerAccount.count() }
    ];

    console.log('\n📊 数据库表记录统计:');
    console.log('=' .repeat(50));
    
    for (const table of tables) {
      try {
        const count = await table.query();
        console.log(`${table.name.padEnd(20)}: ${count.toString().padStart(5)} 条记录`);
      } catch (error) {
        console.log(`${table.name.padEnd(20)}: ERROR - ${error.message}`);
      }
    }

    // 检查Prescription表字段
    console.log('\n🔍 检查Prescription表字段:');
    try {
      const prescriptions = await prisma.prescription.findMany({
        take: 1,
        select: {
          id: true,
          amounts: true, // 检查amounts字段是否存在
        }
      });
      console.log('✅ Prescription表包含amounts字段');
      if (prescriptions.length > 0) {
        console.log('   示例记录amounts值:', prescriptions[0].amounts);
      }
    } catch (error) {
      if (error.message.includes('amounts')) {
        console.log('❌ Prescription表不包含amounts字段');
        console.log('   错误信息:', error.message);
      } else {
        console.log('⚠️  检查Prescription字段时发生错误:', error.message);
      }
    }

    // 检查Order表字段
    console.log('\n🔍 检查Order表字段:');
    try {
      const orders = await prisma.order.findMany({
        take: 1,
        select: {
          id: true,
          amounts: true, // 检查amounts字段是否存在
        }
      });
      console.log('✅ Order表包含amounts字段');
      if (orders.length > 0) {
        console.log('   示例记录amounts值:', orders[0].amounts);
      }
    } catch (error) {
      if (error.message.includes('amounts')) {
        console.log('❌ Order表不包含amounts字段');
        console.log('   错误信息:', error.message);
      } else {
        console.log('⚠️  检查Order字段时发生错误:', error.message);
      }
    }

    console.log('\n✅ 数据库检查完成');

  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('详细错误信息:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行检查
checkSupabaseDatabase()
  .then(() => {
    console.log('\n🎉 检查脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 脚本执行失败:', error);
    process.exit(1);
  });