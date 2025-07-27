const { io } = require('socket.io-client');

// WebSocket连接测试脚本
class WebSocketTester {
  constructor() {
    this.socket = null;
    this.testUsers = {
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
  }

  async loginUser(email, password) {
    try {
      const response = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ 登录成功:', result.data.user.email);
        return {
          token: result.data.accessToken,
          user: result.data.user,
        };
      } else {
        console.error('❌ 登录失败:', result.message);
        return null;
      }
    } catch (error) {
      console.error('❌ 登录请求失败:', error.message);
      return null;
    }
  }

  async testWebSocketConnection(token, userId) {
    return new Promise((resolve, reject) => {
      console.log('\n🔄 开始WebSocket连接测试...');
      console.log('Token:', token.substring(0, 20) + '...');
      console.log('User ID:', userId);

      const socket = io('http://localhost:4000', {
        path: '/ws/orchestration',
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: false,
        forceNew: true,
      });

      let testTimeout = setTimeout(() => {
        console.log('⏰ 连接超时');
        socket.disconnect();
        reject(new Error('Connection timeout'));
      }, 15000);

      socket.on('connect', () => {
        console.log('✅ WebSocket连接成功!');
        console.log('Socket ID:', socket.id);
        clearTimeout(testTimeout);
        
        // 测试心跳
        socket.emit('ping', { message: 'test ping' });
        
        setTimeout(() => {
          socket.disconnect();
          resolve(true);
        }, 2000);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket连接错误:', error.message);
        clearTimeout(testTimeout);
        reject(error);
      });

      socket.on('error', (error) => {
        console.error('❌ WebSocket认证错误:', error);
        clearTimeout(testTimeout);
        reject(new Error('Authentication failed'));
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 WebSocket断开连接:', reason);
        clearTimeout(testTimeout);
        resolve(false);
      });

      socket.on('CONNECTION_STATUS', (data) => {
        console.log('📡 收到连接状态事件:', data);
      });

      this.socket = socket;
    });
  }

  async testAllUsers() {
    console.log('🧪 开始测试所有用户的WebSocket连接...\n');
    
    for (const [role, credentials] of Object.entries(this.testUsers)) {
      console.log(`\n=== 测试 ${role.toUpperCase()} 用户 ===`);
      
      try {
        // 1. 登录获取token
        const authResult = await this.loginUser(credentials.email, credentials.password);
        
        if (!authResult) {
          console.log(`❌ ${role} 用户登录失败，跳过WebSocket测试`);
          continue;
        }

        // 2. 测试WebSocket连接
        const connectionResult = await this.testWebSocketConnection(
          authResult.token,
          authResult.user.id
        );

        if (connectionResult) {
          console.log(`✅ ${role} 用户WebSocket连接测试成功`);
        } else {
          console.log(`❌ ${role} 用户WebSocket连接测试失败`);
        }

      } catch (error) {
        console.error(`❌ ${role} 用户测试失败:`, error.message);
      }
    }
  }

  async testSpecificUser(email, password) {
    console.log(`\n🧪 测试用户: ${email}`);
    
    try {
      // 1. 登录
      const authResult = await this.loginUser(email, password);
      
      if (!authResult) {
        console.log('❌ 登录失败，无法测试WebSocket');
        return false;
      }

      // 2. 测试WebSocket
      const connectionResult = await this.testWebSocketConnection(
        authResult.token,
        authResult.user.id
      );

      return connectionResult;
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      return false;
    }
  }

  async validateBackendStatus() {
    console.log('🔍 检查后端服务状态...');
    
    try {
      // 检查健康状态
      const healthResponse = await fetch('http://localhost:4000/api/v1/health');
      if (healthResponse.ok) {
        console.log('✅ 后端服务健康检查通过');
      } else {
        console.log('❌ 后端服务健康检查失败');
      }
    } catch (error) {
      console.error('❌ 无法连接到后端服务:', error.message);
      console.log('请确保后端服务运行在 http://localhost:4000');
      return false;
    }

    return true;
  }
}

// 运行测试
async function runTests() {
  const tester = new WebSocketTester();
  
  console.log('🚀 WebSocket连接测试开始...\n');
  
  // 1. 检查后端状态
  const backendOk = await tester.validateBackendStatus();
  if (!backendOk) {
    console.log('❌ 后端服务不可用，终止测试');
    process.exit(1);
  }

  // 2. 测试所有用户
  await tester.testAllUsers();

  console.log('\n📊 测试完成！');
  console.log('\n📋 修复建议:');
  console.log('1. 确保前端正确设置 auth.token');
  console.log('2. 检查JWT token是否有效且未过期');
  console.log('3. 确认用户状态为 approved');
  console.log('4. 避免重复连接同一用户');
  console.log('5. 正确处理认证错误，不要无限重试');
  
  process.exit(0);
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch((error) => {
    console.error('💥 测试脚本运行失败:', error);
    process.exit(1);
  });
}

module.exports = WebSocketTester;