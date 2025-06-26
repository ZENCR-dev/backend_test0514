const axios = require('axios');

async function testAPI() {
  try {
    console.log('测试基本API连接...');
    
    // 测试基本连接
    const response = await axios.get('http://localhost:3001');
    console.log('✅ 基本连接成功:', response.status);
    
  } catch (error) {
    console.log('❌ 基本连接失败:');
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应:', error.response.data);
    } else {
      console.log('错误:', error.message);
    }
  }
  
  try {
    console.log('\n测试登录API...');
    
    const loginResponse = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: 'doctor@example.com',
      password: 'password123'
    });
    
    console.log('✅ 登录成功');
    console.log('响应:', loginResponse.data);
    
  } catch (error) {
    console.log('❌ 登录失败:');
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应:', error.response.data);
    } else {
      console.log('错误:', error.message);
    }
  }
}

testAPI(); 