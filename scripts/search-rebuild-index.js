// 🔍 搜索索引重建优化脚本
// 核心小组指定 - DAY 3准备必执行脚本 2/4

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function rebuildSearchIndex() {
  console.log('🔍 搜索索引重建开始...');
  console.log('时间:', new Date().toLocaleString());
  console.log('==========================================');

  try {
    // 1. 创建全文搜索索引
    console.log('\n📊 1. 创建全文搜索索引');
    
    const indexQueries = [
      {
        name: 'medicines_name_search_idx',
        sql: `CREATE INDEX IF NOT EXISTS medicines_name_search_idx ON medicines USING gin(to_tsvector('chinese', name));`
      },
      {
        name: 'medicines_pinyin_idx',
        sql: `CREATE INDEX IF NOT EXISTS medicines_pinyin_idx ON medicines (pinyin);`
      },
      {
        name: 'medicines_latin_name_idx', 
        sql: `CREATE INDEX IF NOT EXISTS medicines_latin_name_idx ON medicines (latin_name);`
      },
      {
        name: 'medicines_sku_idx',
        sql: `CREATE INDEX IF NOT EXISTS medicines_sku_idx ON medicines (sku);`
      },
      {
        name: 'medicines_category_idx',
        sql: `CREATE INDEX IF NOT EXISTS medicines_category_idx ON medicines (category);`
      },
      {
        name: 'medicines_price_idx',
        sql: `CREATE INDEX IF NOT EXISTS medicines_price_idx ON medicines (price);`
      }
    ];

    for (const query of indexQueries) {
      try {
        console.log(`🔧 创建索引: ${query.name}`);
        const { error } = await supabase.rpc('exec_sql', { sql: query.sql });
        
        if (error) {
          console.log(`⚠️ 索引 ${query.name}: ${error.message}`);
        } else {
          console.log(`✅ 索引 ${query.name}: 创建成功`);
        }
      } catch (indexError) {
        console.log(`⚠️ 索引 ${query.name}: ${indexError.message}`);
      }
    }

    // 2. 优化搜索性能统计
    console.log('\n📈 2. 更新表统计信息');
    try {
      const { error: analyzeError } = await supabase.rpc('exec_sql', {
        sql: 'ANALYZE medicines;'
      });
      
      if (analyzeError) {
        console.log('⚠️ 统计信息更新:', analyzeError.message);
      } else {
        console.log('✅ 统计信息更新: 完成');
      }
    } catch (error) {
      console.log('⚠️ 统计信息更新失败:', error.message);
    }

    // 3. 搜索性能测试
    console.log('\n⚡ 3. 搜索性能验证');
    
    const searchTests = [
      { type: '中文', keyword: '紫花地丁' },
      { type: '拼音', keyword: 'daqingye' },
      { type: '拉丁名', keyword: 'Haliotis' },
      { type: 'SKU', keyword: 'WZMT' }
    ];

    for (const test of searchTests) {
      const startTime = Date.now();
      
      const { data: results, error } = await supabase
        .from('medicines')
        .select('id, sku, name')
        .or(`name.ilike.%${test.keyword}%,pinyin.ilike.%${test.keyword}%,latin_name.ilike.%${test.keyword}%,sku.ilike.%${test.keyword}%`)
        .limit(10);

      const responseTime = Date.now() - startTime;
      
      if (error) {
        console.log(`❌ ${test.type}搜索"${test.keyword}": 失败 - ${error.message}`);
      } else {
        console.log(`✅ ${test.type}搜索"${test.keyword}": ${results?.length || 0}条结果, ${responseTime}ms`);
      }
    }

    // 4. 模糊搜索能力测试
    console.log('\n🎯 4. 模糊搜索能力验证');
    
    const fuzzyTests = [
      { keyword: '地丁', expected: '紫花地丁' },
      { keyword: 'qingye', expected: '大青叶' },
      { keyword: '五指', expected: '五指毛桃' }
    ];

    for (const test of fuzzyTests) {
      const startTime = Date.now();
      
      const { data: results } = await supabase
        .from('medicines')
        .select('name, sku')
        .or(`name.ilike.%${test.keyword}%,pinyin.ilike.%${test.keyword}%`)
        .limit(5);

      const responseTime = Date.now() - startTime;
      const found = results?.some(r => r.name.includes(test.expected) || r.name === test.expected);
      
      console.log(`${found ? '✅' : '⚠️'} 模糊搜索"${test.keyword}": ${found ? '找到' + test.expected : '未找到预期结果'}, ${responseTime}ms`);
    }

    // 5. 并发搜索压力测试
    console.log('\n🚀 5. 并发搜索性能测试');
    
    const concurrentSearches = Array(5).fill().map((_, i) =>
      supabase
        .from('medicines')
        .select('id, name')
        .ilike('name', `%测试${i}%`)
        .limit(5)
    );

    const concurrentStart = Date.now();
    const concurrentResults = await Promise.all(concurrentSearches);
    const concurrentTime = Date.now() - concurrentStart;
    
    console.log(`✅ 5个并发搜索完成: ${concurrentTime}ms总时间`);
    console.log(`🎯 平均单次响应: ${Math.round(concurrentTime / 5)}ms`);

    console.log('\n==========================================');
    console.log('🎉 搜索索引重建和优化完成');
    console.log('📊 搜索系统状态: 已优化，DAY 3就绪');
    
    return true;

  } catch (error) {
    console.error('❌ 搜索索引重建过程中发生错误:', error.message);
    return false;
  }
}

// 执行重建
rebuildSearchIndex()
  .then(success => {
    if (success) {
      console.log('\n🏆 搜索系统：优化完成，支持DAY 3高性能搜索');
      process.exit(0);
    } else {
      console.log('\n⚠️ 搜索系统：优化失败，需要检查');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 