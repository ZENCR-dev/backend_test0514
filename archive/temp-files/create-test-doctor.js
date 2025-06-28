const http = require('http');

// 创建测试医生账户
async function createTestDoctor() {
  console.log('🏥 创建测试医生账户...');
  
  const doctorData = {
    email: 'testdoctor@tcm.nz',
    password: 'Doctor123!',
    name: 'Dr. 测试医师',
    role: 'DOCTOR',
    phone: '+64-21-123-4567',
    specialization: '中医内科'
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(doctorData);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ 注册响应状态: ${res.statusCode}`);
        console.log(`📄 响应数据:`, data);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('🎉 测试医生账户创建成功！');
        } else {
          console.log('⚠️  账户可能已存在或其他问题');
        }
        
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      console.error('❌ 创建账户失败:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 测试登录
async function testLogin() {
  console.log('\n🔐 测试医生账户登录...');
  
  const loginData = {
    email: 'testdoctor@tcm.nz',
    password: 'Doctor123!'
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(loginData);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ 登录响应状态: ${res.statusCode}`);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const loginResult = JSON.parse(data);
            const token = loginResult.accessToken || loginResult.access_token;
            
            if (token) {
              console.log('🎉 登录成功！JWT Token获取成功');
              console.log('🔑 Token前20字符:', token.substring(0, 20) + '...');
              resolve(token);
            } else {
              console.log('⚠️  登录成功但未获取到Token');
              console.log('📄 响应:', data);
              resolve(null);
            }
          } catch (e) {
            console.log('⚠️  解析登录响应失败');
            console.log('📄 原始响应:', data);
            resolve(null);
          }
        } else {
          console.log('❌ 登录失败:', data);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ 登录请求失败:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 主执行函数
async function setupTestEnvironment() {
  console.log('🚀 Phase 5 集成验证 - 测试环境准备');
  console.log('=' .repeat(50));
  
  try {
    // 1. 创建测试医生账户
    await createTestDoctor();
    
    // 2. 测试登录获取Token
    const token = await testLogin();
    
    if (token) {
      console.log('\n✅ 测试环境准备完成！');
      console.log('🔑 JWT Token已就绪，可以进行API测试');
      console.log('📋 下一步：使用此Token测试处方API端点');
      
      // 保存Token到文件供后续测试使用
      require('fs').writeFileSync('test-jwt-token.txt', token);
      console.log('💾 Token已保存到 test-jwt-token.txt');
    } else {
      console.log('\n❌ 测试环境准备失败！');
      console.log('🔧 建议检查认证系统配置');
    }
    
  } catch (error) {
    console.error('💥 执行过程中发生错误:', error.message);
  }
}

// 运行测试环境设置
setupTestEnvironment(); 