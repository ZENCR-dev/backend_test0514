const { PrismaClient } = require('@prisma/client');

async function checkClinicData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 检查clinic数据...');
    
    const clinics = await prisma.clinic.findMany({
      take: 3,
      select: {
        id: true,
        name: true
      }
    });
    
    console.log(`📊 数据库中共有 ${clinics.length} 条clinic记录`);
    
    if (clinics.length > 0) {
      console.log('\n📋 clinic数据:');
      clinics.forEach((clinic, index) => {
        console.log(`${index + 1}. ID: ${clinic.id}`);
        console.log(`   名称: ${clinic.name}`);
        console.log('');
      });
    } else {
      console.log('❌ 数据库中没有clinic数据');
      console.log('💡 需要先添加clinic数据才能创建处方');
    }
    
  } catch (error) {
    console.log('❌ 检查失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkClinicData(); 