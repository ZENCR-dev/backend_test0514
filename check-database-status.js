const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  try {
    console.log('=== 数据库状态检查 ===\n');
    
    // 检查所有表的记录数
    const tables = [
      'User',
      'UserProfile', 
      'PractitionerAccount',
      'AccountTransaction',
      'Medicine',
      'Pharmacy',
      'PharmacyInventory',
      'Order',
      'OrderItem',
      'Payment',
      'FulfillmentProof',
      'Settlement',
      'SystemConfig',
      'EventLog',
      'PharmacyAccount',
      'PharmacyAccountTransaction',
      'PurchaseOrder',
      'PharmacyPriceList',
      'WithdrawalRequest',
      'Prescription',
      'PrescriptionMedicine'
    ];
    
    for (const table of tables) {
      try {
        const count = await prisma[table.toLowerCase()].count();
        console.log(`${table}: ${count} 条记录`);
      } catch (error) {
        console.log(`${table}: 检查失败 - ${error.message}`);
      }
    }
    
    // 检查Medicine表的详细状态
    console.log('\n=== Medicine表详细状态 ===');
    const medicineCount = await prisma.medicine.count();
    console.log(`Medicine总记录数: ${medicineCount}`);
    
    if (medicineCount > 0) {
      // 检查状态分布
      const statusCounts = await prisma.medicine.groupBy({
        by: ['status'],
        _count: { status: true }
      });
      
      console.log('状态分布:');
      statusCounts.forEach(item => {
        console.log(`  ${item.status}: ${item._count.status}`);
      });
      
      // 检查最新创建的几条记录
      const latestMedicines = await prisma.medicine.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          name: true,
          chineseName: true,
          sku: true,
          createdAt: true
        }
      });
      
      console.log('\n最新的3条Medicine记录:');
      latestMedicines.forEach(medicine => {
        console.log(`  ${medicine.sku}: ${medicine.name} (${medicine.chineseName}) - ${medicine.createdAt.toISOString()}`);
      });
    }
    
    // 检查核心用户数据
    console.log('\n=== 核心用户数据 ===');
    const userCount = await prisma.user.count();
    console.log(`用户总数: ${userCount}`);
    
    if (userCount > 0) {
      const userRoles = await prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      });
      
      console.log('用户角色分布:');
      userRoles.forEach(item => {
        console.log(`  ${item.role}: ${item._count.role}`);
      });
    }
    
  } catch (error) {
    console.error('数据库检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStatus();