#!/usr/bin/env node

const { io } = require('socket.io-client');
const http = require('http');

const BASE_URL = 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api/v1`;

// 测试用户凭证
const TEST_USER = {
  email: 'doctor@test.com', 
  password: 'doctor123'
};

let authToken = null;

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

// 获取认证token
async function getAuthToken() {
  try {
    const response = await makeRequest('/auth/login', {
      method: 'POST',
      body: TEST_USER
    });
    
    if (response.status === 200 && response.data.data && response.data.data.accessToken) {
      authToken = response.data.data.accessToken;
      console.log('✅ 获取认证token成功');
      return true;
    } else {
      console.log('❌ 获取认证token失败:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ 获取认证token出错:', error.message);
    return false;
  }
}

// 测试Socket.IO WebSocket连接
async function testSocketIOConnection() {
  console.log('\n🔌 测试Socket.IO WebSocket连接...');
  
  return new Promise((resolve) => {
    if (!authToken) {
      console.log('❌ 没有认证token，无法测试WebSocket连接');
      resolve(false);
      return;
    }

    console.log('📡 连接到:', `${BASE_URL}/ws/orchestration`);
    console.log('🔑 使用token:', authToken.substring(0, 20) + '...');

    const socket = io(`${BASE_URL}`, {
      path: '/ws/orchestration/',
      auth: {
        token: authToken
      },
      transports: ['polling', 'websocket'],
      timeout: 10000,
      forceNew: true
    });

    let connected = false;
    let messageReceived = false;
    
    socket.on('connect', () => {
      connected = true;
      console.log('✅ WebSocket连接成功');
      console.log('📋 连接ID:', socket.id);
      
      // 发送测试消息
      socket.emit('test', {
        message: 'Socket.IO测试消息',
        timestamp: new Date().toISOString()
      });
      
      console.log('📤 已发送测试消息');
      
      setTimeout(() => {
        if (!messageReceived) {
          console.log('⏱️ WebSocket连接正常，但2秒内未收到特定回复消息');
        }
        socket.disconnect();
      }, 2000);
    });

    socket.on('connection_status', (data) => {
      messageReceived = true;
      console.log('📨 收到连接状态事件:', data);
    });

    socket.on('error', (data) => {
      console.log('📨 收到错误事件:', data);
    });

    socket.on('test', (data) => {
      messageReceived = true;
      console.log('📨 收到测试消息回复:', data);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ WebSocket连接错误:', error.message);
      console.log('🔍 错误详情:', error);
      resolve(false);
    });

    socket.on('disconnect', (reason) => {
      if (connected) {
        console.log('✅ WebSocket正常断开:', reason);
        resolve(true);
      } else {
        console.log('❌ WebSocket连接失败后断开:', reason);
        resolve(false);
      }
    });

    // 超时处理
    setTimeout(() => {
      if (!connected) {
        console.log('❌ WebSocket连接超时');
        socket.disconnect();
        resolve(false);
      }
    }, 6000);
  });
}

// 主测试函数
async function runWebSocketTest() {
  console.log('🚀 开始Socket.IO WebSocket连接测试');
  console.log(`🎯 测试目标: ${BASE_URL}`);
  
  try {
    // 首先获取认证token
    const authSuccess = await getAuthToken();
    if (!authSuccess) {
      console.log('❌ 无法获取认证token，测试终止');
      process.exit(1);
    }
    
    // 测试WebSocket连接
    const websocketSuccess = await testSocketIOConnection();
    
    console.log('\n📊 测试结果');
    console.log('='.repeat(50));
    
    if (websocketSuccess) {
      console.log('✅ Socket.IO WebSocket连接测试成功');
      process.exit(0);
    } else {
      console.log('❌ Socket.IO WebSocket连接测试失败');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 测试运行出错:', error);
    process.exit(1);
  }
}

// 启动测试
runWebSocketTest();