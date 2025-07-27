const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseStatusDetailed() {
  try {
    console.log('=== 详细数据库状态检查 ===\n');
    
    // 使用正确的模型名称检查
    const tables = [
      { name: 'User', model: 'user' },
      { name: 'UserProfile', model: 'userProfile' },
      { name: 'PractitionerAccount', model: 'practitionerAccount' },
      { name: 'AccountTransaction', model: 'accountTransaction' },
      { name: 'Medicine', model: 'medicine' },
      { name: 'Pharmacy', model: 'pharmacy' },
      { name: 'PharmacyInventory', model: 'pharmacyInventory' },
      { name: 'Order', model: 'order' },
      { name: 'OrderItem', model: 'orderItem' },
      { name: 'Payment', model: 'payment' },
      { name: 'FulfillmentProof', model: 'fulfillmentProof' },
      { name: 'Settlement', model: 'settlement' },
      { name: 'SystemConfig', model: 'systemConfig' },
      { name: 'EventLog', model: 'eventLog' },
      { name: 'PharmacyAccount', model: 'pharmacyAccount' },
      { name: 'PharmacyAccountTransaction', model: 'pharmacyAccountTransaction' },
      { name: 'PurchaseOrder', model: 'purchaseOrder' },
      { name: 'PharmacyPriceList', model: 'pharmacyPriceList' },
      { name: 'WithdrawalRequest', model: 'withdrawalRequest' },
      { name: 'Prescription', model: 'prescription' },
      { name: 'PrescriptionMedicine', model: 'prescriptionMedicine' }
    ];
    
    console.log('📊 所有表格记录数量:');
    for (const table of tables) {
      try {
        const count = await prisma[table.model].count();
        const status = count > 0 ? '✅' : '❌';
        console.log(`${status} ${table.name}: ${count} 条记录`);
      } catch (error) {
        console.log(`❌ ${table.name}: 检查失败 - ${error.message}`);
      }
    }
    
    // 检查用户详细信息
    console.log('\n=== 用户详细信息 ===');
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        practitionerAccount: true,
        operatedPharmacy: true
      }
    });
    
    users.forEach(user => {
      console.log(`👤 ${user.email} (${user.role})`);
      console.log(`   状态: ${user.status}`);
      console.log(`   档案: ${user.profile ? user.profile.fullName : '无'}`);
      if (user.practitionerAccount) {
        console.log(`   医生账户余额: $${user.practitionerAccount.balance}`);
      }
      if (user.operatedPharmacy) {
        console.log(`   管理药店: ${user.operatedPharmacy.name}`);
      }
      console.log('');
    });
    
    // 检查药店详细信息
    console.log('=== 药店详细信息 ===');
    const pharmacies = await prisma.pharmacy.findMany({
      include: {
        operator: {
          include: {
            profile: true
          }
        },
        account: true,
        inventory: {
          include: {
            medicine: true
          }
        }
      }
    });
    
    pharmacies.forEach(pharmacy => {
      console.log(`🏪 ${pharmacy.name}`);
      console.log(`   操作员: ${pharmacy.operator.profile?.fullName || pharmacy.operator.email}`);
      console.log(`   状态: ${pharmacy.status}`);
      console.log(`   库存种类: ${pharmacy.inventory.length} 种药品`);
      if (pharmacy.account) {
        console.log(`   账户余额: $${pharmacy.account.balance}`);
      }
      console.log('');
    });
    
    // 检查系统配置
    console.log('=== 系统配置 ===');
    const configs = await prisma.systemConfig.findMany();
    configs.forEach(config => {
      console.log(`⚙️ ${config.key}: ${JSON.stringify(config.value)}`);
    });
    
    // 检查药品库存
    console.log('\n=== 药品库存统计 ===');
    const inventoryCount = await prisma.pharmacyInventory.count();
    console.log(`总库存记录: ${inventoryCount}`);
    
    if (inventoryCount > 0) {
      const inventoryStats = await prisma.pharmacyInventory.aggregate({
        _sum: {
          quantity: true
        },
        _avg: {
          retailPrice: true
        }
      });
      
      console.log(`总库存数量: ${inventoryStats._sum.quantity || 0}`);
      console.log(`平均零售价: $${inventoryStats._avg.retailPrice?.toFixed(2) || 0}`);
    }
    
    console.log('\n✅ 详细状态检查完成！');
    
  } catch (error) {
    console.error('❌ 详细检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStatusDetailed();