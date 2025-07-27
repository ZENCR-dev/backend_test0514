const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestPrescriptions() {
  console.log('🔄 创建测试处方数据...\n');
  
  try {
    // 获取医生用户
    const doctor = await prisma.user.findFirst({
      where: { role: 'practitioner' }
    });
    
    if (!doctor) {
      throw new Error('未找到医生用户');
    }
    
    // 获取前10种药品
    const medicines = await prisma.medicine.findMany({
      take: 10,
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('1. 创建测试处方...');
    
    // 创建处方1
    const prescription1 = await prisma.prescription.create({
      data: {
        prescriptionId: `RX-${Date.now()}-001`,
        doctorId: doctor.id,
        patientInfo: {
          name: '张三',
          age: 35,
          gender: '男',
          phone: '+64-21-1234567',
          address: '123 Test Street, Auckland'
        },
        status: 'ACTIVE',
        totalAmount: 45.50,
        notes: '慢性胃炎，按时服药',
        medicines: {
          create: [
            {
              medicineId: medicines[0].id,
              quantity: 30,
              dosageInstructions: '每次2粒，每日3次，饭后服用',
              duration: 10,
              notes: '如有不适请及时就医'
            },
            {
              medicineId: medicines[1].id,
              quantity: 20,
              dosageInstructions: '每次1粒，每日2次，饭前服用',
              duration: 10,
              notes: '保持饮食清淡'
            }
          ]
        }
      },
      include: {
        medicines: {
          include: {
            medicine: true
          }
        }
      }
    });
    
    console.log('✅ 处方1创建成功:', prescription1.prescriptionId);
    
    // 创建处方2
    const prescription2 = await prisma.prescription.create({
      data: {
        prescriptionId: `RX-${Date.now()}-002`,
        doctorId: doctor.id,
        patientInfo: {
          name: '李四',
          age: 42,
          gender: '女',
          phone: '+64-21-2345678',
          address: '456 Health Avenue, Auckland'
        },
        status: 'ACTIVE',
        totalAmount: 68.75,
        notes: '感冒症状，多休息多饮水',
        medicines: {
          create: [
            {
              medicineId: medicines[2].id,
              quantity: 15,
              dosageInstructions: '每次3克，每日3次，温水冲服',
              duration: 7,
              notes: '忌辛辣刺激食物'
            },
            {
              medicineId: medicines[3].id,
              quantity: 25,
              dosageInstructions: '每次5克，每日2次，空腹服用',
              duration: 14,
              notes: '服药期间避免感冒'
            },
            {
              medicineId: medicines[4].id,
              quantity: 10,
              dosageInstructions: '每次1包，每日1次，睡前服用',
              duration: 10,
              notes: '促进睡眠，缓解疲劳'
            }
          ]
        }
      },
      include: {
        medicines: {
          include: {
            medicine: true
          }
        }
      }
    });
    
    console.log('✅ 处方2创建成功:', prescription2.prescriptionId);
    
    // 创建处方3（草稿状态）
    const prescription3 = await prisma.prescription.create({
      data: {
        prescriptionId: `RX-${Date.now()}-003`,
        doctorId: doctor.id,
        patientInfo: {
          name: '王五',
          age: 28,
          gender: '男',
          phone: '+64-21-3456789',
          address: '789 Wellness Road, Auckland'
        },
        status: 'DRAFT',
        totalAmount: 0,
        notes: '待完善处方',
        medicines: {
          create: []
        }
      }
    });
    
    console.log('✅ 处方3创建成功:', prescription3.prescriptionId);
    
    // 验证创建结果
    console.log('\n2. 验证处方数据...');
    
    const prescriptionCount = await prisma.prescription.count();
    const prescriptionMedicineCount = await prisma.prescriptionMedicine.count();
    
    console.log('📊 处方数据统计:');
    console.log('  处方总数:', prescriptionCount);
    console.log('  处方药品记录:', prescriptionMedicineCount);
    
    // 显示处方详情
    const prescriptions = await prisma.prescription.findMany({
      include: {
        practitioner: {
          include: {
            profile: true
          }
        },
        medicines: {
          include: {
            medicine: true
          }
        }
      }
    });
    
    console.log('\n3. 处方详情:');
    prescriptions.forEach(prescription => {
      console.log(`📋 ${prescription.prescriptionId}`);
      console.log(`   医生: ${prescription.practitioner.profile?.fullName || prescription.practitioner.email}`);
      console.log(`   患者: ${prescription.patientInfo.name}`);
      console.log(`   状态: ${prescription.status}`);
      console.log(`   总金额: $${prescription.totalAmount}`);
      console.log(`   药品数量: ${prescription.medicines.length}`);
      prescription.medicines.forEach(medicine => {
        console.log(`     - ${medicine.medicine.chineseName} (${medicine.quantity}${medicine.medicine.unit})`);
        console.log(`       用法: ${medicine.dosageInstructions}`);
      });
      console.log('');
    });
    
    console.log('✅ 测试处方数据创建完成！');
    
  } catch (error) {
    console.error('❌ 处方数据创建失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行创建脚本
if (require.main === module) {
  createTestPrescriptions()
    .then(() => {
      console.log('\n🎉 处方数据创建成功完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 处方数据创建失败:', error);
      process.exit(1);
    });
}

module.exports = { createTestPrescriptions };