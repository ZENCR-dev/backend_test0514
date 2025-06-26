const axios = require('axios');

const API_URL = 'http://localhost:4000/api/v1';

async function testPrescriptionAPI() {
  try {
    // 1. 登录获取token
    console.log('1. 登录测试用户...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'doctor@example.com',
      password: 'password123'
    });
    
    const { accessToken } = loginResponse.data.data;
    console.log('✅ 登录成功，获取到token');
    
    // 2. 获取用户信息，查看是否有clinicId
    console.log('\n2. 获取用户信息...');
    const userResponse = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    console.log('用户信息:', JSON.stringify(userResponse.data.data, null, 2));
    
    // 3. 获取诊所账户列表
    console.log('\n3. 获取诊所账户列表...');
    try {
      const clinicAccountsResponse = await axios.get(`${API_URL}/clinic-accounts`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      console.log('诊所账户:', JSON.stringify(clinicAccountsResponse.data, null, 2));
    } catch (error) {
      console.log('获取诊所账户失败:', error.response?.data || error.message);
    }
    
    // 4. 尝试创建处方
    console.log('\n4. 尝试创建处方...');
    const prescriptionData = {
      clinicId: 'cmc9svktq0001ugucdwn5u1ou', // 使用前端提供的ID
      patientInfo: {
        name: '测试患者',
        age: 30,
        gender: 'male',
        phone: '1234567890',
        symptoms: '测试症状',
        diagnosis: '测试诊断'
      },
      medicines: [
        {
          medicineId: 'cmc1bzjmg0000ugr4y037tf2i', // 当归
          quantity: 10,
          dosageInstructions: '水煎服，每次1剂，每日2次，温服',
          notes: '测试备注'
        }
      ],
      notes: '测试处方备注'
    };
    
    try {
      const createResponse = await axios.post(`${API_URL}/prescriptions`, prescriptionData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ 处方创建成功:', JSON.stringify(createResponse.data, null, 2));
    } catch (error) {
      console.error('❌ 处方创建失败:', error.response?.data || error.message);
      if (error.response?.status === 400) {
        console.log('请求数据:', JSON.stringify(prescriptionData, null, 2));
      }
    }
    
    // 5. 获取处方列表
    console.log('\n5. 获取处方列表...');
    try {
      const listResponse = await axios.get(`${API_URL}/prescriptions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      console.log('处方列表:', JSON.stringify(listResponse.data, null, 2));
    } catch (error) {
      console.error('获取处方列表失败:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

testPrescriptionAPI(); 