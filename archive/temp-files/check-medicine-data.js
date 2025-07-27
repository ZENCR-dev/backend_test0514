const { PrismaClient } = require('@prisma/client');

async function checkMedicineData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 检查药品数据...');
    
    const medicines = await prisma.medicine.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        chineseName: true,
        basePrice: true,
        sku: true
      }
    });
    
    console.log(`📊 数据库中共有 ${medicines.length} 条药品记录`);
    
    if (medicines.length > 0) {
      console.log('\n📋 前5条药品数据:');
      medicines.forEach((medicine, index) => {
        console.log(`${index + 1}. ID: ${medicine.id}`);
        console.log(`   名称: ${medicine.name} (${medicine.chineseName})`);
        console.log(`   价格: $${medicine.basePrice}`);
        console.log(`   SKU: ${medicine.sku}`);
        console.log('');
      });
      
      // 检查测试用的medicine-001是否存在
      const testMedicine = await prisma.medicine.findUnique({
        where: { id: 'medicine-001' }
      });
      
      if (testMedicine) {
        console.log('✅ 测试药品 medicine-001 存在');
      } else {
        console.log('❌ 测试药品 medicine-001 不存在');
        console.log('💡 建议使用实际存在的药品ID进行测试');
      }
    } else {
      console.log('❌ 数据库中没有药品数据');
      console.log('💡 需要先添加药品数据才能创建处方');
    }
    
  } catch (error) {
    console.log('❌ 检查失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMedicineData(); 