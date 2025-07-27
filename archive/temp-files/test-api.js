const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testRegisterAdmin() {
  try {
    const postData = JSON.stringify({
      email: 'admin@example.com',
      password: 'Admin123!',
      fullName: '系统管理员',
      role: 'admin'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await makeRequest(options, postData);
    console.log('管理员注册状态:', response.status);
    console.log('管理员注册响应:', response.data);

    if (response.status === 201 || response.status === 200) {
      console.log('✅ 管理员注册成功！');
      return true;
    } else {
      console.log('❌ 管理员注册失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 管理员注册请求错误:', error.message);
    return false;
  }
}

async function testRegister() {
  try {
    const postData = JSON.stringify({
      email: 'test@example.com',
      password: 'Test123!',
      fullName: '测试用户',
      role: 'practitioner'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await makeRequest(options, postData);
    console.log('注册状态:', response.status);
    console.log('注册响应:', response.data);

    if (response.status === 201 || response.status === 200) {
      console.log('✅ 注册成功！');
      return true;
    } else {
      console.log('❌ 注册失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 注册请求错误:', error.message);
    return false;
  }
}

async function testLogin(email = 'test@example.com', password = 'Test123!') {
  try {
    const postData = JSON.stringify({
      email: email,
      password: password
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await makeRequest(options, postData);
    console.log('登录状态:', response.status);
    console.log('登录响应:', response.data);

    if (response.status === 200 || response.status === 201) {
      const data = JSON.parse(response.data);
      if (data.success && data.accessToken) {
        console.log('✅ 登录成功！Token:', data.accessToken.substring(0, 50) + '...');
        return data.accessToken;
      } else {
        console.log('❌ 登录失败:', data.message);
        return null;
      }
    } else {
      console.log('❌ 登录失败');
      return null;
    }
  } catch (error) {
    console.error('❌ 登录请求错误:', error.message);
    return null;
  }
}

async function testOrdersAPI(token) {
  try {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/orders',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await makeRequest(options);
    console.log('订单API状态:', response.status);
    console.log('订单API响应:', response.data);

    if (response.status === 200) {
      console.log('✅ 订单API测试成功！');
      return true;
    } else {
      console.log('❌ 订单API测试失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 订单API请求错误:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始API集成测试...\n');
  
  console.log('1. 测试管理员注册...');
  await testRegisterAdmin();
  
  console.log('\n2. 测试用户注册...');
  const registerSuccess = await testRegister();
  
  console.log('\n3. 尝试管理员登录...');
  let token = await testLogin('admin@example.com', 'Admin123!');
  
  if (!token) {
    console.log('\n4. 尝试普通用户登录（可能失败）...');
    token = await testLogin('test@example.com', 'Test123!');
  }
  
  if (token) {
    console.log('\n5. 测试订单API...');
    await testOrdersAPI(token);
  } else {
    console.log('\n❌ 无法获取有效token，跳过订单API测试');
    console.log('💡 提示：用户可能需要管理员批准才能登录');
  }
  
  console.log('\n🏁 API测试完成！');
}

runTests(); 