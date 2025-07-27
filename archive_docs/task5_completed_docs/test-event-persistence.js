const axios = require('axios');

const API_URL = 'http://localhost:4000/api/v1';

async function testEventPersistence() {
  try {
    // 1. 先登录获取token
    console.log('1. 登录测试用户...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'doctor@example.com',
      password: 'password123'
    });
    
    const { accessToken } = loginResponse.data.data;
    console.log('✅ 登录成功，获取到token');
    
    // 2. 创建一个订单来触发事件
    console.log('\n2. 创建订单...');
    const orderResponse = await axios.post(`${API_URL}/orders`, {
      clinicId: 'cm8jdsk5h0000sxaepk5h0dxv',
      patientInfo: {
        name: '测试患者',
        age: 30,
        gender: 'male'
      },
      items: [
        {
          medicineId: 'cmc1bzn21000pugr4luvxa52o',
          quantity: 10,
          dosageInstructions: '每日2次，每次5g'
        }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    console.log('✅ 订单创建成功:', orderResponse.data.data.platformOrderId);
    
    // 3. 等待一下让事件处理完成
    console.log('\n3. 等待事件处理...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. 查询事件统计
    console.log('\n4. 查询事件统计...');
    const statsResponse = await axios.get(`${API_URL}/health/orchestration/events/stats`);
    console.log('事件统计:', JSON.stringify(statsResponse.data, null, 2));
    
    // 5. 查询事件列表
    console.log('\n5. 查询事件列表...');
    const eventsResponse = await axios.get(`${API_URL}/health/orchestration/events`);
    console.log('事件数量:', eventsResponse.data.length);
    if (eventsResponse.data.length > 0) {
      console.log('第一个事件:', JSON.stringify(eventsResponse.data[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.response?.data || error.message);
  }
}

testEventPersistence(); 