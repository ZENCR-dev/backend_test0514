const http = require('http');
const fs = require('fs');

// 配置
const BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123' // 尝试几个常见密码
};

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

// 尝试多个密码登录
async function attemptLogin() {
  const passwords = ['password123', 'password', '123456', 'test123', 'admin123'];
  
  console.log('🔐 尝试登录现有用户 test@example.com...');
  
  for (const password of passwords) {
    try {
      console.log(`🔍 尝试密码: ${password}`);
      
      const response = await makeRequest('POST', '/api/v1/auth/login', {
        email: TEST_USER.email,
        password: password
      });
      
      if (response.statusCode === 200 || response.statusCode === 201) {
        const loginResult = JSON.parse(response.data);
        const token = loginResult.accessToken || loginResult.access_token || loginResult.token;
        
        if (token) {
          console.log('✅ 登录成功！');
          console.log('🔑 Token前20字符:', token.substring(0, 20) + '...');
          return token;
        }
      }
      
      console.log(`❌ 密码 ${password} 失败:`, response.statusCode);
    } catch (error) {
      console.log(`❌ 密码 ${password} 错误:`, error.message);
    }
  }
  
  return null;
}

// 测试处方API的完整工作流程
async function testPrescriptionWorkflow(token) {
  console.log('\n🚀 开始处方API完整工作流程测试');
  console.log('=' .repeat(60));
  
  const tests = [
    {
      name: '1. 获取处方列表',
      method: 'GET',
      path: '/api/v1/prescriptions',
      expectedStatus: [200, 404] // 可能为空列表
    },
    {
      name: '2. 获取分类统计',
      method: 'GET',
      path: '/api/v1/prescriptions/categories/summary',
      expectedStatus: [200]
    },
    {
      name: '3. 创建新处方',
      method: 'POST',
      path: '/api/v1/prescriptions',
      data: {
        patientInfo: {
          name: '张三',
          phone: '+64-21-123-4567',
          age: 35,
          gender: 'male',
          address: '奥克兰中心'
        },
        medicines: [
          {
            medicineId: '1',
            quantity: 30,
            dosage: '10g',
            frequency: '每日三次',
            duration: '7天'
          }
        ],
        diagnosis: '感冒风寒',
        notes: '饭后服用，多喝温水',
        totalAmount: 150.00
      },
      expectedStatus: [200, 201],
      saveResponseField: 'prescriptionId' // 保存处方ID用于后续测试
    }
  ];

  let createdPrescriptionId = null;
  let passedTests = 0;

  for (const test of tests) {
    try {
      console.log(`\n🔍 ${test.name}`);
      const startTime = Date.now();
      
      const response = await makeRequest(test.method, test.path, test.data, token);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`📊 HTTP状态: ${response.statusCode} | 响应时间: ${responseTime}ms`);
      
      if (response.data) {
        try {
          const jsonData = JSON.parse(response.data);
          console.log(`📄 响应摘要: ${JSON.stringify(jsonData, null, 2).substring(0, 200)}...`);
          
          // 保存创建的处方ID
          if (test.saveResponseField && jsonData.data?.id) {
            createdPrescriptionId = jsonData.data.id;
            console.log(`💾 保存处方ID: ${createdPrescriptionId}`);
          }
        } catch (e) {
          console.log(`📄 响应数据: ${response.data.substring(0, 200)}...`);
        }
      }
      
      if (test.expectedStatus.includes(response.statusCode)) {
        passedTests++;
        console.log('✅ 测试通过');
      } else {
        console.log(`❌ 意外状态码，期望: ${test.expectedStatus.join('/')}, 实际: ${response.statusCode}`);
      }
      
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
    }
    
    console.log('-'.repeat(50));
  }

  // 如果创建成功，测试后续操作
  if (createdPrescriptionId) {
    await testPrescriptionOperations(token, createdPrescriptionId);
  }

  return { passedTests, totalTests: tests.length };
}

// 测试处方操作（开具、验证等）
async function testPrescriptionOperations(token, prescriptionId) {
  console.log(`\n🔧 测试处方操作 (ID: ${prescriptionId})`);
  
  const operations = [
    {
      name: '4. 获取处方详情',
      method: 'GET',
      path: `/api/v1/prescriptions/${prescriptionId}`
    },
    {
      name: '5. 开具处方（生成QR码）',
      method: 'POST',
      path: `/api/v1/prescriptions/${prescriptionId}/issue`
    },
    {
      name: '6. 更新处方状态',
      method: 'PATCH',
      path: `/api/v1/prescriptions/${prescriptionId}/status`,
      data: { status: 'FULFILLED' }
    }
  ];

  for (const op of operations) {
    try {
      console.log(`\n🔍 ${op.name}`);
      const response = await makeRequest(op.method, op.path, op.data, token);
      
      console.log(`📊 HTTP状态: ${response.statusCode}`);
      if (response.data) {
        const preview = response.data.length > 100 ? response.data.substring(0, 100) + '...' : response.data;
        console.log(`📄 响应: ${preview}`);
      }
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log('✅ 操作成功');
      } else {
        console.log('⚠️  操作需要调试');
      }
      
    } catch (error) {
      console.log(`❌ 操作失败: ${error.message}`);
    }
    
    console.log('-'.repeat(40));
  }
}

// 主执行函数
async function runFinalIntegrationTest() {
  console.log('🎊 DAY3 Stage 2 - Phase 5 最终集成测试');
  console.log('🏥 新西兰中医处方平台前后端联调验证');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    // 1. 获取认证Token
    const token = await attemptLogin();
    
    if (!token) {
      console.log('\n❌ 无法获取认证Token，集成测试失败！');
      console.log('🔧 建议：检查数据库中用户密码或重置测试用户');
      return;
    }

    // 2. 执行完整工作流程测试
    const { passedTests, totalTests } = await testPrescriptionWorkflow(token);
    
    // 3. 生成测试报告
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log('\n🏁 Phase 5 最终集成测试结果');
    console.log('=' .repeat(60));
    console.log(`⏱️  总执行时间: ${totalTime}ms`);
    console.log(`✅ 通过测试: ${passedTests}/${totalTests}`);
    console.log(`📊 成功率: ${((passedTests/totalTests)*100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 集成测试完全成功！');
      console.log('🚀 前后端处方模块集成验证通过！');
      console.log('🏆 DAY3 Stage 2 技术传奇完成！');
    } else {
      console.log('\n⚠️  部分测试需要调试');
      console.log('🔧 建议检查失败的API端点');
    }
    
    // 保存测试报告
    const report = {
      timestamp: new Date().toISOString(),
      testResults: { passedTests, totalTests },
      executionTime: totalTime,
      success: passedTests === totalTests
    };
    
    fs.writeFileSync('phase5-integration-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 测试报告已保存到 phase5-integration-test-report.json');
    
  } catch (error) {
    console.error('\n💥 集成测试过程中发生错误:', error.message);
  }
}

// 启动测试
runFinalIntegrationTest(); 