const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restoreBasicData() {
  console.log('🔄 开始恢复数据库基础数据...\n');
  
  try {
    // 1. 恢复管理员用户
    console.log('1. 恢复管理员用户...');
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@zencr.org' },
      update: {},
      create: {
        email: 'admin@zencr.org',
        role: 'admin',
        status: 'approved',
        referralCode: 'ADMIN001',
        password: '$2b$10$example.hash.for.admin.user',
        profile: {
          create: {
            fullName: '系统管理员',
            phone: '+64-21-0000000',
            licenseNumber: 'ADMIN001',
            address: {
              street: '123 Admin Street',
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
    console.log('✅ 管理员用户恢复成功:', adminUser.email);

    // 2. 恢复测试医生用户
    console.log('\n2. 恢复测试医生用户...');
    
    const testDoctor = await prisma.user.upsert({
      where: { email: 'doctor@test.com' },
      update: {},
      create: {
        email: 'doctor@test.com',
        role: 'practitioner',
        status: 'approved',
        referralCode: 'DOC001',
        password: '$2b$10$example.hash.for.test.doctor',
        profile: {
          create: {
            fullName: '测试医生',
            phone: '+64-21-1111111',
            licenseNumber: 'DOC001',
            address: {
              street: '456 Doctor Street',
              city: 'Auckland',
              country: 'New Zealand',
              postalCode: '1020'
            },
            preferences: {
              language: 'zh-CN',
              timezone: 'Pacific/Auckland'
            }
          }
        },
        practitionerAccount: {
          create: {
            balance: 1000.00,
            creditLimit: 5000.00,
            usedCredit: 0.00,
            availableCredit: 5000.00,
            status: 'active'
          }
        }
      },
      include: {
        profile: true,
        practitionerAccount: true
      }
    });
    console.log('✅ 测试医生用户恢复成功:', testDoctor.email);

    // 3. 恢复药店操作员用户
    console.log('\n3. 恢复药店操作员用户...');
    
    const pharmacyOperator = await prisma.user.upsert({
      where: { email: 'pharmacy@test.com' },
      update: {},
      create: {
        email: 'pharmacy@test.com',
        role: 'pharmacy_operator',
        status: 'approved',
        referralCode: 'PHARM001',
        password: '$2b$10$example.hash.for.pharmacy.operator',
        profile: {
          create: {
            fullName: '药店操作员',
            phone: '+64-21-2222222',
            licenseNumber: 'PHARM001',
            address: {
              street: '789 Pharmacy Street',
              city: 'Auckland',
              country: 'New Zealand',
              postalCode: '1030'
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
    console.log('✅ 药店操作员用户恢复成功:', pharmacyOperator.email);

    // 4. 恢复测试药店
    console.log('\n4. 恢复测试药店...');
    
    const testPharmacy = await prisma.pharmacy.upsert({
      where: { operatorId: pharmacyOperator.id },
      update: {},
      create: {
        name: '测试药店',
        operatorId: pharmacyOperator.id,
        address: {
          street: '789 Pharmacy Street',
          city: 'Auckland',
          state: 'Auckland',
          country: 'New Zealand',
          postalCode: '1030'
        },
        coordinates: '-36.848461,174.762188',
        contact: {
          phone: '+64-21-2222222',
          email: 'pharmacy@test.com',
          website: 'https://testpharmacy.com'
        },
        licenseInfo: {
          licenseNumber: 'PHARM001',
          issueDate: '2024-01-01',
          expiryDate: '2025-12-31',
          issuingAuthority: 'New Zealand Health Authority'
        },
        serviceHours: {
          monday: { open: '09:00', close: '17:00' },
          tuesday: { open: '09:00', close: '17:00' },
          wednesday: { open: '09:00', close: '17:00' },
          thursday: { open: '09:00', close: '17:00' },
          friday: { open: '09:00', close: '17:00' },
          saturday: { open: '10:00', close: '16:00' },
          sunday: { closed: true }
        },
        status: 'active',
        account: {
          create: {
            balance: 0.00,
            pendingAmount: 0.00,
            status: 'active'
          }
        }
      },
      include: {
        account: true,
        operator: {
          include: {
            profile: true
          }
        }
      }
    });
    console.log('✅ 测试药店恢复成功:', testPharmacy.name);

    // 5. 恢复系统配置
    console.log('\n5. 恢复系统配置...');
    
    const systemConfigs = [
      {
        key: 'system.maintenance_mode',
        value: { enabled: false, message: '系统维护中' },
        description: '系统维护模式配置'
      },
      {
        key: 'payment.default_currency',
        value: { currency: 'NZD', symbol: '$' },
        description: '默认支付货币'
      },
      {
        key: 'order.expiry_hours',
        value: { hours: 24 },
        description: '订单过期时间（小时）'
      },
      {
        key: 'pharmacy.service_radius_km',
        value: { radius: 50 },
        description: '药店服务半径（公里）'
      },
      {
        key: 'prescription.requires_verification',
        value: { enabled: true },
        description: '处方需要验证'
      }
    ];

    for (const config of systemConfigs) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: {
          key: config.key,
          value: config.value,
          description: config.description,
          isActive: true
        }
      });
    }
    console.log('✅ 系统配置恢复成功:', systemConfigs.length, '项配置');

    // 6. 为药店添加一些药品库存
    console.log('\n6. 为药店添加药品库存...');
    
    // 获取前20种药品
    const medicines = await prisma.medicine.findMany({
      take: 20,
      orderBy: { createdAt: 'asc' }
    });

    const inventoryRecords = [];
    for (const medicine of medicines) {
      const inventory = await prisma.pharmacyInventory.upsert({
        where: {
          pharmacyId_medicineId: {
            pharmacyId: testPharmacy.id,
            medicineId: medicine.id
          }
        },
        update: {},
        create: {
          pharmacyId: testPharmacy.id,
          medicineId: medicine.id,
          quantity: Math.floor(Math.random() * 100) + 10, // 10-110的随机数量
          wholesalePrice: parseFloat((medicine.basePrice * 0.8).toFixed(2)),
          retailPrice: parseFloat((medicine.basePrice * 1.2).toFixed(2)),
          lastRestocked: new Date()
        }
      });
      inventoryRecords.push(inventory);
    }
    console.log('✅ 药品库存添加成功:', inventoryRecords.length, '种药品');

    // 7. 验证恢复结果
    console.log('\n7. 验证恢复结果...');
    
    const userCount = await prisma.user.count();
    const pharmacyCount = await prisma.pharmacy.count();
    const configCount = await prisma.systemConfig.count();
    const inventoryCount = await prisma.pharmacyInventory.count();
    
    console.log('📊 数据恢复统计:');
    console.log('  用户数量:', userCount);
    console.log('  药店数量:', pharmacyCount);
    console.log('  系统配置数量:', configCount);
    console.log('  药品库存数量:', inventoryCount);
    console.log('  药品数量:', await prisma.medicine.count());

    console.log('\n✅ 数据库基础数据恢复完成！');
    
  } catch (error) {
    console.error('❌ 数据恢复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行恢复脚本
if (require.main === module) {
  restoreBasicData()
    .then(() => {
      console.log('\n🎉 数据恢复成功完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 数据恢复失败:', error);
      process.exit(1);
    });
}

module.exports = { restoreBasicData };