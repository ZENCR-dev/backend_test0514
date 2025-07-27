const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createPrescriptionTables() {
  console.log('🚀 创建处方相关表...');
  
  try {
    // 使用原始SQL创建表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id TEXT UNIQUE NOT NULL,
        doctor_id TEXT NOT NULL,
        patient_info JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        total_amount DECIMAL(12,2) NOT NULL,
        notes TEXT,
        qr_code_data TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    console.log('✅ prescriptions 表创建成功');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS prescription_medicines (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id TEXT NOT NULL,
        medicine_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        dosage_instructions TEXT NOT NULL,
        duration INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    console.log('✅ prescription_medicines 表创建成功');
    
    // 创建索引
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_prescription_medicines_prescription_id ON prescription_medicines(prescription_id);
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_prescription_medicines_medicine_id ON prescription_medicines(medicine_id);
    `;
    
    console.log('✅ 索引创建成功');
    
    // 验证表是否创建成功
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('prescriptions', 'prescription_medicines');
    `;
    
    console.log('📋 已创建的表:', tableCheck);
    
    console.log('🎉 处方表创建完成!');
    
  } catch (error) {
    console.error('❌ 创建表时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createPrescriptionTables();