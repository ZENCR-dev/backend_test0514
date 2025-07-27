const { io } = require('socket.io-client');
const fetch = require('node-fetch');

// 前端WebSocket调试工具
class FrontendWebSocketDebugger {
  constructor() {
    this.baseUrl = 'http://localhost:4000';
    this.testUsers = {
      admin: { email: 'admin@zencr.org', password: 'admin123' },
      doctor: { email: 'doctor@test.com', password: 'doctor123' },
      pharmacy: { email: 'pharmacy@test.com', password: 'pharmacy123' }
    };
  }

  // 登录并获取token
  async login(email, password) {
    try {
      console.log(`🔐 登录用户: ${email}`);
      
      const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ 登录成功');
        console.log('📋 用户信息:', result.data.user);
        console.log('🎫 Token (前20字符):', result.data.accessToken.substring(0, 20) + '...');
        
        // 解析token payload
        try {
          const payload = JSON.parse(Buffer.from(result.data.accessToken.split('.')[1], 'base64').toString());
          console.log('📦 Token载荷:', {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
            过期时间: new Date(payload.exp * 1000).toLocaleString(),
            是否过期: payload.exp * 1000 < Date.now()
          });
        } catch (error) {
          console.error('❌ Token解析失败:', error.message);
        }
        
        return result.data;
      } else {
        console.error('❌ 登录失败:', result.message);
        return null;
      }
    } catch (error) {
      console.error('❌ 登录请求失败:', error.message);
      return null;
    }
  }

  // 测试WebSocket连接
  async testWebSocketWithToken(token, userId, email) {
    return new Promise((resolve) => {
      console.log(`\n🔌 测试WebSocket连接 - 用户: ${email}`);
      console.log('🎫 使用Token:', token.substring(0, 30) + '...');
      
      // 创建WebSocket连接
      const socket = io(this.baseUrl, {
        path: '/ws/orchestration',
        auth: {
          token: token  // 关键：正确传递token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: false,
        forceNew: true,
      });

      let result = {
        connected: false,
        authenticated: false,
        error: null,
        events: []
      };

      // 设置10秒超时
      const timeout = setTimeout(() => {
        console.log('⏰ 连接测试超时');
        socket.disconnect();
        resolve(result);
      }, 10000);

      // 连接成功
      socket.on('connect', () => {
        console.log('✅ WebSocket连接成功');
        console.log('🆔 Socket ID:', socket.id);
        result.connected = true;
        result.events.push('connected');
      });

      // 连接错误
      socket.on('connect_error', (error) => {
        console.error('❌ 连接错误:', error.message);
        result.error = error.message;
        result.events.push(`connect_error: ${error.message}`);
        clearTimeout(timeout);
        resolve(result);
      });

      // 认证错误
      socket.on('error', (error) => {
        console.error('❌ 认证错误:', error);
        result.error = error;
        result.events.push(`auth_error: ${error}`);
        clearTimeout(timeout);
        resolve(result);
      });

      // 连接状态事件
      socket.on('connection_status', (data) => {
        console.log('📡 收到连接状态事件:', data);
        result.authenticated = true;
        result.events.push('connection_status received');
        
        // 认证成功，2秒后断开连接
        setTimeout(() => {
          console.log('✅ 认证成功，断开连接');
          socket.disconnect();
          clearTimeout(timeout);
          resolve(result);
        }, 2000);
      });

      // 断开连接
      socket.on('disconnect', (reason) => {
        console.log('🔌 WebSocket断开:', reason);
        result.events.push(`disconnected: ${reason}`);
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }

  // 生成前端代码示例
  generateFrontendCode(authData) {
    const { accessToken, user } = authData;
    
    return `
// 🔧 前端WebSocket连接代码示例
// 基于测试成功的配置生成

import { io } from 'socket.io-client';

// 1. 获取认证信息
const authToken = '${accessToken.substring(0, 20)}...'; // 你的JWT token
const userId = '${user.id}';

// 2. 创建WebSocket连接
const socket = io('http://localhost:4000', {
  path: '/ws/orchestration',
  auth: {
    token: authToken  // 🔑 关键：正确设置token
  },
  transports: ['websocket', 'polling'],
  timeout: 10000,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  forceNew: true,
});

// 3. 事件监听
socket.on('connect', () => {
  console.log('✅ WebSocket连接成功:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ 连接错误:', error.message);
});

socket.on('error', (error) => {
  console.error('❌ 认证失败:', error);
  // 认证失败，跳转到登录页面
  window.location.href = '/login';
});

socket.on('connection_status', (data) => {
  console.log('📡 连接状态:', data);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 断开连接:', reason);
});

// 4. React Hook示例
export const useOrchestrationEvents = (token, userId) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token || !userId) return;

    const newSocket = io('http://localhost:4000', {
      path: '/ws/orchestration',
      auth: { token },
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('error', (err) => {
      setError(err);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [token, userId]);

  return { socket, isConnected, error };
};

// 5. 用户信息
// 用户ID: ${user.id}
// 用户邮箱: ${user.email}
// 用户角色: ${user.role}
// Token过期时间: 请检查token的exp字段
`;
  }

  // 运行完整调试
  async runDebugSession() {
    console.log('🚀 前端WebSocket调试会话开始\n');
    
    for (const [role, credentials] of Object.entries(this.testUsers)) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🧪 测试 ${role.toUpperCase()} 用户`);
      console.log(`${'='.repeat(50)}`);
      
      try {
        // 1. 登录
        const authData = await this.login(credentials.email, credentials.password);
        if (!authData) {
          console.log(`❌ ${role} 用户登录失败，跳过WebSocket测试\n`);
          continue;
        }

        // 2. 测试WebSocket
        const wsResult = await this.testWebSocketWithToken(
          authData.accessToken, 
          authData.user.id, 
          authData.user.email
        );

        // 3. 输出结果
        console.log('\n📊 测试结果:');
        console.log('  连接成功:', wsResult.connected ? '✅' : '❌');
        console.log('  认证成功:', wsResult.authenticated ? '✅' : '❌');
        if (wsResult.error) {
          console.log('  错误信息:', wsResult.error);
        }
        console.log('  事件序列:', wsResult.events.join(' → '));

        // 4. 如果成功，生成前端代码
        if (wsResult.connected && wsResult.authenticated) {
          console.log('\n🎉 测试成功！生成前端代码示例:');
          console.log(this.generateFrontendCode(authData));
        }

      } catch (error) {
        console.error(`❌ ${role} 用户测试失败:`, error.message);
      }
    }

    console.log('\n📋 调试总结:');
    console.log('1. 确保前端正确设置 auth: { token: yourToken }');
    console.log('2. 检查token是否有效且未过期');
    console.log('3. 处理认证错误，避免无限重试');
    console.log('4. 使用上面的成功配置作为参考');
    console.log('\n🔧 如需更多帮助，请联系后端团队');
  }
}

// 运行调试
async function runFrontendDebug() {
  const wsDebugger = new FrontendWebSocketDebugger();
  await wsDebugger.runDebugSession();
  process.exit(0);
}

if (require.main === module) {
  runFrontendDebug().catch((error) => {
    console.error('💥 调试失败:', error);
    process.exit(1);
  });
}

module.exports = FrontendWebSocketDebugger;