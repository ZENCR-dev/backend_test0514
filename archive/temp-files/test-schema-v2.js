// test-schema-v2.js - 测试 Prisma Schema v2.0
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSchemaV2() {
  console.log('🧪 测试 Prisma Schema v2.0...\n');

  try {
    // 1. 测试数据库连接
    console.log('1. 测试数据库连接...');
    await prisma.$connect();
    console.log('✅ 数据库连接成功\n');

    // 2. 测试创建用户和用户档案
    console.log('2. 测试用户创建...');
    const testUser = await prisma.user.create({
      data: {
        email: `test-doctor-${Date.now()}@example.com`,
        role: 'practitioner',
        status: 'approved',
        referralCode: `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        profile: {
          create: {
            fullName: '测试医生',
            phone: '+64-21-1234567',
            licenseNumber: `LIC${Date.now()}`,
            address: {
              street: '123 Test Street',
              city: 'Auckland',
              country: 'New Zealand',
              postalCode: '1010'
            },
            preferences: {
              language: 'zh-CN',
              timezone: 'Pacific/Auckland'
            }
          }
        }
      },
      include: {
        profile: true
      }
    });
    console.log('✅ 用户创建成功:', testUser.email);
    console.log('✅ 用户档案创建成功:', testUser.profile.fullName);

    // 3. 测试创建诊所和诊所账户
    console.log('\n3. 测试诊所创建...');
    const testClinic = await prisma.clinic.create({
      data: {
        name: '测试中医诊所',
        address: {
          street: '456 Clinic Road',
          city: 'Wellington',
          country: 'New Zealand',
          postalCode: '6011'
        },
        contact: {
          phone: '+64-4-5678901',
          email: 'clinic@example.com'
        },
        licenseNumber: `CLINIC${Date.now()}`,
        ownerId: testUser.id,
        account: {
          create: {
            balance: 1000.00,
            creditLimit: 5000.00,
            usedCredit: 0.00,
            status: 'active'
          }
        }
      },
      include: {
        account: true,
        owner: true
      }
    });
    console.log('✅ 诊所创建成功:', testClinic.name);
    console.log('✅ 诊所账户创建成功，余额:', testClinic.account.balance.toString());

    // 4. 测试创建药品
    console.log('\n4. 测试药品创建...');
    const testMedicine = await prisma.medicine.create({
      data: {
        name: '当归',
        chineseName: '当归',
        englishName: 'Angelica Root',
        pinyinName: 'danggui',
        sku: `MED${Date.now()}`,
        description: '补血调经，润燥滑肠',
        category: '补血药',
        unit: '克',
        requiresPrescription: true,
        basePrice: 15.50,
        metadata: {
          origin: 'Gansu',
          grade: 'Premium',
          storageConditions: '干燥阴凉处'
        },
        status: 'active'
      }
    });
    console.log('✅ 药品创建成功:', testMedicine.name, '价格:', testMedicine.basePrice.toString());

    // 5. 测试订单状态机
    console.log('\n5. 测试订单创建...');
    const testOrder = await prisma.order.create({
      data: {
        platformOrderId: `ORD${Date.now()}`,
        practitionerId: testUser.id,
        clinicId: testClinic.id,
        patientInfo: {
          name: '张三',
          phone: '+64-21-9876543',
          address: '789 Patient Ave, Auckland',
          dateOfBirth: '1980-05-15',
          gender: 'male'
        },
        status: 'DRAFT',
        totalAmount: 155.00,
        idempotencyKey: `IDEM${Date.now()}`,
        items: {
          create: [
            {
              medicineId: testMedicine.id,
              medicineSnapshot: {
                name: testMedicine.name,
                sku: testMedicine.sku,
                unit: testMedicine.unit
              },
              quantity: 10,
              unitPrice: testMedicine.basePrice,
              totalPrice: testMedicine.basePrice * 10,
              dosageInstructions: '每日三次，每次3克，饭后服用'
            }
          ]
        }
      },
      include: {
        items: true,
        practitioner: {
          include: {
            profile: true
          }
        },
        clinic: true
      }
    });
    console.log('✅ 订单创建成功:', testOrder.platformOrderId);
    console.log('✅ 订单状态:', testOrder.status);
    console.log('✅ 订单项数量:', testOrder.items.length);

    // 6. 测试账户交易记录
    console.log('\n6. 测试账户交易...');
    const transaction = await prisma.accountTransaction.create({
      data: {
        accountId: testClinic.account.id,
        transactionType: 'DEBIT',
        amount: testOrder.totalAmount,
        balanceBefore: testClinic.account.balance,
        balanceAfter: testClinic.account.balance - testOrder.totalAmount,
        creditBefore: testClinic.account.usedCredit,
        creditAfter: testClinic.account.usedCredit,
        referenceType: 'ORDER',
        referenceId: testOrder.id,
        description: `订单 ${testOrder.platformOrderId} 扣款`,
        createdBy: testUser.id
      }
    });
    console.log('✅ 账户交易记录创建成功');
    console.log('✅ 交易类型:', transaction.transactionType, '金额:', transaction.amount.toString());

    // 7. 测试统计信息
    console.log('\n7. 测试数据统计...');
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.clinic.count(), 
      prisma.medicine.count(),
      prisma.order.count(),
      prisma.accountTransaction.count()
    ]);
    console.log('✅ 数据统计:');
    console.log(`   - 用户数: ${stats[0]}`);
    console.log(`   - 诊所数: ${stats[1]}`);
    console.log(`   - 药品数: ${stats[2]}`);
    console.log(`   - 订单数: ${stats[3]}`);
    console.log(`   - 交易记录数: ${stats[4]}`);

    console.log('\n🎉 所有测试通过！Prisma Schema v2.0 工作正常！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testSchemaV2(); 