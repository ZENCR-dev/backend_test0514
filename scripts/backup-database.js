const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  console.log('🔄 开始备份数据库...\n');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups');
  const backupFile = path.join(backupDir, `backup_${timestamp}.json`);
  
  try {
    // 确保备份目录存在
    await fs.mkdir(backupDir, { recursive: true });
    
    // 备份所有表的数据
    const backup = {
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    // 1. 备份用户数据
    console.log('1. 备份用户数据...');
    backup.tables.users = await prisma.user.findMany({
      include: {
        profile: true,
        practitionerAccount: true,
        operatedPharmacy: true
      }
    });
    console.log(`  ✅ 备份了 ${backup.tables.users.length} 个用户`);
    
    // 2. 备份药品数据
    console.log('2. 备份药品数据...');
    backup.tables.medicines = await prisma.medicine.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.medicines.length} 种药品`);
    
    // 3. 备份药店数据
    console.log('3. 备份药店数据...');
    backup.tables.pharmacies = await prisma.pharmacy.findMany({
      include: {
        operator: true,
        account: true,
        inventory: true
      }
    });
    console.log(`  ✅ 备份了 ${backup.tables.pharmacies.length} 家药店`);
    
    // 4. 备份处方数据
    console.log('4. 备份处方数据...');
    backup.tables.prescriptions = await prisma.prescription.findMany({
      include: {
        practitioner: true,
        medicines: true
      }
    });
    console.log(`  ✅ 备份了 ${backup.tables.prescriptions.length} 张处方`);
    
    // 5. 备份订单数据
    console.log('5. 备份订单数据...');
    backup.tables.orders = await prisma.order.findMany({
      include: {
        items: true,
        payments: true
      }
    });
    console.log(`  ✅ 备份了 ${backup.tables.orders.length} 个订单`);
    
    // 6. 备份系统配置
    console.log('6. 备份系统配置...');
    backup.tables.systemConfigs = await prisma.systemConfig.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.systemConfigs.length} 项配置`);
    
    // 7. 备份药店库存
    console.log('7. 备份药店库存...');
    backup.tables.pharmacyInventory = await prisma.pharmacyInventory.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.pharmacyInventory.length} 条库存记录`);
    
    // 8. 备份药店账户数据
    console.log('8. 备份药店账户数据...');
    backup.tables.pharmacyAccounts = await prisma.pharmacyAccount.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.pharmacyAccounts.length} 个药店账户`);
    
    // 9. 备份药店价目表
    console.log('9. 备份药店价目表...');
    backup.tables.pharmacyPriceLists = await prisma.pharmacyPriceList.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.pharmacyPriceLists.length} 个价目表`);
    
    // 10. 备份履约凭证
    console.log('10. 备份履约凭证...');
    backup.tables.fulfillmentProofs = await prisma.fulfillmentProof.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.fulfillmentProofs.length} 个履约凭证`);
    
    // 11. 备份采购订单
    console.log('11. 备份采购订单...');
    backup.tables.purchaseOrders = await prisma.purchaseOrder.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.purchaseOrders.length} 个采购订单`);
    
    // 12. 备份提现申请
    console.log('12. 备份提现申请...');
    backup.tables.withdrawalRequests = await prisma.withdrawalRequest.findMany();
    console.log(`  ✅ 备份了 ${backup.tables.withdrawalRequests.length} 个提现申请`);
    
    // 保存备份文件
    console.log('\n📝 保存备份文件...');
    await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
    
    // 获取文件大小
    const stats = await fs.stat(backupFile);
    const fileSizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`\n✅ 数据库备份完成！`);
    console.log(`📁 备份文件: ${backupFile}`);
    console.log(`📊 文件大小: ${fileSizeInMB} MB`);
    
    // 统计总记录数
    const totalRecords = Object.entries(backup.tables)
      .reduce((sum, [_, records]) => sum + records.length, 0);
    console.log(`📊 总记录数: ${totalRecords} 条`);
    
    return {
      success: true,
      backupFile,
      fileSize: fileSizeInMB,
      totalRecords,
      timestamp: backup.timestamp
    };
    
  } catch (error) {
    console.error('❌ 备份失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行备份脚本
if (require.main === module) {
  backupDatabase()
    .then((result) => {
      console.log('\n🎉 备份成功完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 备份失败:', error);
      process.exit(1);
    });
}

module.exports = { backupDatabase }; 