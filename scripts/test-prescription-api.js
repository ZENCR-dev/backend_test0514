/**
 * 测试处方创建API
 * 使用有效的数据库数据进行测试
 */

const axios = require('axios');

// 配置
const API_BASE_URL = 'http://localhost:4000/api/v1';
const TEST_USER_EMAIL = 'doctor@example.com';
const TEST_USER_PASSWORD = 'password123';

// 有效的测试数据（来自数据库检查）
const VALID_TEST_DATA = {
  clinicId: "cmc9svktq0001ugucdwn5u1ou",
  patientInfo: {
    name: "测试患者",
    age: 30,
    gender: "male",
    phone: "021-12345678",
    symptoms: "头痛、失眠",
    diagnosis: "气血不足"
  },
  medicines: [
    {
      medicineId: "cmc1bzjmg0000ugr4y037tf2i",
      quantity: 10,
      dosageInstructions: "每日三次，每次1克",
      notes: "饭后服用"
    }
  ],
  notes: "注意饮食清淡，多休息"
};

async function testPrescriptionAPI() {
  try {
    console.log('🧪 开始测试处方创建API...\n');

    // 1. 登录获取token
    console.log('🔐 步骤1: 用户登录...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    if (!loginResponse.data.success) {
      throw new Error('登录失败: ' + loginResponse.data.message);
    }

    const token = loginResponse.data.data.accessToken;
    console.log('✅ 登录成功, Token获取成功');
    console.log(`   用户: ${loginResponse.data.data.user.email}`);
    console.log(`   角色: ${loginResponse.data.data.user.role}`);
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log('');

    // 2. 测试处方创建
    console.log('📋 步骤2: 创建处方...');
    console.log('请求数据:');
    console.log(JSON.stringify(VALID_TEST_DATA, null, 2));
    console.log('');

    const createResponse = await axios.post(
      `${API_BASE_URL}/prescriptions`,
      VALID_TEST_DATA,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ 处方创建成功!');
    console.log('响应数据:');
    console.log(JSON.stringify(createResponse.data, null, 2));
    console.log('');

    // 3. 验证创建的处方
    const prescriptionId = createResponse.data.data.id;
    console.log(`🔍 步骤3: 验证创建的处方 (ID: ${prescriptionId})...`);

    const getResponse = await axios.get(
      `${API_BASE_URL}/prescriptions/${prescriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ 处方验证成功!');
    console.log('处方详情:');
    console.log(`   - ID: ${getResponse.data.data.id}`);
    console.log(`   - 平台订单号: ${getResponse.data.data.platformOrderId}`);
    console.log(`   - 状态: ${getResponse.data.data.status}`);
    console.log(`   - 患者: ${getResponse.data.data.patientInfo.name}`);
    console.log(`   - 药品数量: ${getResponse.data.data.items?.length || 0}`);
    console.log(`   - 总金额: $${getResponse.data.data.totalAmount}`);
    console.log('');

    // 4. 测试药品搜索API
    console.log('🔍 步骤4: 测试药品搜索API...');
    const searchResponse = await axios.get(`${API_BASE_URL}/medicines?search=当归`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ 药品搜索成功!');
    console.log(`找到 ${searchResponse.data.data.length} 个药品:`);
    searchResponse.data.data.forEach(medicine => {
      console.log(`   - ID: ${medicine.id}`);
      console.log(`     名称: ${medicine.name} (${medicine.chineseName})`);
      console.log(`     SKU: ${medicine.sku}`);
      console.log(`     价格: $${medicine.basePrice}`);
      console.log('');
    });

    console.log('🎉 所有测试通过! 前端可以使用以下数据进行测试:');
    console.log('');
    console.log('=== 前端测试指南 ===');
    console.log('1. 登录用户: doctor@example.com / password123');
    console.log('2. 使用的clinicId:', VALID_TEST_DATA.clinicId);
    console.log('3. 使用的medicineId:', VALID_TEST_DATA.medicines[0].medicineId);
    console.log('4. API端点正常工作:');
    console.log('   - POST /api/v1/prescriptions (创建处方)');
    console.log('   - GET /api/v1/prescriptions/:id (获取处方详情)');
    console.log('   - GET /api/v1/medicines?search=关键词 (搜索药品)');

  } catch (error) {
    console.error('❌ 测试失败:');
    
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
      
      // 特别处理验证错误
      if (error.response.status === 400 && error.response.data.message) {
        console.error('\n🔍 验证错误分析:');
        console.error('错误信息:', error.response.data.message);
        
        if (error.response.data.message.includes('Validation failed')) {
          console.error('\n💡 可能的原因:');
          console.error('1. clinicId 不存在或无效');
          console.error('2. medicineId 不存在或无效');
          console.error('3. 请求数据格式不正确');
          console.error('4. 用户权限不足');
        }
      }
    } else {
      console.error('错误详情:', error.message);
    }
    
    console.error('\n🔧 调试建议:');
    console.error('1. 确认后端服务在 http://localhost:4000 运行');
    console.error('2. 检查数据库连接是否正常');
    console.error('3. 验证用户登录状态和权限');
    console.error('4. 检查 clinicId 和 medicineId 是否有效');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testPrescriptionAPI()
    .then(() => {
      console.log('\n✅ 测试脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testPrescriptionAPI }; 