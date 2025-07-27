#!/usr/bin/env node

const http = require('http');
const https = require('https');
const WebSocket = require('ws');

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
      
      if (response.status === 200 && response.data.data && (response.data.data.access_token || response.data.data.accessToken)) {
        authTokens[role] = response.data.data.access_token || response.data.data.accessToken;
        console.log(`  🔑 ${role} token获取成功`);
      }
    } catch (error) {
      recordTest(`Login ${role}`, '/auth/login', 500, error.message);
    }
  }
}

// 药品API测试
async function testMedicinesAPI() {
  console.log('\n💊 测试药品接口...');
  
  const medicineEndpoints = [
    { url: '/medicines', auth: 'doctor' },
    { url: '/public/medicines', auth: false },
    { url: '/public/medicines?search=人参', auth: false },
    { url: '/public/medicines/categories', auth: false }
  ];

  for (const endpoint of medicineEndpoints) {
    try {
      const headers = endpoint.auth ? {
        'Authorization': `Bearer ${authTokens[endpoint.auth]}`
      } : {};

      const response = await makeRequest(endpoint.url, { headers });
      recordTest(`GET ${endpoint.url}`, endpoint.url, response.status);
    } catch (error) {
      recordTest(`GET ${endpoint.url}`, endpoint.url, 500, error.message);
    }
  }
}

// 处方API测试
async function testPrescriptionsAPI() {
  console.log('\n📋 测试处方接口...');
  
  if (!authTokens.doctor) {
    console.log('⚠️ 医师token不可用，跳过处方测试');
    return;
  }

  const prescriptionEndpoints = [
    { url: '/prescriptions', method: 'GET' },
    { url: '/prescriptions/categories/summary', method: 'GET' },
    // 创建测试处方
    { 
      url: '/prescriptions', 
      method: 'POST',
      body: {
        medicines: [
          {
            medicineId: 'med_001',
            weight: 15,
            notes: '测试药品'
          }
        ],
        copies: 7,
        notes: 'API测试处方'
      }
    }
  ];

  for (const endpoint of prescriptionEndpoints) {
    try {
      const response = await makeRequest(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${authTokens.doctor}`
        },
        body: endpoint.body
      });
      
      recordTest(`${endpoint.method} ${endpoint.url}`, endpoint.url, response.status);
      
      // 保存创建的处方ID用于后续测试
      if (endpoint.method === 'POST' && response.status === 201) {
        global.testPrescriptionId = response.data?.id;
      }
    } catch (error) {
      recordTest(`${endpoint.method} ${endpoint.url}`, endpoint.url, 500, error.message);
    }
  }
}

// 药房API测试
async function testPharmacyAPI() {
  console.log('\n🏥 测试药房接口...');
  
  if (!authTokens.pharmacy) {
    console.log('⚠️ 药房token不可用，跳过药房测试');
    return;
  }

  const pharmacyEndpoints = [
    { url: '/pharmacy/prescriptions/pending', method: 'GET' },
    { url: '/pharmacy/purchase-orders', method: 'GET' },
    { url: '/pharmacy/purchase-orders/withdrawable', method: 'GET' },
    { url: '/pharmacy/fulfillments', method: 'GET' },
    { url: '/pharmacy/price-lists/current', method: 'GET' },
    { url: '/pharmacy/price-lists/history', method: 'GET' }
  ];

  for (const endpoint of pharmacyEndpoints) {
    try {
      const response = await makeRequest(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${authTokens.pharmacy}`
        }
      });
      
      recordTest(`${endpoint.method} ${endpoint.url}`, endpoint.url, response.status);
    } catch (error) {
      recordTest(`${endpoint.method} ${endpoint.url}`, endpoint.url, 500, error.message);
    }
  }
}

// 医师账户API测试
async function testPractitionerAccountAPI() {
  console.log('\n👨‍⚕️ 测试医师账户接口...');
  
  if (!authTokens.doctor) {
    console.log('⚠️ 医师token不可用，跳过账户测试');
    return;
  }

  const accountEndpoints = [
    { url: '/practitioner-accounts/balance', method: 'GET' },
    { url: '/practitioner-accounts/transactions', method: 'GET' },
    { url: '/practitioner-accounts/transactions?page=1&limit=10', method: 'GET' }
  ];

  for (const endpoint of accountEndpoints) {
    try {
      const response = await makeRequest(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${authTokens.doctor}`
        }
      });
      
      recordTest(`${endpoint.method} ${endpoint.url}`, endpoint.url, response.status);
    } catch (error) {
      recordTest(`${endpoint.method} ${endpoint.url}`, endpoint.url, 500, error.message);
    }
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

    const ws = new WebSocket(`ws://localhost:4000/ws/orchestration?token=${authTokens.doctor}`);

    let connected = false;
    
    ws.on('open', () => {
      connected = true;
      recordTest('WebSocket连接', 'ws://localhost:4000/ws/orchestration', 200);
      
      // 发送测试消息
      ws.send(JSON.stringify({
        type: 'test',
        data: { message: 'API测试消息' }
      }));
      
      setTimeout(() => ws.close(), 2000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`  📨 收到WebSocket消息: ${message.type}`);
      } catch (e) {
        console.log(`  📨 收到WebSocket原始消息: ${data}`);
      }
    });

    ws.on('error', (error) => {
      recordTest('WebSocket连接', 'ws://localhost:4000/ws/orchestration', 500, error.message);
      resolve();
    });

    ws.on('close', () => {
      if (connected) {
        recordTest('WebSocket关闭', 'ws://localhost:4000/ws/orchestration', 200);
      }
      resolve();
    });

    // 超时处理
    setTimeout(() => {
      if (!connected) {
        recordTest('WebSocket连接', 'ws://localhost:4000/ws/orchestration', 408, 'Connection timeout');
        ws.terminate();
      }
      resolve();
    }, 5000);
  });
}

// 系统健康检查
async function testHealthCheck() {
  console.log('\n🏥 测试系统健康检查...');
  
  const healthEndpoints = [
    { url: `${API_BASE}/health`, name: 'Health Check' },
    { url: `${API_BASE}`, name: 'Root Path' },
    { url: `${BASE_URL}/api/docs`, name: 'Swagger文档' }
  ];

  for (const endpoint of healthEndpoints) {
    try {
      const response = await makeRequest(endpoint.url);
      recordTest(endpoint.name, endpoint.url, response.status);
    } catch (error) {
      recordTest(endpoint.name, endpoint.url, 500, error.message);
    }
  }
}

// 生成测试报告
function generateReport() {
  console.log('\n📊 测试报告');
  console.log('='.repeat(50));
  
  const total = testResults.success.length + testResults.failed.length;
  const successRate = total > 0 ? (testResults.success.length / total * 100).toFixed(1) : 0;
  
  console.log(`总测试数: ${total}`);
  console.log(`成功: ${testResults.success.length}`);
  console.log(`失败: ${testResults.failed.length}`);
  console.log(`成功率: ${successRate}%`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.failed.forEach(result => {
      console.log(`  • ${result.name} (${result.status}): ${result.url}`);
      if (result.error) {
        console.log(`    错误: ${result.error}`);
      }
    });
  }

  // 按状态码分类失败的测试
  const failuresByStatus = {};
  testResults.failed.forEach(result => {
    if (!failuresByStatus[result.status]) {
      failuresByStatus[result.status] = [];
    }
    failuresByStatus[result.status].push(result);
  });

  if (Object.keys(failuresByStatus).length > 0) {
    console.log('\n📊 按状态码分类的错误:');
    Object.entries(failuresByStatus).forEach(([status, failures]) => {
      console.log(`  ${status}: ${failures.length}个`);
      failures.forEach(failure => {
        console.log(`    - ${failure.name}: ${failure.url}`);
      });
    });
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始API接口和WebSocket可用性测试');
  console.log(`🎯 测试目标: ${BASE_URL}`);
  
  try {
    await testHealthCheck();
    await testAuthentication();
    await testMedicinesAPI();
    await testPrescriptionsAPI();
    await testPractitionerAccountAPI();
    await testPharmacyAPI();
    await testWebSocket();
    
    generateReport();
    
    // 退出码表示测试结果
    process.exit(testResults.failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ 测试运行出错:', error);
    process.exit(1);
  }
}

// 启动测试
runTests();