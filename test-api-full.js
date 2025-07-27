#!/usr/bin/env node

const http = require('http');
const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api/v1`;

// 测试结果存储
const testResults = {
  success: [],
  failed: [],
  summary: {}
};

// 已知的测试用户凭证
const TEST_USERS = {
  admin: {
    email: 'admin@zencr.org',
    password: 'admin123'
  },
  doctor: {
    email: 'doctor@test.com', 
    password: 'doctor123'
  },
  pharmacy: {
    email: 'pharmacy@test.com',
    password: 'pharmacy123'
  }
};

let authTokens = {};

// HTTP请求辅助函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    
    const parsedUrl = new URL(requestUrl);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// 测试记录函数
function recordTest(name, url, status, error = null) {
  const result = {
    name,
    url,
    status,
    error,
    timestamp: new Date().toISOString()
  };

  if (status >= 200 && status < 400) {
    testResults.success.push(result);
    console.log(`✅ ${name}: ${status}`);
  } else {
    testResults.failed.push(result);
    console.log(`❌ ${name}: ${status} ${error || ''}`);
  }
}

// 认证测试
async function testAuthentication() {
  console.log('\n🔐 测试认证接口...');
  
  for (const [role, credentials] of Object.entries(TEST_USERS)) {
    try {
      const response = await makeRequest('/auth/login', {
        method: 'POST',
        body: credentials
      });
      
      recordTest(`Login ${role}`, '/auth/login', response.status);
      
      if (response.status === 200 && response.data.data && response.data.data.accessToken) {
        authTokens[role] = response.data.data.accessToken;
        console.log(`  🔑 ${role} token获取成功`);
      }
    } catch (error) {
      recordTest(`Login ${role}`, '/auth/login', 500, error.message);
    }
  }
}

// 全面API测试
async function runComprehensiveTests() {
  console.log('\n🧪 运行全面API测试...');
  
  // 所有API端点测试配置
  const apiTests = [
    // 系统健康检查
    { name: 'Health Check', url: '/health', auth: false },
    { name: 'Root Path', url: '', auth: false },
    
    // 公共药品API
    { name: 'Public Medicines List', url: '/public/medicines', auth: false },
    { name: 'Public Medicines Search', url: '/public/medicines?search=人参', auth: false },
    { name: 'Public Medicine Categories', url: '/public/medicines/categories', auth: false },
    { name: 'Popular Medicines', url: '/public/medicines/popular', auth: false },
    { name: 'Search Suggestions', url: '/public/medicines/search/suggestions?q=人', auth: false },
    
    // 认证药品API
    { name: 'Medicines List (Auth)', url: '/medicines', auth: 'doctor' },
    
    // 处方管理API
    { name: 'Prescriptions List', url: '/prescriptions', auth: 'doctor' },
    { name: 'Prescription Categories Summary', url: '/prescriptions/categories/summary', auth: 'doctor' },
    
    // 医师账户API
    { name: 'Practitioner Balance', url: '/practitioner-accounts/balance', auth: 'doctor' },
    { name: 'Practitioner Transactions', url: '/practitioner-accounts/transactions', auth: 'doctor' },
    
    // 药房API - 处方扫码
    { name: 'Pharmacy Pending Prescriptions', url: '/pharmacy/prescriptions/pending', auth: 'pharmacy' },
    
    // 药房API - 履约管理
    { name: 'Pharmacy Fulfillments', url: '/pharmacy/fulfillments', auth: 'pharmacy' },
    
    // 药房API - 采购订单
    { name: 'Pharmacy Purchase Orders', url: '/pharmacy/purchase-orders', auth: 'pharmacy' },
    { name: 'Pharmacy Withdrawable POs', url: '/pharmacy/purchase-orders/withdrawable', auth: 'pharmacy' },
    
    // 药房API - 价目表
    { name: 'Pharmacy Current Price List', url: '/pharmacy/price-lists/current', auth: 'pharmacy' },
    { name: 'Pharmacy Price List History', url: '/pharmacy/price-lists/history', auth: 'pharmacy' },
  ];

  for (const test of apiTests) {
    try {
      const headers = test.auth ? {
        'Authorization': `Bearer ${authTokens[test.auth]}`
      } : {};

      if (test.auth && !authTokens[test.auth]) {
        recordTest(test.name, test.url, 401, 'No auth token available');
        continue;
      }

      const response = await makeRequest(test.url, { headers });
      recordTest(test.name, test.url, response.status);
      
      // 记录额外信息
      if (response.status === 200 && response.data) {
        if (response.data.data && Array.isArray(response.data.data)) {
          console.log(`  📊 ${test.name}: 返回 ${response.data.data.length} 条数据`);
        } else if (response.data.data) {
          console.log(`  📊 ${test.name}: 返回数据对象`);
        }
      }
      
    } catch (error) {
      recordTest(test.name, test.url, 500, error.message);
    }
  }
}

// POST请求测试
async function testPostRequests() {
  console.log('\n📝 测试POST请求...');
  
  if (!authTokens.doctor) {
    console.log('⚠️ 医师token不可用，跳过POST测试');
    return;
  }

  // 测试处方创建
  try {
    const createPrescriptionData = {
      medicines: [
        {
          medicineId: 'cmcy7uq2f001ewhm0sak3a883', // 使用真实的药品ID
          weight: 15,
          notes: 'API测试药品'
        }
      ],
      copies: 7,
      notes: 'API测试处方'
    };

    const response = await makeRequest('/prescriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authTokens.doctor}`
      },
      body: createPrescriptionData
    });
    
    recordTest('Create Prescription', '/prescriptions', response.status);
    
    if (response.status === 201 && response.data.data) {
      console.log(`  📋 处方创建成功: ${response.data.data.id}`);
      global.testPrescriptionId = response.data.data.id;
    }
  } catch (error) {
    recordTest('Create Prescription', '/prescriptions', 500, error.message);
  }
}

// WebSocket测试
async function testWebSocket() {
  console.log('\n🔌 测试WebSocket连接...');
  
  return new Promise((resolve) => {
    if (!authTokens.doctor) {
      console.log('⚠️ 医师token不可用，跳过WebSocket测试');
      resolve();
      return;
    }

    const socket = io(`${BASE_URL}`, {
      path: '/ws/orchestration/',
      auth: {
        token: authTokens.doctor
      },
      transports: ['polling', 'websocket'],
      timeout: 5000,
      forceNew: true
    });

    let connected = false;
    let messageReceived = false;
    
    socket.on('connect', () => {
      connected = true;
      recordTest('WebSocket连接', 'ws://localhost:4000/ws/orchestration', 200);
      
      // 发送测试消息
      socket.emit('test', {
        type: 'test',
        data: { message: 'API测试消息' }
      });
      
      setTimeout(() => {
        if (!messageReceived) {
          console.log('  ⏱️ WebSocket连接正常，但未收到回复消息');
        }
        socket.disconnect();
      }, 2000);
    });

    socket.on('connection_status', (data) => {
      messageReceived = true;
      try {
        console.log(`  📨 收到连接状态事件: ${JSON.stringify(data)}`);
        recordTest('WebSocket消息接收', 'ws://localhost:4000/ws/orchestration', 200);
      } catch (e) {
        console.log(`  📨 收到连接状态事件: ${data}`);
        recordTest('WebSocket消息接收', 'ws://localhost:4000/ws/orchestration', 200);
      }
    });

    socket.on('error', (data) => {
      console.log(`  📨 收到错误事件: ${JSON.stringify(data)}`);
    });

    socket.on('test', (data) => {
      messageReceived = true;
      console.log(`  📨 收到测试消息回复: ${JSON.stringify(data)}`);
      recordTest('WebSocket消息接收', 'ws://localhost:4000/ws/orchestration', 200);
    });

    socket.on('connect_error', (error) => {
      recordTest('WebSocket连接', 'ws://localhost:4000/ws/orchestration', 500, error.message);
      resolve();
    });

    socket.on('disconnect', (reason) => {
      if (connected) {
        recordTest('WebSocket关闭', 'ws://localhost:4000/ws/orchestration', 200);
      }
      resolve();
    });

    // 超时处理
    setTimeout(() => {
      if (!connected) {
        recordTest('WebSocket连接', 'ws://localhost:4000/ws/orchestration', 408, 'Connection timeout');
        socket.disconnect();
      }
      resolve();
    }, 6000);
  });
}

// 生成详细测试报告
function generateDetailedReport() {
  console.log('\n📊 详细测试报告');
  console.log('='.repeat(80));
  
  const total = testResults.success.length + testResults.failed.length;
  const successRate = total > 0 ? (testResults.success.length / total * 100).toFixed(1) : 0;
  
  console.log(`总测试数: ${total}`);
  console.log(`成功: ${testResults.success.length} (${successRate}%)`);
  console.log(`失败: ${testResults.failed.length} (${(100-successRate).toFixed(1)}%)`);
  
  // 按类型分类成功的测试
  const successByType = {};
  testResults.success.forEach(result => {
    const type = result.name.includes('WebSocket') ? 'WebSocket' :
                 result.name.includes('Public') ? '公共API' :
                 result.name.includes('Pharmacy') ? '药房API' :
                 result.name.includes('Practitioner') ? '医师API' :
                 result.name.includes('Prescription') ? '处方API' :
                 result.name.includes('Health') || result.name.includes('Root') ? '系统API' :
                 result.name.includes('Login') ? '认证API' : '其他';
    
    if (!successByType[type]) successByType[type] = [];
    successByType[type].push(result);
  });

  console.log('\n✅ 成功的测试分类:');
  Object.entries(successByType).forEach(([type, tests]) => {
    console.log(`  ${type}: ${tests.length}个`);
  });

  if (testResults.failed.length > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.failed.forEach(result => {
      console.log(`  • ${result.name} (${result.status}): ${result.url}`);
      if (result.error) {
        console.log(`    错误: ${result.error}`);
      }
    });

    // 按状态码分类失败的测试
    const failuresByStatus = {};
    testResults.failed.forEach(result => {
      if (!failuresByStatus[result.status]) {
        failuresByStatus[result.status] = [];
      }
      failuresByStatus[result.status].push(result);
    });

    console.log('\n📊 按状态码分类的错误:');
    Object.entries(failuresByStatus).forEach(([status, failures]) => {
      console.log(`  ${status}: ${failures.length}个`);
      failures.forEach(failure => {
        console.log(`    - ${failure.name}: ${failure.url}`);
      });
    });
  }

  // 输出建议
  console.log('\n💡 测试分析:');
  if (successRate >= 90) {
    console.log('✅ 系统整体运行良好，API可用性优秀');
  } else if (successRate >= 70) {
    console.log('⚠️ 系统基本可用，但有一些API需要修复');
  } else {
    console.log('❌ 系统存在较多问题，需要重点关注API修复');
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始全面API接口和WebSocket可用性测试');
  console.log(`🎯 测试目标: ${BASE_URL}`);
  console.log(`📡 API基础路径: ${API_BASE}`);
  
  try {
    await testAuthentication();
    await runComprehensiveTests();
    await testPostRequests();
    await testWebSocket();
    
    generateDetailedReport();
    
    // 退出码表示测试结果
    process.exit(testResults.failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ 测试运行出错:', error);
    process.exit(1);
  }
}

// 启动测试
runTests();