// 简单的数据库检查脚本 - 避免复杂输出
console.log('Starting database check...');

const { PrismaClient } = require('@prisma/client');

async function simpleDbCheck() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('SUCCESS: Connected to database');
    
    // 检查practitioner_accounts表
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as exists
    `;
    
    const exists = result[0]?.exists;
    console.log('practitioner_accounts table exists:', exists);
    
    // 检查clinic_accounts表
    const clinicResult = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clinic_accounts'
      ) as exists
    `;
    
    const clinicExists = clinicResult[0]?.exists;
    console.log('clinic_accounts table exists:', clinicExists);
    
    // 分析状态
    if (exists && !clinicExists) {
      console.log('STATUS: Migration completed - using practitioner_accounts');
    } else if (!exists && clinicExists) {
      console.log('STATUS: Migration needed - still using clinic_accounts');
    } else if (exists && clinicExists) {
      console.log('STATUS: Transition state - both tables exist');
    } else {
      console.log('STATUS: Error - no account tables found');
    }
    
  } catch (error) {
    console.log('ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

simpleDbCheck().catch(console.error);