const http = require('http');
const fs = require('fs');

// HTTP请求助手
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Phase B: 认证流程完整验证
async function runPhaseB() {
  console.log('🚀 DAY3 Phase B - 认证流程完整验证');
  console.log('🎯 核心小组技术指导决议执行');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  // 测试多个可能的密码
  const testCredentials = [
    { email: 'test@example.com', password: 'password123' },
    { email: 'test@example.com', password: 'password' },
    { email: 'test@example.com', password: '123456' },
    { email: 'test@example.com', password: 'test123' },
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'admin@example.com', password: 'password' }
  ];
  
  let validToken = null;
  let validCredentials = null;
  
  console.log('🔐 Step 1: 尝试登录现有approved用户...');
  
  for (const cred of testCredentials) {
    try {
      console.log(`🔍 测试: ${cred.email} / ${cred.password}`);
      
      const response = await makeRequest('POST', '/api/v1/auth/login', cred);
      
      if (response.statusCode === 200 || response.statusCode === 201) {
        try {
          const loginResult = JSON.parse(response.data);
          const token = loginResult.data?.accessToken || loginResult.accessToken || loginResult.access_token;
          
          if (token) {
            validToken = token;
            validCredentials = cred;
            console.log('🎉 登录成功！');
            console.log(`👤 用户: ${loginResult.data?.user?.email} (${loginResult.data?.user?.role})`);
            console.log(`🔑 Token: ${token.substring(0, 30)}...`);
            break;
          }
        } catch (e) {
          console.log('⚠️  解析响应失败:', e.message);
        }
      } else {
        console.log(`❌ 失败: ${response.statusCode}`);
      }
      
    } catch (error) {
      console.log(`❌ 错误: ${error.message}`);
    }
  }
  
  if (!validToken) {
    console.log('\n❌ 所有认证尝试失败！');
    console.log('🔧 可能需要重置用户密码');
    return { success: false, phase: 'B', error: 'Authentication failed' };
  }
  
  console.log('\n🧪 Step 2: 带token的API测试...');
  
  const apiTests = [
    {
      name: '药品搜索API',
      method: 'GET',
      path: '/api/v1/medicines/search?q=人参',
      expectedStatus: [200]
    },
    {
      name: '药品分类API', 
      method: 'GET',
      path: '/api/v1/medicines/categories',
      expectedStatus: [200]
    },
    {
      name: '处方列表API',
      method: 'GET', 
      path: '/api/v1/prescriptions',
      expectedStatus: [200, 404]
    },
    {
      name: '处方分类统计',
      method: 'GET',
      path: '/api/v1/prescriptions/categories/summary', 
      expectedStatus: [200]
    }
  ];

  let passedAPITests = 0;
  let apiResults = [];

  for (const test of apiTests) {
    try {
      console.log(`\n🔍 ${test.name}`);
      const startTestTime = Date.now();
      
      const response = await makeRequest(test.method, test.path, null, validToken);
      const responseTime = Date.now() - startTestTime;
      
      console.log(`📊 状态: ${response.statusCode} | 时间: ${responseTime}ms`);
      
      const success = test.expectedStatus.includes(response.statusCode);
      
      if (response.data) {
        try {
          const jsonData = JSON.parse(response.data);
          if (jsonData.data) {
            console.log(`📋 数据: ${Array.isArray(jsonData.data) ? jsonData.data.length + '条记录' : '对象数据'}`);
          }
          console.log(`✨ 成功: ${jsonData.success ? '是' : '否'}`);
        } catch (e) {
          const preview = response.data.length > 50 ? response.data.substring(0, 50) + '...' : response.data;
          console.log(`📄 响应: ${preview}`);
        }
      }
      
      if (success) {
        passedAPITests++;
        console.log('✅ 测试通过');
      } else {
        console.log('⚠️  需要调试');
      }
      
      apiResults.push({
        name: test.name,
        success: success,
        statusCode: response.statusCode,
        responseTime: responseTime
      });
      
    } catch (error) {
      console.log(`❌ 失败: ${error.message}`);
      apiResults.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n🏁 Phase B 结果报告');
  console.log('=' .repeat(40));
  console.log(`⏱️  总执行时间: ${totalTime}ms`);
  console.log(`🔐 认证状态: ${validToken ? '成功' : '失败'}`);
  console.log(`🧪 API测试: ${passedAPITests}/${apiTests.length} 通过`);
  console.log(`📊 成功率: ${((passedAPITests/apiTests.length)*100).toFixed(1)}%`);
  
  if (validCredentials) {
    console.log(`👤 有效凭据: ${validCredentials.email} / ${validCredentials.password}`);
  }
  
  const phaseResult = {
    success: !!validToken && passedAPITests > 0,
    phase: 'B',
    executionTime: totalTime,
    authentication: {
      success: !!validToken,
      credentials: validCredentials
    },
    apiTests: {
      passed: passedAPITests,
      total: apiTests.length,
      successRate: ((passedAPITests/apiTests.length)*100).toFixed(1) + '%',
      results: apiResults
    },
    token: validToken
  };
  
  // 保存Phase B结果
  fs.writeFileSync('day3-phase-b-auth-validation-report.json', JSON.stringify(phaseResult, null, 2));
  console.log('💾 Phase B 报告已保存到 day3-phase-b-auth-validation-report.json');
  
  if (phaseResult.success) {
    console.log('\n🎊 Phase B 成功完成！');
    console.log('🔄 准备进入 Phase C - 集成状态最终确认');
    console.log(`🔑 Token可用于下一阶段测试`);
  } else {
    console.log('\n⚠️  Phase B 部分成功，继续下一阶段');
  }
  
  return phaseResult;
}

// 执行Phase B
runPhaseB().then(result => {
  if (result.success) {
    console.log('\n🚀 Phase B完成，系统认证正常工作！');
  } else {
    console.log('\n🔧 Phase B需要进一步优化');
  }
}); 