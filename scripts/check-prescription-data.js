/**
 * 检查处方创建所需的数据库数据
 * 为前端团队提供有效的测试数据
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPrescriptionData() {
  try {
    console.log('🔍 检查处方创建所需的数据库数据...\n');

    // 1. 检查诊所数据
    console.log('📋 检查诊所数据:');
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        ownerId: true,
      },
      take: 5,
    });

    if (clinics.length === 0) {
      console.log('❌ 未找到任何诊所数据');
      console.log('💡 建议运行: npm run seed 来创建测试数据\n');
    } else {
      console.log('✅ 找到诊所数据:');
      clinics.forEach(clinic => {
        console.log(`   - ID: ${clinic.id}`);
        console.log(`     名称: ${clinic.name}`);
        console.log(`     状态: ${clinic.status}`);
        console.log(`     所有者ID: ${clinic.ownerId}`);
        console.log('');
      });
    }

    // 2. 检查药品数据
    console.log('💊 检查药品数据:');
    const medicines = await prisma.medicine.findMany({
      select: {
        id: true,
        name: true,
        chineseName: true,
        sku: true,
        status: true,
        basePrice: true,
      },
      where: {
        status: 'active',
      },
      take: 5,
    });

    if (medicines.length === 0) {
      console.log('❌ 未找到任何药品数据');
      console.log('💡 建议运行: npm run seed:medicines 来创建药品数据\n');
    } else {
      console.log('✅ 找到药品数据:');
      medicines.forEach(medicine => {
        console.log(`   - ID: ${medicine.id}`);
        console.log(`     SKU: ${medicine.sku}`);
        console.log(`     名称: ${medicine.name}`);
        console.log(`     中文名: ${medicine.chineseName}`);
        console.log(`     价格: $${medicine.basePrice}`);
        console.log(`     状态: ${medicine.status}`);
        console.log('');
      });
    }

    // 3. 检查用户数据（医生）
    console.log('👨‍⚕️ 检查医生用户数据:');
    const doctors = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
      where: {
        role: 'practitioner',
        status: 'approved',
      },
      take: 3,
    });

    if (doctors.length === 0) {
      console.log('❌ 未找到任何医生用户');
    } else {
      console.log('✅ 找到医生用户:');
      doctors.forEach(doctor => {
        console.log(`   - ID: ${doctor.id}`);
        console.log(`     邮箱: ${doctor.email}`);
        console.log(`     角色: ${doctor.role}`);
        console.log(`     状态: ${doctor.status}`);
        console.log('');
      });
    }

    // 4. 生成前端测试用的有效请求数据
    if (clinics.length > 0 && medicines.length > 0) {
      console.log('🎯 前端测试用的有效请求数据:');
      console.log('');
      console.log('```json');
      console.log(JSON.stringify({
        clinicId: clinics[0].id,
        patientInfo: {
          name: "测试患者",
          age: 30,
          gender: "male",
          phone: "021-12345678",
          symptoms: "头痛、失眠",
          diagnosis: "气血不足"
        },
        medicines: [
          {
            medicineId: medicines[0].id,
            quantity: 10,
            dosageInstructions: "每日三次，每次1克",
            notes: "饭后服用"
          }
        ],
        notes: "注意饮食清淡，多休息"
      }, null, 2));
      console.log('```');
      console.log('');
    }

    // 5. 检查处方表结构
    console.log('📄 检查现有处方数据:');
    const prescriptionCount = await prisma.order.count();
    console.log(`   总处方数量: ${prescriptionCount}`);

    if (prescriptionCount > 0) {
      const samplePrescription = await prisma.order.findFirst({
        select: {
          id: true,
          platformOrderId: true,
          status: true,
          practitionerId: true,
          clinicId: true,
          totalAmount: true,
        },
      });
      
      console.log('   示例处方:');
      console.log(`     - ID: ${samplePrescription.id}`);
      console.log(`     - 平台订单号: ${samplePrescription.platformOrderId}`);
      console.log(`     - 状态: ${samplePrescription.status}`);
      console.log(`     - 医生ID: ${samplePrescription.practitionerId}`);
      console.log(`     - 诊所ID: ${samplePrescription.clinicId}`);
      console.log(`     - 总金额: $${samplePrescription.totalAmount}`);
    }

  } catch (error) {
    console.error('❌ 检查数据时发生错误:', error.message);
    console.error('详细错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkPrescriptionData()
    .then(() => {
      console.log('\n✅ 数据检查完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { checkPrescriptionData }; 