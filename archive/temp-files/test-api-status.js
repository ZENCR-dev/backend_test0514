// 🧪 API状态测试脚本
const fetch = require('node-fetch');

async function testAPI() {
  console.log('🧪 测试API连接状态...');
  console.log('时间:', new Date().toLocaleString());
  
  const endpoints = [
    'http://localhost:3001/api/v1/medicines?limit=2',
    'http://localhost:3001/api/v1/medicines?search=五指毛桃'
  ];
  
  for (const url of endpoints) {
    try {
      console.log(`\n📍 测试端点: ${url}`);
      
      const response = await fetch(url);
      console.log(`📊 状态码: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ 响应成功`);
        console.log(`📄 数据条数: ${data.data?.length || 0}`);
        
        if (url.includes('五指毛桃') && data.data?.length > 0) {
          console.log('🎯 五指毛桃测试成功！找到真实API数据');
          data.data.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.name} (SKU: ${item.sku})`);
          });
        }
      } else {
        console.log(`❌ 响应失败: ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`❌ 连接失败:`, error.message);
    }
  }
  
  console.log('\n🏁 API测试完成');
}

// 等待服务启动后测试
setTimeout(testAPI, 5000); 