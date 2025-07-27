const http = require('http');
const fs = require('fs');

// 配置
const BASE_URL = 'http://localhost:3001';

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

// 创建测试医生账户（与前端mock不同）
async function createBackendTestDoctor() {
  console.log('🏥 通过后端API创建测试医生账户...');
  
  const doctorData = {
    email: 'backend.doctor@tcm.nz',  // 与前端mock区别开来
    password: 'BackendAPI123!',      // 不同的密码
    role: 'practitioner',
    fullName: 'Dr. 后端测试医师',
    phone: '+64-21-998-8877',
    address: {
      street: '456 Test Street',
      city: 'Auckland',
      country: 'New Zealand',
      postcode: '1011'
    }
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/register', doctorData);
    
    console.log(`📊 注册响应状态: ${response.statusCode}`);
    console.log(`📄 响应数据:`, response.data);
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      console.log('✅ 后端测试医生注册成功！');
      console.log('🔑 登录凭据:');
      console.log(`   邮箱: backend.doctor@tcm.nz`);
      console.log(`   密码: BackendAPI123!`);
      return true;
    } else {
      console.log('⚠️  注册可能失败，但继续尝试登录');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 注册请求失败:', error.message);
    return false;
  }
}

// 尝试登录刚创建的用户
async function testBackendDoctorLogin() {
  console.log('\n🔐 测试后端医生登录...');
  
  const loginData = {
    email: 'backend.doctor@tcm.nz',
    password: 'BackendAPI123!'
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/login', loginData);
    
    console.log(`📊 登录状态: ${response.statusCode}`);
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      try {
        const loginResult = JSON.parse(response.data);
        const token = loginResult.accessToken || loginResult.access_token;
        
        if (token) {
          console.log('🎉 后端医生登录成功！');
          console.log('🔑 Token前20字符:', token.substring(0, 20) + '...');
          return token;
        } else {
          console.log('⚠️  登录成功但未获取Token');
          console.log('📄 完整响应:', response.data);
          return null;
        }
      } catch (e) {
        console.log('⚠️  解析登录响应失败');
        console.log('📄 原始响应:', response.data);
        return null;
      }
    } else {
      console.log('❌ 登录失败详情:', response.data);
      return null;
    }
    
  } catch (error) {
    console.error('❌ 登录请求失败:', error.message);
    return null;
  }
}

// 测试完整的处方API工作流程
async function testPrescriptionAPIWorkflow(token) {
  console.log('\n🚀 开始处方API完整工作流程测试');
  console.log('=' .repeat(60));
  
  const tests = [
    {
      name: '1. 健康检查 - 获取处方列表',
      method: 'GET',
      path: '/api/v1/prescriptions',
      expectedStatus: [200, 404]
    },
    {
      name: '2. 创建新处方',
      method: 'POST',
      path: '/api/v1/prescriptions',
      data: {
        patientInfo: {
          name: '联调测试患者',
          phone: '+64-21-999-1234',
          age: 40,
          gender: 'female',
          address: 'Wellington CBD'
        },
        medicines: [
          {
            medicineId: 'clwj8k6p50000r1dqag9i88xp', // 使用实际的Medicine ID
            quantity: 15,
            dosage: '5g',
            frequency: '每日两次',
            duration: '5天'
          }
        ],
        diagnosis: '调理体质',
        notes: '饭前服用，温水送服',
        totalAmount: 89.50
      },
      expectedStatus: [200, 201],
      saveResponseField: 'prescriptionId'
    },
    {
      name: '3. 获取药品分类统计',
      method: 'GET',
      path: '/api/v1/prescriptions/categories/summary',
      expectedStatus: [200]
    }
  ];

  let createdPrescriptionId = null;
  let passedTests = 0;
  let testResults = [];

  for (const test of tests) {
    try {
      console.log(`\n🔍 ${test.name}`);
      const startTime = Date.now();
      
      const response = await makeRequest(test.method, test.path, test.data, token);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`📊 HTTP状态: ${response.statusCode} | 响应时间: ${responseTime}ms`);
      
      let success = test.expectedStatus.includes(response.statusCode);
      
      if (response.data) {
        try {
          const jsonData = JSON.parse(response.data);
          console.log(`📄 响应类型: ${jsonData.success ? '成功' : '失败'}`);
          
          // 保存创建的处方ID
          if (test.saveResponseField && jsonData.data?.id) {
            createdPrescriptionId = jsonData.data.id;
            console.log(`💾 保存处方ID: ${createdPrescriptionId}`);
          }
          
          if (jsonData.data) {
            console.log(`📋 数据摘要: ${Object.keys(jsonData.data).join(', ')}`);
          }
        } catch (e) {
          const preview = response.data.length > 100 ? response.data.substring(0, 100) + '...' : response.data;
          console.log(`📄 响应数据: ${preview}`);
        }
      }
      
      if (success) {
        passedTests++;
        console.log('✅ 测试通过');
      } else {
        console.log(`❌ 意外状态码，期望: ${test.expectedStatus.join('/')}, 实际: ${response.statusCode}`);
      }
      
      testResults.push({
        name: test.name,
        success: success,
        statusCode: response.statusCode,
        responseTime: responseTime
      });
      
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
      testResults.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }
    
    console.log('-'.repeat(50));
  }

  // 如果创建成功，测试更多操作
  if (createdPrescriptionId) {
    console.log(`\n🔧 测试处方操作 (ID: ${createdPrescriptionId})`);
    
    const moreTests = [
      {
        name: '4. 获取处方详情',
        method: 'GET',
        path: `/api/v1/prescriptions/${createdPrescriptionId}`
      },
      {
        name: '5. 开具处方（生成QR码）',
        method: 'POST',
        path: `/api/v1/prescriptions/${createdPrescriptionId}/issue`
      }
    ];

    for (const test of moreTests) {
      try {
        console.log(`\n🔍 ${test.name}`);
        const response = await makeRequest(test.method, test.path, test.data, token);
        
        console.log(`📊 HTTP状态: ${response.statusCode}`);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          passedTests++;
          console.log('✅ 操作成功');
        } else {
          console.log('⚠️  操作需要调试');
        }
        
        testResults.push({
          name: test.name,
          success: response.statusCode >= 200 && response.statusCode < 300,
          statusCode: response.statusCode
        });
        
      } catch (error) {
        console.log(`❌ 操作失败: ${error.message}`);
        testResults.push({
          name: test.name,
          success: false,
          error: error.message
        });
      }
      
      console.log('-'.repeat(40));
    }
  }

  return { passedTests, totalTests: testResults.length, testResults };
}

// 主执行函数
async function runCompleteAuthAndAPITest() {
  console.log('🎊 DAY3 Stage 2 - Phase 5 后端认证&API完整测试');
  console.log('🏥 新西兰中医处方平台后端联调验证');
  console.log('🆚 与前端Mock账户区别的真实后端测试');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    // 1. 创建测试医生账户
    const registrationSuccess = await createBackendTestDoctor();
    
    // 2. 尝试登录（无论注册是否成功）
    const token = await testBackendDoctorLogin();
    
    if (!token) {
      console.log('\n❌ 无法获取认证Token！');
      console.log('🔧 可能的问题:');
      console.log('   1. 用户状态不是 approved');
      console.log('   2. 密码加密不匹配');
      console.log('   3. 注册API配置问题');
      return;
    }

    // 3. 执行完整工作流程测试
    const { passedTests, totalTests, testResults } = await testPrescriptionAPIWorkflow(token);
    
    // 4. 生成最终报告
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log('\n🏁 后端认证&API完整测试结果');
    console.log('=' .repeat(60));
    console.log(`⏱️  总执行时间: ${totalTime}ms`);
    console.log(`✅ 通过测试: ${passedTests}/${totalTests}`);
    console.log(`📊 成功率: ${((passedTests/totalTests)*100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 完整集成测试成功！');
      console.log('🚀 后端认证&处方API全部验证通过！');
      console.log('🏆 DAY3 Stage 2 Phase 5 技术传奇完成！');
    } else {
      console.log('\n⚠️  部分测试需要调试');
      console.log(`🔧 成功: ${passedTests}, 失败: ${totalTests - passedTests}`);
    }
    
    // 保存详细测试报告
    const report = {
      timestamp: new Date().toISOString(),
      day3_stage2_phase5: 'Backend Auth & API Integration Test',
      registration: registrationSuccess,
      authentication: !!token,
      testResults: { passedTests, totalTests },
      detailedResults: testResults,
      executionTime: totalTime,
      success: passedTests === totalTests,
      backend_test_account: {
        email: 'backend.doctor@tcm.nz',
        password: 'BackendAPI123!',
        role: 'practitioner',
        note: '与前端mock账户区别的后端测试专用账户'
      }
    };
    
    fs.writeFileSync('day3-stage2-phase5-backend-auth-api-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 详细测试报告已保存到 day3-stage2-phase5-backend-auth-api-test-report.json');
    
    console.log('\n📋 后端测试账户信息:');
    console.log('   邮箱: backend.doctor@tcm.nz');
    console.log('   密码: BackendAPI123!');
    console.log('   角色: practitioner (医师)');
    console.log('   说明: 专用于后端联调测试，与前端mock区别');
    
  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
  }
}

// 启动完整测试
runCompleteAuthAndAPITest(); 