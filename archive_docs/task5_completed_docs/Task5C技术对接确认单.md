# Task5C技术对接确认单

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档版本 | V1.0 |
| 创建日期 | 2025-06-23 |
| 状态 | 已确认 |
| 参与方 | 前端团队、后端团队 |

## 一、技术对接关键点确认

### 1. WebSocket连接配置

| 配置项 | 前端方案 | 后端方案 | 最终确认 | 备注 |
|-------|---------|---------|---------|------|
| 连接路径 | `/ws/events` | `/ws/orchestration` | **`/ws/orchestration`** | 统一使用后端实现的路径 |
| 连接URL(开发环境) | `ws://localhost:3001/ws/events` | `ws://localhost:3001/ws/orchestration` | **`ws://localhost:3001/ws/orchestration`** | |
| 连接URL(测试环境) | `ws://test-api.tcm-platform.co.nz/ws/events` | `ws://test-api.tcm-platform.co.nz/ws/orchestration` | **`ws://test-api.tcm-platform.co.nz/ws/orchestration`** | |
| 连接URL(生产环境) | `wss://api.tcm-platform.co.nz/ws/events` | `wss://api.tcm-platform.co.nz/ws/orchestration` | **`wss://api.tcm-platform.co.nz/ws/orchestration`** | |
| WebSocket库 | 原生WebSocket | Socket.IO / NestJS WsAdapter | **Socket.IO客户端** | 前端需使用Socket.IO客户端以兼容NestJS WsAdapter |

### 2. 认证机制

| 配置项 | 前端方案 | 后端方案 | 最终确认 | 备注 |
|-------|---------|---------|---------|------|
| 认证方式 | 查询参数 / 握手消息 | 握手auth对象 | **握手auth对象** | 使用Socket.IO的auth对象传递token |
| Token传递 | `ws://localhost:3001/ws/events?token=JWT_TOKEN` 或 消息认证 | `client.handshake.auth.token` | **`client.handshake.auth.token`** | 前端需在连接时设置auth对象 |
| 认证失败处理 | 前端重新获取Token并重连 | 后端关闭连接 | **后端关闭连接，前端捕获错误并重新获取Token重连** | 前端需实现指数退避重连机制 |

### 3. 事件格式

| 配置项 | 前端方案 | 后端方案 | 最终确认 | 备注 |
|-------|---------|---------|---------|------|
| 事件基本格式 | `{event: "event.name", data: {...}}` | `{event: "event.name", data: {...}}` | **Socket.IO原生事件格式** | 使用Socket.IO的emit方法发送事件 |
| 事件命名规范 | `domain.action` (如`payment.succeeded`) | `domain.action` | **`domain.action`** | 统一使用领域驱动的命名规范 |
| 时间戳格式 | ISO8601 (`2025-06-23T10:00:00Z`) | ISO8601 | **ISO8601** | 所有时间戳使用ISO8601格式 |
| 唯一标识字段 | `id`, `timestamp` | `id`, `timestamp` | **`orderId`, `timestamp`** | 用于幂等性处理 |

### 4. 标准事件列表

| 事件名称 | 前端预期 | 后端实现 | 最终确认 | 数据字段 |
|---------|---------|---------|---------|---------|
| 支付成功 | `payment.succeeded` | `payment.succeeded` | **`payment.succeeded`** | `orderId`, `paymentIntentId`, `amount`, `currency`, `timestamp` |
| 支付失败 | `payment.failed` | `payment.failed` | **`payment.failed`** | `orderId`, `paymentIntentId`, `failureReason`, `timestamp` |
| 订单状态更新 | `order.status.updated` | `order.status.updated` | **`order.status.updated`** | `orderId`, `status`, `timestamp` |
| 补偿事件 | `order.compensation` | `order.compensation` | **`order.compensation`** | `orderId`, `originalEvent`, `error`, `timestamp` |
| 连接状态 | `connection_status` | `connection_status` | **`connection_status`** | `connected`, `userId` |
| 错误事件 | `error` | `error` | **`error`** | `message` |

### 5. 心跳机制

| 配置项 | 前端方案 | 后端方案 | 最终确认 | 备注 |
|-------|---------|---------|---------|------|
| 心跳间隔 | 30秒 | 60秒 | **30秒** | 前端发起ping，后端响应pong |
| 心跳格式 | `{type: "ping", timestamp: "..."}` | Socket.IO内置心跳 | **Socket.IO内置心跳** | 使用Socket.IO内置的心跳机制 |
| 超时处理 | 断开重连 | 服务端断开连接 | **断开后自动重连** | 前端实现指数退避重连策略 |

## 二、示例代码确认

### 前端连接代码（修订版）

```javascript
// 前端Socket.IO实现
import { io } from 'socket.io-client';

const connect = () => {
  const wsUrl = process.env.NEXT_PUBLIC_WS_ORCHESTRATION_URL || 'http://localhost:3001'; // 不带ws://前缀
  const socket = io(wsUrl, {
    path: '/ws/orchestration',
    auth: {
      token: getJWTToken() // 从存储中获取JWT token
    },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });
  
  socketRef.current = socket;
  
  socket.on('connect', () => {
    console.log('Orchestration WebSocket connected');
    setConnectionStatus('connected');
  });
  
  socket.on('disconnect', () => {
    console.log('Orchestration WebSocket disconnected');
    setConnectionStatus('disconnected');
  });
  
  socket.on('error', (error) => {
    console.error('Orchestration WebSocket error:', error);
    if (error.message === 'Authentication failed') {
      // 尝试刷新token并重连
      refreshTokenAndReconnect();
    }
  });
  
  // 监听业务事件
  socket.on('order.status.updated', (data) => {
    handleOrderStatusUpdated(data);
  });
  
  socket.on('payment.succeeded', (data) => {
    handlePaymentSucceeded(data);
  });
  
  socket.on('payment.failed', (data) => {
    handlePaymentFailed(data);
  });
  
  socket.on('order.compensation', (data) => {
    handleOrderCompensation(data);
  });
  
  socket.on('connection_status', (data) => {
    console.log('Connection status:', data);
    if (data.connected) {
      setConnectionStatus('authenticated');
    }
  });
  
  return socket;
};
```

### 后端连接代码（已实现）

```typescript
// 后端WebSocket网关实现
@WebSocketGateway({
  path: '/ws/orchestration',
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000' },
})
export class OrchestrationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrchestrationGateway.name);
  private readonly connectedClients = new Map<string, Socket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 从handshake auth中获取token
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('Missing authentication token');
      }

      // 验证JWT token
      const payload = this.jwtService.verify(token);
      const user = await this.authService.verifyPayload(payload);
      
      if (!user) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      // 存储client连接信息
      client.data.user = user;
      this.connectedClients.set(user.id, client);
      
      this.logger.log(`Client connected: ${user.id}`);
      client.emit('connection_status', { connected: true, userId: user.id });
      
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      this.connectedClients.delete(userId);
      this.logger.log(`Client disconnected: ${userId}`);
    }
  }

  // 广播事件到所有连接的客户端
  broadcastEvent(eventName: string, data: any) {
    this.server.emit(eventName, data);
    this.logger.debug(`Broadcasting event ${eventName}: ${JSON.stringify(data)}`);
  }

  // 发送事件到特定用户
  sendToUser(userId: string, eventName: string, data: any) {
    const client = this.connectedClients.get(userId);
    if (client) {
      client.emit(eventName, data);
      this.logger.debug(`Sent event ${eventName} to user ${userId}`);
    }
  }
  
  // 健康检查方法
  isHealthy(): boolean {
    return this.server && this.server.engine.clientsCount >= 0;
  }
}
```

## 三、已解决问题清单

1. **WebSocket路径不一致**
   - 解决方案：统一使用后端已实现的路径`/ws/orchestration`
   - 状态：**已解决**
   - 实施方：前端团队已调整连接路径

2. **认证机制不匹配**
   - 解决方案：前端调整为使用Socket.IO客户端，通过握手auth对象传递token
   - 状态：**已解决**
   - 实施方：前端团队已调整认证方式

3. **事件格式确认**
   - 解决方案：统一使用Socket.IO原生事件格式，后端已提供标准事件列表
   - 状态：**已解决**
   - 实施方：前后端已确认事件格式

4. **心跳机制确认**
   - 解决方案：使用Socket.IO内置的心跳机制，前端设置30秒间隔
   - 状态：**已解决**
   - 实施方：前后端已确认心跳机制

## 四、对接时间安排

| 时间 | 活动 | 参与人员 | 预期成果 |
|------|------|---------|---------|
| 2025-06-23 15:00 | 技术对接会议 | 前后端技术负责人 | 确认本文档所有待确认项 |
| 2025-06-23 16:00 | 代码调整 | 前后端开发人员 | 根据确认结果调整代码 |
| 2025-06-24 10:00 | 联调测试 | 前后端开发人员 | 验证WebSocket连接和事件流转 |
| 2025-06-24 14:00 | 集成验证 | 前后端开发人员 | 验证完整业务流程 |
| 2025-06-24 16:00 | 验收演示 | 前后端技术负责人、项目经理 | 演示Task5C功能完整性 |

## 五、确认签字

| 角色 | 姓名 | 确认签字 | 日期 |
|------|------|---------|------|
| 前端技术负责人 | | | 2025-06-23 |
| 后端技术负责人 | | | 2025-06-23 |
| 项目经理 | | | 2025-06-23 |

---

本文档作为Task5C前后端技术对接的正式确认依据，所有技术实现必须严格遵循最终确认的规范。如有变更，需重新确认并更新本文档。 