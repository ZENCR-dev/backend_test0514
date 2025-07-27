/**
 * Day 3-C: 系统验证脚本
 * 验证所有API端点的v1.2格式一致性
 */

console.log('🔍 开始系统验证...\n');

// 简化验证脚本
async function verifyAPIs() {
  const baseUrl = 'http://localhost:3001/api/v1';
  
  console.log('📋 验证药品API...');
  
  try {
    // 测试药品列表API
    const response = await fetch(`${baseUrl}/medicines?page=1&limit=3`);
    const data = await response.json();
    
    console.log('API响应样本:');
    console.log(JSON.stringify(data, null, 2));
    
    // 验证v1.2格式
    let issues = [];
    
    if (typeof data.success !== 'boolean') {
      issues.push('缺少success字段');
    }
    
    if (!data.meta || typeof data.meta !== 'object') {
      issues.push('缺少meta字段');
    } else {
      if (!data.meta.timestamp) {
        issues.push('缺少meta.timestamp');
      }
      if (data.meta.pagination) {
        const p = data.meta.pagination;
        if (typeof p.total !== 'number' || typeof p.page !== 'number' || 
            typeof p.limit !== 'number' || typeof p.totalPages !== 'number') {
          issues.push('分页信息格式错误');
        }
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ v1.2格式验证通过');
      console.log(`✅ 响应时间: ${response.headers.get('x-response-time') || '未知'}`);
    } else {
      console.log('❌ v1.2格式验证失败:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    // 测试认证API
    console.log('\n📋 验证认证API...');
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('登录API响应样本:');
    console.log(JSON.stringify(loginData, null, 2));
    
    if (loginData.success && loginData.data && loginData.data.accessToken) {
      console.log('✅ 认证API v1.2格式验证通过');
    } else {
      console.log('❌ 认证API v1.2格式验证失败');
    }
    
  } catch (error) {
    console.log('❌ API验证失败:', error.message);
  }
}

// 执行验证
verifyAPIs().then(() => {
  console.log('\n📊 系统验证完成');
}).catch(console.error); 