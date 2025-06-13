import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeData() {
  console.log('📊 数据分析报告');
  console.log('='.repeat(50));
  
  // 总记录数
  const total = await prisma.medicine.count();
  console.log(`📦 总记录数: ${total}`);
  
  // TCM-开头的记录
  const tcmCount = await prisma.medicine.count({
    where: { sku: { startsWith: 'TCM-' } }
  });
  console.log(`❌ TCM-开头记录: ${tcmCount}`);
  
  // 非TCM-开头的记录
  const nonTcmCount = await prisma.medicine.count({
    where: { sku: { not: { startsWith: 'TCM-' } } }
  });
  console.log(`✅ 正确记录: ${nonTcmCount}`);
  
  // 显示一些TCM-开头的示例
  const tcmSamples = await prisma.medicine.findMany({
    where: { sku: { startsWith: 'TCM-' } },
    select: { sku: true, chineseName: true, englishName: true, pinyinName: true },
    take: 5
  });
  
  console.log('\n❌ TCM-错误数据示例:');
  tcmSamples.forEach((item, index) => {
    console.log(`  ${index + 1}. SKU: ${item.sku}`);
    console.log(`     中文: ${item.chineseName}`);
    console.log(`     英文: ${item.englishName}`);
    console.log(`     拼音: ${item.pinyinName}`);
    console.log('');
  });
  
  // 显示一些正确数据的示例
  const correctSamples = await prisma.medicine.findMany({
    where: { sku: { not: { startsWith: 'TCM-' } } },
    select: { sku: true, chineseName: true, englishName: true, pinyinName: true },
    take: 5
  });
  
  console.log('\n✅ 正确数据示例:');
  correctSamples.forEach((item, index) => {
    console.log(`  ${index + 1}. SKU: ${item.sku}`);
    console.log(`     中文: ${item.chineseName}`);
    console.log(`     英文: ${item.englishName}`);
    console.log(`     拼音: ${item.pinyinName}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

analyzeData().catch(console.error); 