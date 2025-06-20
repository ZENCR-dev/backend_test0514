// 🌱 测试数据准备脚本
// 核心小组指定 - DAY 3准备必执行脚本 4/4

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

console.log('🌱 DAY 3测试数据准备开始...');
console.log('时间:', new Date().toLocaleString());
console.log('==========================================');

async function seedTestData() {
  try {
    // 1. 检查现有数据
    console.log('\n📊 1. 检查现有数据状态');
    
    const { data: existingMedicines, count: existingCount } = await supabase
      .from('medicines')
      .select('*', { count: 'exact' });

    console.log(`📋 现有药品记录: ${existingCount} 条`);

    // 2. DAY 3专用测试数据集
    console.log('\n🎯 2. 准备DAY 3专用测试数据');
    
    const day3TestMedicines = [
      // 分页测试用数据 (30条)
      ...Array.from({ length: 30 }, (_, i) => ({
        sku: `PAGE_TEST_${String(i + 1).padStart(3, '0')}`,
        name: `分页测试药品${i + 1}`,
        pinyin: `fenye_ceshi_yaopin_${i + 1}`,
        latin_name: `Pagination Test Medicine ${i + 1}`,
        category: i % 3 === 0 ? '补益药' : i % 3 === 1 ? '清热药' : '解表药',
        price: (Math.random() * 50 + 5).toFixed(2),
        unit: 'g',
        description: `DAY 3分页功能测试专用药品 ${i + 1}`,
        stock_quantity: Math.floor(Math.random() * 1000) + 100,
        is_prescription_required: i % 2 === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })),
      
      // 排序测试用数据 (10条)
      {
        sku: 'SORT_A_001',
        name: 'A排序测试药品',
        pinyin: 'a_paixu_ceshi',
        latin_name: 'Aordering Test',
        category: '补益药',
        price: '10.00',
        unit: 'g',
        description: '排序测试 - 首字母A',
        stock_quantity: 500,
        is_prescription_required: true
      },
      {
        sku: 'SORT_Z_999',
        name: 'Z排序测试药品',
        pinyin: 'z_paixu_ceshi',
        latin_name: 'Zordering Test',
        category: '清热药',
        price: '99.99',
        unit: 'g',
        description: '排序测试 - 首字母Z',
        stock_quantity: 100,
        is_prescription_required: false
      },
      {
        sku: 'SORT_M_500',
        name: 'M排序测试药品',
        pinyin: 'm_paixu_ceshi',
        latin_name: 'Mordering Test',
        category: '解表药',
        price: '50.50',
        unit: 'g',
        description: '排序测试 - 中间字母M',
        stock_quantity: 300,
        is_prescription_required: true
      },
      
      // 搜索性能测试用数据 (20条)
      ...Array.from({ length: 20 }, (_, i) => ({
        sku: `SEARCH_PERF_${String(i + 1).padStart(3, '0')}`,
        name: `搜索性能测试${i + 1}号药品`,
        pinyin: `sousuo_xingneng_ceshi_${i + 1}`,
        latin_name: `Search Performance Test ${i + 1}`,
        category: ['补益药', '清热药', '解表药', '理气药', '活血药'][i % 5],
        price: (Math.random() * 100 + 10).toFixed(2),
        unit: 'g',
        description: `DAY 3搜索性能压力测试专用数据 ${i + 1}`,
        stock_quantity: Math.floor(Math.random() * 500) + 200,
        is_prescription_required: i % 3 === 0
      })),
      
      // 并发测试专用数据 (15条)
      ...Array.from({ length: 15 }, (_, i) => ({
        sku: `CONCURRENT_${String(i + 1).padStart(3, '0')}`,
        name: `并发测试药品${i + 1}`,
        pinyin: `bingfa_ceshi_${i + 1}`,
        latin_name: `Concurrent Test Medicine ${i + 1}`,
        category: '测试专用',
        price: (10 + i * 2).toFixed(2),
        unit: 'g',
        description: `DAY 3并发搜索测试专用 ${i + 1}`,
        stock_quantity: 1000,
        is_prescription_required: false
      })),
      
      // 特殊字符搜索测试
      {
        sku: 'SPECIAL_CHAR_001',
        name: '特殊字符测试@#$',
        pinyin: 'teshu_zifu_ceshi',
        latin_name: 'Special Character Test',
        category: '测试专用',
        price: '25.00',
        unit: 'g',
        description: '特殊字符搜索功能测试',
        stock_quantity: 100,
        is_prescription_required: false
      }
    ];

    // 3. 插入测试数据
    console.log('\n📝 3. 插入DAY 3测试数据');
    
    // 分批插入，避免单次插入过多数据
    const batchSize = 20;
    let totalInserted = 0;
    
    for (let i = 0; i < day3TestMedicines.length; i += batchSize) {
      const batch = day3TestMedicines.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('medicines')
        .upsert(batch, { 
          onConflict: 'sku',
          ignoreDuplicates: false 
        });

      if (error) {
        console.log(`⚠️ 批次 ${Math.floor(i / batchSize) + 1} 插入警告:`, error.message);
      } else {
        totalInserted += batch.length;
        console.log(`✅ 批次 ${Math.floor(i / batchSize) + 1}: ${batch.length} 条记录插入成功`);
      }
    }

    console.log(`🎯 总计插入: ${totalInserted} 条DAY 3测试数据`);

    // 4. 验证测试数据
    console.log('\n🔍 4. 验证测试数据状态');
    
    const verificationTests = [
      { 
        type: '分页测试数据', 
        query: supabase.from('medicines').select('count', { count: 'exact' }).like('sku', 'PAGE_TEST_%') 
      },
      { 
        type: '排序测试数据', 
        query: supabase.from('medicines').select('count', { count: 'exact' }).like('sku', 'SORT_%') 
      },
      { 
        type: '搜索性能数据', 
        query: supabase.from('medicines').select('count', { count: 'exact' }).like('sku', 'SEARCH_PERF_%') 
      },
      { 
        type: '并发测试数据', 
        query: supabase.from('medicines').select('count', { count: 'exact' }).like('sku', 'CONCURRENT_%') 
      }
    ];

    for (const test of verificationTests) {
      const { count, error } = await test.query;
      if (error) {
        console.log(`❌ ${test.type}验证失败:`, error.message);
      } else {
        console.log(`✅ ${test.type}: ${count} 条记录已就绪`);
      }
    }

    // 5. 创建DAY 3测试场景配置
    console.log('\n📋 5. 生成DAY 3测试场景配置');
    
    const testScenarios = {
      day3_test_scenarios: {
        pagination_test: {
          description: "分页功能测试",
          test_data_count: 30,
          sku_pattern: "PAGE_TEST_%",
          expected_pages: 3,
          items_per_page: 10
        },
        sorting_test: {
          description: "排序功能测试",
          test_data: [
            { sku: "SORT_A_001", name: "A排序测试药品", price: 10.00 },
            { sku: "SORT_M_500", name: "M排序测试药品", price: 50.50 },
            { sku: "SORT_Z_999", name: "Z排序测试药品", price: 99.99 }
          ],
          sort_fields: ["name", "price", "sku"]
        },
        search_performance_test: {
          description: "搜索性能压力测试",
          test_data_count: 20,
          sku_pattern: "SEARCH_PERF_%",
          concurrent_searches: 10,
          expected_response_time_ms: 300
        },
        concurrent_test: {
          description: "并发请求测试",
          test_data_count: 15,
          sku_pattern: "CONCURRENT_%",
          concurrent_users: 50,
          expected_success_rate: 100
        }
      },
      data_verification: {
        total_test_records: totalInserted,
        creation_time: new Date().toISOString(),
        ready_for_day3: true
      }
    };

    const fs = require('fs');
    const path = require('path');
    
    const configPath = path.join(process.cwd(), 'day3-test-scenarios.json');
    fs.writeFileSync(configPath, JSON.stringify(testScenarios, null, 2));
    console.log('✅ DAY 3测试场景配置文件生成: day3-test-scenarios.json');

    // 6. 最终状态检查
    console.log('\n📊 6. 最终数据状态检查');
    
    const { count: finalCount } = await supabase
      .from('medicines')
      .select('*', { count: 'exact' });

    console.log(`📈 总药品记录数: ${finalCount} 条`);
    console.log(`📈 新增测试数据: ${finalCount - existingCount} 条`);

    console.log('\n==========================================');
    console.log('🎉 DAY 3测试数据准备完成');
    console.log('🎯 数据类型: 分页、排序、搜索性能、并发测试');
    console.log('🚀 DAY 3联调测试数据就绪');
    
    return true;

  } catch (error) {
    console.error('❌ 测试数据准备过程中发生错误:', error.message);
    return false;
  }
}

// 执行数据准备
seedTestData()
  .then(success => {
    if (success) {
      console.log('\n🏆 测试数据：准备完成，DAY 3联调数据充足');
      process.exit(0);
    } else {
      console.log('\n⚠️ 测试数据：准备失败，需要检查');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 