// 📊 药品数据库状态检查脚本
// 核心小组指定 - DAY 3准备必执行脚本 1/4

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkMedicinesData() {
  console.log('🔍 药品数据库状态检查开始...');
  console.log('时间:', new Date().toLocaleString());
  console.log('==========================================');

  try {
    // 1. 检查药品总数
    console.log('\n📊 1. 药品数据总体统计');
    const { data: medicines, error: countError, count } = await supabase
      .from('medicines')
      .select('*', { count: 'exact' });

    if (countError) {
      console.error('❌ 药品数据获取失败:', countError.message);
      return false;
    }

    console.log(`✅ 药品总数: ${count} 条记录`);

    // 2. 检查已验证的药品
    const verifiedMedicines = ['ZHDD', 'SJM', 'DQY', 'WZMT'];
    console.log('\n🎯 2. DAY 2验证药品状态检查');
    
    for (const sku of verifiedMedicines) {
      const { data: medicine } = await supabase
        .from('medicines')
        .select('*')
        .eq('sku', sku)
        .single();

      if (medicine) {
        console.log(`✅ ${sku}: ${medicine.name} - $${medicine.price}/g`);
      } else {
        console.log(`❌ ${sku}: 未找到记录`);
      }
    }

    // 3. 数据质量检查
    console.log('\n🔍 3. 数据质量检查');
    
    // 检查必填字段
    const { data: invalidRecords } = await supabase
      .from('medicines')
      .select('id, sku, name')
      .or('name.is.null,sku.is.null,price.is.null');

    console.log(`🎯 数据完整性: ${invalidRecords?.length || 0} 条记录有缺失字段`);

    // 4. 搜索索引测试
    console.log('\n🔍 4. 搜索功能验证');
    const searchTests = [
      { keyword: '五指毛桃', expected: 'WZMT' },
      { keyword: '紫花地丁', expected: 'ZHDD' },
      { keyword: 'daqingye', expected: 'DQY' }
    ];

    for (const test of searchTests) {
      const { data: results } = await supabase
        .from('medicines')
        .select('*')
        .or(`name.ilike.%${test.keyword}%,pinyin.ilike.%${test.keyword}%,latin_name.ilike.%${test.keyword}%`);

      const found = results?.some(r => r.sku === test.expected);
      console.log(`${found ? '✅' : '❌'} 搜索"${test.keyword}": ${found ? '成功' : '失败'}`);
    }

    // 5. 性能基准测试
    console.log('\n⚡ 5. 性能基准测试');
    const startTime = Date.now();
    
    const { data: perfTest } = await supabase
      .from('medicines')
      .select('*')
      .limit(20);

    const responseTime = Date.now() - startTime;
    console.log(`✅ 20条记录查询响应时间: ${responseTime}ms`);
    console.log(`🎯 性能评估: ${responseTime < 300 ? '优秀' : responseTime < 500 ? '良好' : '需优化'}`);

    console.log('\n==========================================');
    console.log('🎉 药品数据库状态检查完成');
    console.log(`📊 总结: ${count}条记录，${responseTime}ms响应时间`);
    
    return true;

  } catch (error) {
    console.error('❌ 数据库检查过程中发生错误:', error.message);
    return false;
  }
}

// 执行检查
checkMedicinesData()
  .then(success => {
    if (success) {
      console.log('\n🏆 数据库状态：就绪，可支持DAY 3联调');
      process.exit(0);
    } else {
      console.log('\n⚠️ 数据库状态：需要修复');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 