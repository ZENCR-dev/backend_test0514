const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';

async function testPrescriptionAuth() {
  console.log('🔍 测试处方API认证问题...\n');

  try {
    // 1. 测试登录获取token
    console.log('1. 测试登录获取JWT token...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'doctor@example.com',
      password: 'password123'
    });

    if (loginResponse.data.success) {
      const token = loginResponse.data.data.accessToken;
      console.log('✅ 登录成功，获取到token');
      console.log('Token:', token.substring(0, 50) + '...');

      // 2. 测试使用token访问处方API
      console.log('\n2. 测试使用token访问处方创建API...');
      
      const testPrescriptionData = {
        clinicId: 'cmc9svktq0001ugucdwn5u1ou', // 使用真实的clinic ID
        patientInfo: {
          name: '测试患者',
          age: 35,
          gender: 'male',
          phone: '13800138000',
          symptoms: '头痛、失眠',
          diagnosis: '肝阳上亢'
        },
        medicines: [
          {
            medicineId: 'cmc1bzq17001bugr4zgn6sx97', // 夏枯草
            quantity: 10,
            dosageInstructions: '每日三次，每次一粒，饭后服用'
          }
        ],
        notes: '注意休息，避免熬夜'
      };

      const prescriptionResponse = await axios.post(
        `${BASE_URL}/prescriptions`,
        testPrescriptionData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ 处方创建成功！');
      console.log('响应:', prescriptionResponse.data);

    } else {
      console.log('❌ 登录失败:', loginResponse.data.message);
    }

  } catch (error) {
    console.log('❌ 测试失败:');
    
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('错误信息:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n🔧 解决方案:');
        console.log('1. 确保前端在请求头中包含有效的JWT token');
        console.log('2. Token格式应为: Authorization: Bearer <token>');
        console.log('3. 确保用户已登录并获取了有效token');
        console.log('4. 检查token是否过期（默认7天）');
      } else if (error.response.status === 400) {
        console.log('\n🔧 解决方案:');
        console.log('1. 检查请求数据格式是否正确');
        console.log('2. 确保所有必需字段都已提供');
        console.log('3. 验证数据类型是否匹配DTO定义');
      }
    } else if (error.request) {
      console.log('❌ 网络错误 - 无法连接到服务器');
      console.log('请确保后端服务正在运行在 http://localhost:3001');
    } else {
      console.log('❌ 请求配置错误:', error.message);
    }
  }
}

// 测试不带token的请求（应该返回401）
async function testWithoutAuth() {
  console.log('\n🔍 测试不带认证的请求（应该返回401）...');
  
  try {
    const response = await axios.post(`${BASE_URL}/prescriptions`, {});
    console.log('❌ 意外成功 - 应该返回401错误');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ 正确返回401未授权错误');
      console.log('错误信息:', error.response.data.message);
    } else {
      console.log('❌ 意外错误:', error.response?.data || error.message);
    }
  }
}

// 检查API端点是否可用
async function checkApiHealth() {
  console.log('🔍 检查API健康状态...');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ API服务正常运行');
    console.log('健康状态:', response.data);
  } catch (error) {
    console.log('❌ API服务不可用');
    console.log('错误:', error.message);
  }
}

async function main() {
  console.log('🚀 处方API认证诊断工具\n');
  
  await checkApiHealth();
  await testWithoutAuth();
  await testPrescriptionAuth();
  
  console.log('\n📋 前端集成建议:');
  console.log('1. 确保用户登录后保存JWT token到localStorage或sessionStorage');
  console.log('2. 在所有API请求中添加Authorization header');
  console.log('3. 处理token过期情况，自动刷新或重新登录');
  console.log('4. 验证请求数据格式符合后端DTO要求');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testPrescriptionAuth, testWithoutAuth, checkApiHealth }; 