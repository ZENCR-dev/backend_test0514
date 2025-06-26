const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestClinic() {
  console.log('=== 为医生创建测试诊所 ===');
  
  try {
    // 查找医生用户
    const doctor = await prisma.user.findUnique({
      where: { email: 'doctor@example.com' }
    });
    
    if (!doctor) {
      console.error('找不到医生用户');
      return;
    }
    
    console.log(`找到医生用户: ${doctor.id}`);
    
    // 检查是否已有诊所
    const existingClinic = await prisma.clinic.findFirst({
      where: { ownerId: doctor.id }
    });
    
    if (existingClinic) {
      console.log(`医生已有诊所: ${existingClinic.id} - ${existingClinic.name}`);
      return existingClinic;
    }
    
    // 创建新诊所
    const newClinic = await prisma.clinic.create({
      data: {
        name: '测试中医诊所',
        address: {
          street: '123 测试街',
          city: '奥克兰',
          postalCode: '1010',
          country: '新西兰'
        },
        contact: {
          phone: '09-1234567',
          email: 'test-clinic@example.com'
        },
        licenseNumber: 'TCM-TEST-001',
        ownerId: doctor.id,
        status: 'active'
      }
    });
    
    console.log(`✅ 成功创建诊所: ${newClinic.id} - ${newClinic.name}`);
    
    // 创建诊所账户
    const clinicAccount = await prisma.clinicAccount.create({
      data: {
        clinicId: newClinic.id,
        balance: 1000.00,
        creditLimit: 5000.00,
        usedCredit: 0.00,
        availableCredit: 5000.00,
        status: 'active'
      }
    });
    
    console.log(`✅ 成功创建诊所账户，余额: ${clinicAccount.balance}`);
    
    return newClinic;
  } catch (error) {
    console.error('创建诊所失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行
createTestClinic().catch(console.error); 