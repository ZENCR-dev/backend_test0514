const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPrescriptions() {
  try {
    console.log('🔍 检查处方记录...');
    
    // 检查处方表
    const prescriptions = await prisma.prescription.findMany({
      include: {
        medicines: true,
        practitioner: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    console.log(`📋 找到 ${prescriptions.length} 条处方记录`);
    
    if (prescriptions.length > 0) {
      console.log('\n最新的处方记录:');
      prescriptions.forEach((prescription, index) => {
        console.log(`\n${index + 1}. 处方ID: ${prescription.id}`);
        console.log(`   患者: ${prescription.patientInfo.name}`);
        console.log(`   医生: ${prescription.practitioner?.profile?.fullName || prescription.practitioner?.email}`);
        console.log(`   状态: ${prescription.status}`);
        console.log(`   创建时间: ${prescription.createdAt}`);
        console.log(`   药品数量: ${prescription.medicines.length}`);
        console.log(`   总金额: $${prescription.totalAmount}`);
      });
    } else {
      console.log('❌ 没有找到处方记录');
    }
    
    // 检查最近的数据库活动
    console.log('\n🔍 检查最近15分钟的处方创建...');
    const recentPrescriptions = await prisma.prescription.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000) // 15分钟前
        }
      },
      include: {
        medicines: true,
        practitioner: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (recentPrescriptions.length > 0) {
      console.log(`📋 最近15分钟内创建了 ${recentPrescriptions.length} 条处方记录`);
      recentPrescriptions.forEach((prescription, index) => {
        console.log(`\n${index + 1}. 处方ID: ${prescription.id}`);
        console.log(`   患者: ${prescription.patientInfo.name}`);
        console.log(`   创建时间: ${prescription.createdAt}`);
        console.log(`   状态: ${prescription.status}`);
      });
    } else {
      console.log('❌ 最近15分钟内没有新的处方记录');
    }
    
  } catch (error) {
    console.error('❌ 查询错误:', error);
    if (error.code === 'P2021') {
      console.log('💡 提示: 可能是表不存在，请检查数据库迁移');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkPrescriptions();