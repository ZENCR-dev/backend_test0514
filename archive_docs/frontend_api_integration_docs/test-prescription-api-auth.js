const http = require('http');

// 测试配置
const BASE_URL = 'http://localhost:3001';

// 测试助手函数
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

// 获取JWT Token
async function getAuthToken() {
  console.log('🔐 尝试登录获取JWT Token...');
  
  // 测试用户登录
  const loginData = {
    email: 'doctor@test.com',
    password: 'password123'
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/login', loginData);
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      const loginResult = JSON.parse(response.data);
      if (loginResult.accessToken || loginResult.access_token) {
        const token = loginResult.accessToken || loginResult.access_token;
        console.log('✅ 登录成功，获取到Token');
        return token;
      }
    }
    
    console.log('⚠️ 登录响应:', response.statusCode, response.data.substring(0, 200));
    return null;
  } catch (error) {
    console.log('❌ 登录失败:', error.message);
    return null;
  }
}

// 测试处方API（带认证）
async function testPrescriptionAPIsWithAuth() {
  console.log('🚀 开始处方模块认证API测试');
  console.log('=' .repeat(50));
  
  // 1. 获取认证Token
  const token = await getAuthToken();
  
  if (!token) {
    console.log('❌ 无法获取认证Token，终止测试');
    return;
  }

  // 2. 测试处方API端点
  const tests = [
    {
      name: 'GET /api/v1/prescriptions - 获取处方列表',
      method: 'GET',
      path: '/api/v1/prescriptions'
    },
    {
      name: 'GET /api/v1/prescriptions/categories/summary - 统计分析',
      method: 'GET', 
      path: '/api/v1/prescriptions/categories/summary'
    },
    {
      name: 'POST /api/v1/prescriptions/verify - 验证处方 (无需认证)',
      method: 'POST',
      path: '/api/v1/prescriptions/verify',
      data: { qrCodeString: 'test-qr-code' },
      noAuth: true
    },
    {
      name: 'POST /api/v1/prescriptions - 创建处方',
      method: 'POST',
      path: '/api/v1/prescriptions',
      data: {
        patientInfo: {
          name: '测试患者',
          phone: '123456789',
          age: 30,
          gender: 'male'
        },
        medicines: [
          { medicineId: '1', quantity: 10, dosage: '10g' }
        ],
        diagnosis: '测试诊断',
        notes: '测试备注'
      }
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`\n🔍 测试: ${test.name}`);
      const startTime = Date.now();
      
      const useToken = test.noAuth ? null : token;
      const response = await makeRequest(test.method, test.path, test.data, useToken);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`✅ HTTP状态: ${response.statusCode}`);
      console.log(`⏱️  响应时间: ${responseTime}ms`);
      
      if (response.data) {
        try {
          const jsonData = JSON.parse(response.data);
          console.log(`📄 响应数据: ${JSON.stringify(jsonData, null, 2).substring(0, 300)}...`);
        } catch (e) {
          console.log(`📄 响应数据: ${response.data.substring(0, 300)}...`);
        }
      }
      
      // 更严格的测试标准
      if (response.statusCode >= 200 && response.statusCode < 400) {
        passedTests++;
        console.log('✅ 测试通过');
      } else if (response.statusCode === 401) {
        console.log('🔐 需要认证 (401)');
      } else if (response.statusCode === 404) {
        console.log('❌ 路由不存在 (404)');
      } else {
        console.log(`⚠️  状态码: ${response.statusCode}`);
      }
      
    } catch (error) {
      console.log(`❌ 连接错误: ${error.message}`);
    }
    
    console.log('-'.repeat(40));
  }

  console.log('\n🏁 认证测试结果:');
  console.log(`✅ 通过: ${passedTests}/${totalTests}`);
  console.log(`📊 成功率: ${((passedTests/totalTests)*100).toFixed(1)}%`);
}

// 运行测试
testPrescriptionAPIsWithAuth().catch(console.error); 