// 简单的Supabase连接测试
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
  console.log('🔍 Supabase连接测试开始...');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Key length:', process.env.SUPABASE_ANON_KEY?.length);
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // 测试1: 基本连接
    console.log('\n📊 测试1: 基本连接测试');
    const { data, error } = await supabase
      .from('medicines')
      .select('count', { count: 'exact' })
      .limit(1);

    if (error) {
      console.error('❌ 连接失败:', error.message);
      console.error('错误详情:', error);
      return false;
    }

    console.log('✅ 连接成功！');

    // 测试2: 简单查询
    console.log('\n📊 测试2: 简单查询测试');
    const { data: medicines, error: queryError } = await supabase
      .from('medicines')
      .select('id, name, sku')
      .limit(3);

    if (queryError) {
      console.error('❌ 查询失败:', queryError.message);
      return false;
    }

    console.log('✅ 查询成功，返回', medicines?.length || 0, '条记录');
    if (medicines?.length > 0) {
      console.log('示例数据:', medicines[0]);
    }

    return true;

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    return false;
  }
}

testSupabaseConnection()
  .then(success => {
    console.log('\n==========================================');
    console.log(success ? '🎉 Supabase连接测试成功' : '❌ Supabase连接测试失败');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 