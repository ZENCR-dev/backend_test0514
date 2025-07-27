// 测试.env.development中的Supabase密钥
require('dotenv').config({ path: '.env.development' });
const { createClient } = require('@supabase/supabase-js');

async function testDevKey() {
  console.log('🔍 测试.env.development中的密钥...');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Key length:', process.env.SUPABASE_ANON_KEY?.length);
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    const { data: medicines, error } = await supabase
      .from('medicines')
      .select('id, name, sku')
      .limit(3);

    if (error) {
      console.error('❌ 失败:', error.message);
      return false;
    }

    console.log('✅ 成功！返回', medicines?.length || 0, '条记录');
    if (medicines?.length > 0) {
      console.log('示例数据:', medicines[0]);
    }
    return true;

  } catch (error) {
    console.error('❌ 错误:', error.message);
    return false;
  }
}

testDevKey()
  .then(success => {
    console.log(success ? '🎉 开发环境密钥有效' : '❌ 开发环境密钥无效');
    process.exit(success ? 0 : 1);
  }); 