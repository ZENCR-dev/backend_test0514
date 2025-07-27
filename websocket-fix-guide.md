// WebSocket连接测试和修复方案

## 🔧 前端WebSocket连接修复方案

### 1. 正确的连接方式

```typescript
// useOrchestrationEvents.ts 修复版本
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseOrchestrationEventsProps {
  userId?: string;
  token?: string;
  enabled?: boolean;
}

export const useOrchestrationEvents = ({
  userId,
  token,
  enabled = true
}: UseOrchestrationEventsProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    if (!enabled || !token || !userId) {
      console.log('WebSocket not enabled or missing credentials');
      return;
    }

    // 避免重复连接
    if (socketRef.current?.connected) {
      return;
    }

    console.log('Initializing WebSocket connection...');

    // 创建连接
    const socket = io('http://localhost:4000', {
      path: '/ws/orchestration',
      auth: {
        token: token // 关键：正确设置token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5,
      forceNew: true, // 强制创建新连接
    });

    // 连接成功
    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
      setReconnectCount(0);
    });

    // 连接失败
    socket.on('connect_error', (error) => {
      console.error('WebSocket connection failed:', error);
      setIsConnected(false);
      setConnectionError(error.message);
      setReconnectCount(prev => prev + 1);
    });

    // 认证错误
    socket.on('error', (error) => {
      console.error('WebSocket authentication error:', error);
      setConnectionError('Authentication failed');
      // 认证失败不应该重试
      socket.disconnect();
    });

    // 断开连接
    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      
      // 如果是服务端主动断开且是认证失败，不要重连
      if (reason === 'io server disconnect' && connectionError?.includes('Authentication')) {
        console.log('Authentication failed, not reconnecting');
        return;
      }
    });

    socketRef.current = socket;

    return () => {
      console.log('Cleaning up WebSocket connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, userId, enabled]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    reconnectCount,
  };
};
```

### 2. 获取有效JWT Token

```typescript
// auth.service.ts - 前端认证服务
export const authService = {
  async login(email: string, password: string) {
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
        // 存储token
        localStorage.setItem('access_token', result.data.accessToken);
        localStorage.setItem('refresh_token', result.data.refreshToken);
        localStorage.setItem('user_id', result.data.user.id);
        
        return {
          success: true,
          token: result.data.accessToken,
          user: result.data.user,
        };
      } else {
        throw new Error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  getToken() {
    return localStorage.getItem('access_token');
  },

  getUserId() {
    return localStorage.getItem('user_id');
  },

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },
};
```

### 3. React组件中的使用

```typescript
// 在React组件中使用
import { useEffect, useState } from 'react';
import { useOrchestrationEvents } from './useOrchestrationEvents';
import { authService } from './auth.service';

export const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState<string | null>(null);

  // 获取认证信息
  useEffect(() => {
    const storedToken = authService.getToken();
    const userId = authService.getUserId();
    
    if (storedToken && userId && authService.isAuthenticated()) {
      setToken(storedToken);
      setUser({ id: userId });
    } else {
      // 重定向到登录页面
      window.location.href = '/login';
    }
  }, []);

  // 使用WebSocket
  const { socket, isConnected, connectionError } = useOrchestrationEvents({
    userId: user?.id,
    token,
    enabled: !!token && !!user,
  });

  return (
    <div>
      <div>
        WebSocket状态: {isConnected ? '已连接' : '未连接'}
        {connectionError && <div>错误: {connectionError}</div>}
      </div>
      {/* 其他组件内容 */}
    </div>
  );
};
```

### 4. 测试用户凭证

根据数据库恢复结果，可以使用以下测试账户：

```typescript
// 测试用户凭证
const testUsers = {
  admin: {
    email: 'admin@zencr.org',
    password: 'admin123', // 请使用实际密码
    role: 'admin'
  },
  doctor: {
    email: 'doctor@test.com',
    password: 'doctor123', // 请使用实际密码
    role: 'practitioner'
  },
  pharmacy: {
    email: 'pharmacy@test.com',
    password: 'pharmacy123', // 请使用实际密码
    role: 'pharmacy_operator'
  }
};
```

### 5. 调试方法

```typescript
// 调试WebSocket连接
const debugWebSocket = () => {
  const token = authService.getToken();
  
  if (!token) {
    console.error('No token available');
    return;
  }

  // 验证token格式
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token payload:', payload);
    console.log('Token expiry:', new Date(payload.exp * 1000));
    console.log('Is expired:', payload.exp * 1000 < Date.now());
  } catch (error) {
    console.error('Invalid token format:', error);
  }

  // 测试HTTP API
  fetch('http://localhost:4000/api/v1/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
    .then(response => response.json())
    .then(data => console.log('API test:', data))
    .catch(error => console.error('API test failed:', error));
};
```

## 🔍 常见问题排查

### 1. 检查后端服务状态
```bash
# 检查后端是否运行在正确端口
curl http://localhost:4000/api/v1/health

# 检查WebSocket端点
curl -I http://localhost:4000/ws/orchestration
```

### 2. 验证JWT配置
```bash
# 检查环境变量
echo $JWT_SECRET
echo $JWT_EXPIRES_IN
```

### 3. 数据库用户状态
```bash
# 检查用户状态
node check-database-detailed.js
```

## 🎯 关键修复点

1. **正确设置auth对象**: `auth: { token: yourJWTToken }`
2. **避免重复连接**: 检查现有连接状态
3. **处理认证错误**: 认证失败不应重试
4. **使用有效token**: 确保token未过期且用户状态为approved
5. **正确的错误处理**: 区分连接错误和认证错误

按照这个方案修复前端代码，WebSocket认证问题应该能够解决。