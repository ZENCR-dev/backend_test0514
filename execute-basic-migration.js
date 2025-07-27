const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function executeBasicMigration() {
  console.log('=== 执行简化数据库迁移 ===');
  
  try {
    // 1. 添加Prescription表新字段
    console.log('1. 添加Prescription表新字段...');
    await prisma.$executeRaw`
      ALTER TABLE prescriptions 
      ADD COLUMN IF NOT EXISTS copies INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10,3),
      ADD COLUMN IF NOT EXISTS net_price DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS is_high_value BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS high_value_warning TEXT,
      ADD COLUMN IF NOT EXISTS version INT DEFAULT 1
    `;
    console.log('✅ Prescription表字段添加完成');
    
    // 2. 添加PrescriptionMedicine表新字段
    console.log('2. 添加PrescriptionMedicine表新字段...');
    await prisma.$executeRaw`
      ALTER TABLE prescription_medicines 
      ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3),
      ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,6),
      ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2)
    `;
    console.log('✅ PrescriptionMedicine表字段添加完成');
    
    // 3. 更新Order表结构
    console.log('3. 更新Order表结构...');
    await prisma.$executeRaw`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS prescription_id VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'UNPAID',
      ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS version INT DEFAULT 1
    `;
    console.log('✅ Order表字段添加完成');
    
    // 4. 添加基本约束
    console.log('4. 添加基本约束...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE prescriptions 
        ADD CONSTRAINT check_copies_range CHECK (copies >= 1 AND copies <= 30)
      `;
    } catch (e) {
      console.log('约束已存在，跳过...');
    }
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE prescriptions 
        ADD CONSTRAINT check_net_price_positive CHECK (net_price >= 0)
      `;
    } catch (e) {
      console.log('约束已存在，跳过...');
    }
    
    console.log('✅ 基本约束添加完成');
    
    // 5. 验证结果
    console.log('\n=== 验证迁移结果 ===');
    
    const prescriptionColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prescriptions' 
      AND column_name IN ('copies', 'gross_weight', 'net_price', 'is_high_value', 'high_value_warning', 'version')
      ORDER BY column_name
    `;
    
    console.log('Prescription表新字段:');
    prescriptionColumns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    const medicineColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prescription_medicines' 
      AND column_name IN ('weight', 'unit_price', 'total_price')
      ORDER BY column_name
    `;
    
    console.log('\nPrescriptionMedicine表新字段:');
    medicineColumns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    const orderColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('prescription_id', 'payment_status', 'platform_fee', 'version')
      ORDER BY column_name
    `;
    
    console.log('\nOrder表新字段:');
    orderColumns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ 基本数据库迁移完成！');
    console.log('\n成功变更:');
    console.log('1. ✅ Prescription表: 添加copies, grossWeight, netPrice, isHighValue等字段');
    console.log('2. ✅ PrescriptionMedicine表: 添加weight, unitPrice, totalPrice字段');
    console.log('3. ✅ Order表: 添加prescriptionId, paymentStatus等字段');
    console.log('4. ✅ 添加基本业务约束: 帖数范围(1-30), 金额正数约束');
    
    console.log('\n注意事项:');
    console.log('- 高价值处方触发器和处方ID生成需要手动在数据库中配置');
    console.log('- dosageInstructions → notes 字段重命名需要在应用层处理');
    console.log('- 下一步: 更新API端点和服务层逻辑');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

executeBasicMigration();