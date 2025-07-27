# WebSocket API 规范文档

## 概述
本文档为前端团队提供业务编排服务（Task 5C）的 WebSocket 连接规范和事件定义。

## WebSocket 连接信息

### 连接端点
- **URL**: `ws://localhost:3001`  
- **路径**: `/ws/orchestration`
- **完整地址**: `ws://localhost:3001/ws/orchestration`

### 认证方式
WebSocket 连接需要通过 JWT Token 进行认证：

```javascript
// 前端连接示例 (Socket.io Client)
import io from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  path: '/ws/orchestration',
  auth: {
    token: localStorage.getItem('access_token') // JWT Token
  }
});
```

### 连接流程
1. 客户端携带 JWT Token 发起连接
2. 服务端验证 Token 有效性
3. 验证成功：建立连接，返回 `connection_status` 事件
4. 验证失败：返回 `error` 事件，断开连接

## 事件定义

### 1. 系统事件

#### connection_status（连接状态）
**方向**: 服务端 → 客户端  
**触发时机**: 连接成功建立后  
**数据格式**:
```json
{
  "connected": true,
  "userId": "user-123"
}
```

#### error（错误）
**方向**: 服务端 → 客户端  
**触发时机**: 认证失败或其他错误  
**数据格式**:
```json
{
  "message": "Authentication failed"
}
```

### 2. 业务事件

#### order.status.updated（订单状态更新）
**方向**: 服务端 → 客户端  
**触发时机**: 订单状态发生变化时  
**数据格式**:
```json
{
  "orderId": "order-123",
  "status": "PAID",  // 可选值: DRAFT, PAID, PAYMENT_FAILED, PROCESSING, READY_FOR_PICKUP, COMPLETED, CANCELLED
  "timestamp": "2025-06-24T10:15:30.123Z",
  "reason": "insufficient_funds"  // 仅在失败时包含
}
```

#### order.compensation（订单补偿）
**方向**: 服务端 → 客户端  
**触发时机**: 业务补偿机制触发时  
**数据格式**:
```json
{
  "orderId": "order-123",
  "originalEvent": "payment.succeeded",
  "error": "Failed to update order status",
  "timestamp": "2025-06-24T10:15:30.123Z"
}
```

## 错误处理

### 认证错误
- 错误消息: `"Authentication failed"`
- 处理建议: 刷新 Token 后重新连接

### 连接断开
- 前端应实现自动重连机制
- 建议使用指数退避算法：1s → 2s → 4s → 8s → 16s（最大16秒）

### 示例代码
```javascript
// 重连逻辑示例
socket.on('disconnect', () => {
  console.log('WebSocket disconnected');
  // Socket.io 会自动重连
});

socket.on('reconnect', (attemptNumber) => {
  console.log('WebSocket reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_error', (error) => {
  console.error('WebSocket reconnection error:', error.message);
});
```

## 健康检查

### HTTP 端点
- **URL**: `GET /health/orchestration`
- **响应格式**:
```json
{
  "websocket": true,
  "eventEmitter": true,
  "timestamp": "2025-06-24T10:15:30.123Z"
}
```

## 开发环境配置

### CORS 配置
开发环境已配置 CORS，允许来自 `http://localhost:3000` 的连接。如需修改，请在环境变量中设置：
```
CLIENT_URL=http://localhost:3000
```

### 调试建议
1. 使用 Chrome DevTools 的 Network 标签查看 WebSocket 连接
2. 监听所有事件以便调试：
```javascript
socket.onAny((eventName, ...args) => {
  console.log(`[WebSocket] Event: ${eventName}`, args);
});
```

## 注意事项

1. **Token 刷新**: JWT Token 过期后需要重新获取并重连
2. **事件去重**: 前端应处理可能的重复事件
3. **连接管理**: 页面切换时正确断开和重连
4. **性能考虑**: 避免在同一页面创建多个连接

## 联系方式

如有问题，请联系后端团队：
- 技术问题：在项目群组中 @后端开发
- 紧急问题：直接联系后端负责人

---

**文档版本**: 1.0.0  
**更新日期**: 2025-06-24  
**状态**: 待实现（预计1-2天内完成） 