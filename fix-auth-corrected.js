const http = require('http');

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

// 创建正确格式的测试医生账户
async function createCorrectedBackendTestDoctor() {
  console.log('🏥 创建格式正确的后端测试医生账户...');
  
  const doctorData = {
    email: 'backend.doctor@tcm.nz',
    password: 'BackendAPI123!',
    role: 'practitioner',
    fullName: 'Dr. 后端测试医师',
    phone: '+64-21-998-8877',
    licenseNumber: 'TCM-NZ-BACKEND-001',
    address: JSON.stringify({  // 正确格式：JSON字符串
      street: '456 Backend Test Street',
      city: 'Auckland',
      country: 'New Zealand',
      postcode: '1011'
    }),
    referralCode: 'BACKEND2024'
  };

  try {
    console.log('📤 发送注册请求...');
    console.log('📋 数据格式验证:');
    console.log(`   email: ${doctorData.email} (string)`);
    console.log(`   password: ${doctorData.password.length}字符 (>=6)`);
    console.log(`   role: ${doctorData.role} (enum)`);
    console.log(`   fullName: ${doctorData.fullName} (string)`);
    console.log(`   address: ${typeof doctorData.address} (JSON string)`);
    
    const response = await makeRequest('POST', '/api/v1/auth/register', doctorData);
    
    console.log(`📊 注册响应状态: ${response.statusCode}`);
    console.log(`📄 响应数据:`, response.data);
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      console.log('✅ 后端测试医生注册成功！');
      return true;
    } else {
      console.log('❌ 注册失败，但用户可能已存在');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 注册请求失败:', error.message);
    return false;
  }
}

// 测试登录
async function testCorrectedLogin() {
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
          console.log('👤 用户信息:', loginResult.user?.email, '-', loginResult.user?.role);
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

// 快速API验证测试
async function quickAPIValidation(token) {
  console.log('\n🚀 快速API验证测试');
  console.log('=' .repeat(40));
  
  const tests = [
    {
      name: '药品分类API',
      method: 'GET',
      path: '/api/v1/medicines/categories'
    },
    {
      name: '处方列表API', 
      method: 'GET',
      path: '/api/v1/prescriptions'
    },
    {
      name: '处方分类统计',
      method: 'GET', 
      path: '/api/v1/prescriptions/categories/summary'
    }
  ];

  let passedTests = 0;

  for (const test of tests) {
    try {
      console.log(`\n🔍 ${test.name}`);
      const response = await makeRequest(test.method, test.path, null, token);
      
      console.log(`📊 状态: ${response.statusCode}`);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        passedTests++;
        console.log('✅ 通过');
      } else {
        console.log('⚠️  需要调试');
      }
      
    } catch (error) {
      console.log(`❌ 失败: ${error.message}`);
    }
  }

  return { passedTests, totalTests: tests.length };
}

// 主执行函数
async function runCorrectedAuthTest() {
  console.log('🎊 DAY3 Stage 2 - Phase 5 修正版后端认证测试');
  console.log('🔧 修正数据格式问题');
  console.log('=' .repeat(50));
  
  try {
    // 1. 创建格式正确的测试医生
    const registrationSuccess = await createCorrectedBackendTestDoctor();
    
    // 2. 测试登录
    const token = await testCorrectedLogin();
    
    if (!token) {
      console.log('\n❌ 仍然无法获取认证Token！');
      console.log('🔧 需要进一步诊断后端认证配置');
      return;
    }

    // 3. 快速API验证
    const { passedTests, totalTests } = await quickAPIValidation(token);
    
    console.log('\n🏁 修正版测试结果');
    console.log('=' .repeat(40));
    console.log(`✅ 认证成功: ${!!token ? '是' : '否'}`);
    console.log(`🧪 API测试: ${passedTests}/${totalTests} 通过`);
    
    if (token && passedTests > 0) {
      console.log('\n🎉 后端认证问题已解决！');
      console.log('🚀 可以进行完整的处方API测试了！');
      console.log('\n📋 成功的后端测试账户:');
      console.log('   邮箱: backend.doctor@tcm.nz');
      console.log('   密码: BackendAPI123!');
      console.log('   角色: practitioner');
      console.log('   状态: 认证成功，API可用');
      
      // 保存Token
      require('fs').writeFileSync('backend-auth-success-token.txt', token);
      console.log('💾 Token已保存到 backend-auth-success-token.txt');
    } else {
      console.log('\n⚠️  部分成功，需要继续调试');
    }
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message);
  }
}

// 启动修正版测试
runCorrectedAuthTest(); 