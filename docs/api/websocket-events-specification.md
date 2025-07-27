# WebSocket事件规范文档

## 📋 文档概述

本文档定义了TCM处方平台WebSocket实时通知系统的标准事件格式和使用指南。基于Phase 1 API标准化原则，确保前后端事件通信的一致性。

**文档版本**：1.0  
**创建日期**：2025年1月9日  
**依赖**：Phase 1 API标准化、OrchestrationGateway  
**测试状态**：✅ 11个集成测试全部通过

## 🔌 WebSocket连接

### 连接端点
```
ws://localhost:4000/ws/orchestration
```

### 认证
WebSocket连接需要JWT认证：
```javascript
const socket = io('ws://localhost:4000/ws/orchestration', {
  auth: {
    token: 'your_jwt_token_here'
  }
});
```

## 📊 标准事件格式

### 基础事件结构
```typescript
interface StandardWebSocketEvent<T = any> {
  type: string;           // 事件类型，格式：domain.action.target
  data: T;               // 事件数据
  timestamp: string;     // ISO时间戳
  userId: string;        // 目标用户ID
  eventId: string;       // 唯一事件ID
  meta?: {               // 可选元数据
    source?: string;     // 事件源服务
    version?: string;    // 事件版本
    priority?: 'low' | 'normal' | 'high' | 'critical';
    retryCount?: number; // 重试次数
    [key: string]: any;
  };
}
```

### 事件优先级
- `low` - 低优先级，可延迟处理
- `normal` - 普通优先级，正常处理
- `high` - 高优先级，需要及时处理
- `critical` - 关键优先级，需要立即处理

## 🏥 支持的事件类型

### 1. 账户相关事件

#### account.balance.updated
账户余额更新事件

```typescript
{
  "type": "account.balance.updated",
  "data": {
    "practitionerId": "prac_123",
    "previousBalance": 1000.00,
    "newBalance": 1500.00,
    "changeAmount": 500.00,
    "changeType": "RECHARGE",
    "currency": "NZD",
    "reason": "Manual recharge",
    "transactionId": "txn_123"
  },
  "timestamp": "2025-01-09T10:00:00.000Z",
  "userId": "prac_123",
  "eventId": "evt_1704798000000_1_abc123",
  "meta": {
    "source": "practitioner-account-service",
    "priority": "high",
    "version": "1.0"
  }
}
```

#### account.status.changed
账户状态变化事件

```typescript
{
  "type": "account.status.changed",
  "data": {
    "practitionerId": "prac_123",
    "previousStatus": "ACTIVE",
    "newStatus": "SUSPENDED",
    "reason": "Compliance review"
  },
  // ... 其他标准字段
}
```

### 2. 支付相关事件

#### payment.status.updated
支付状态更新事件

```typescript
{
  "type": "payment.status.updated",
  "data": {
    "practitionerId": "prac_123",
    "paymentId": "pay_123",
    "previousStatus": "PENDING",
    "newStatus": "COMPLETED",
    "amount": 250.00,
    "currency": "NZD",
    "paymentMethod": "STRIPE",
    "paymentIntentId": "pi_123"
  },
  "timestamp": "2025-01-09T10:00:00.000Z",
  "userId": "prac_123",
  "eventId": "evt_1704798000000_2_def456",
  "meta": {
    "source": "payment-service",
    "priority": "normal",
    "version": "1.0"
  }
}
```

#### payment.failed
支付失败事件（高优先级）

```typescript
{
  "type": "payment.failed",
  "data": {
    "practitionerId": "prac_123",
    "paymentId": "pay_456",
    "amount": 150.00,
    "currency": "NZD",
    "failureReason": "Insufficient funds",
    "paymentMethod": "STRIPE"
  },
  // ... 其他标准字段
  "meta": {
    "priority": "high"
  }
}
```

### 3. 处方相关事件

#### prescription.status.changed
处方状态变化事件

```typescript
{
  "type": "prescription.status.changed",
  "data": {
    "practitionerId": "prac_123",
    "prescriptionId": "presc_123",
    "previousStatus": "DRAFT",
    "newStatus": "ISSUED",
    "patientId": "patient_456",
    "totalAmount": 180.00,
    "medicineCount": 5,
    "reason": "Patient consultation completed"
  },
  // ... 其他标准字段
}
```

#### prescription.created
新处方创建事件

```typescript
{
  "type": "prescription.created",
  "data": {
    "practitionerId": "prac_123",
    "prescriptionId": "presc_456",
    "patientId": "patient_789",
    "totalAmount": 220.00,
    "medicineCount": 3
  },
  // ... 其他标准字段
}
```

### 4. 系统相关事件

#### system.maintenance.scheduled
系统维护通知事件

```typescript
{
  "type": "system.maintenance.scheduled",
  "data": {
    "title": "Scheduled System Maintenance",
    "description": "Regular system updates and optimizations",
    "startTime": "2025-01-10T02:00:00Z",
    "endTime": "2025-01-10T04:00:00Z",
    "maintenanceType": "SCHEDULED",
    "impactLevel": "MEDIUM",
    "affectedServices": ["api", "websocket"]
  },
  "timestamp": "2025-01-09T10:00:00.000Z",
  "userId": "system_broadcast",
  "eventId": "evt_1704798000000_3_ghi789",
  "meta": {
    "source": "system-service",
    "priority": "high",
    "version": "1.0"
  }
}
```

#### user.session.expired
用户会话过期事件

```typescript
{
  "type": "user.session.expired",
  "data": {
    "sessionId": "sess_123",
    "expiredAt": "2025-01-09T10:00:00.000Z",
    "reason": "Token expired",
    "requireReauth": true,
    "gracePeriodSeconds": 300
  },
  // ... 其他标准字段
  "meta": {
    "priority": "high"
  }
}
```

## 🎯 前端集成指南

### 1. 基础连接设置

```typescript
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket;

  connect(token: string) {
    this.socket = io('ws://localhost:4000/ws/orchestration', {
      auth: { token }
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 连接状态事件
    this.socket.on('connection_status', (data) => {
      console.log('Connection status:', data);
    });

    // 标准化事件监听
    this.socket.on('account.balance.updated', this.handleBalanceUpdate);
    this.socket.on('payment.status.updated', this.handlePaymentUpdate);
    this.socket.on('prescription.status.changed', this.handlePrescriptionUpdate);
    this.socket.on('system.maintenance.scheduled', this.handleMaintenanceNotice);
    this.socket.on('user.session.expired', this.handleSessionExpiry);

    // 错误处理
    this.socket.on('websocket.error', this.handleError);
  }

  private handleBalanceUpdate = (event: any) => {
    // 更新UI中的余额显示
    console.log('Balance updated:', event);
    // 触发状态管理更新
  };

  private handlePaymentUpdate = (event: any) => {
    // 处理支付状态变化
    if (event.newStatus === 'FAILED') {
      // 显示支付失败通知
      this.showNotification('Payment failed: ' + event.failureReason, 'error');
    }
  };

  private handlePrescriptionUpdate = (event: any) => {
    // 更新处方状态
    console.log('Prescription updated:', event);
  };

  private handleMaintenanceNotice = (event: any) => {
    // 显示维护通知
    if (event.impactLevel === 'CRITICAL') {
      this.showCriticalNotification(event.title, event.description);
    }
  };

  private handleSessionExpiry = (event: any) => {
    // 处理会话过期
    if (event.requireReauth) {
      this.redirectToLogin();
    }
  };

  private handleError = (error: any) => {
    console.error('WebSocket error:', error);
  };
}
```

### 2. React Hook集成

```typescript
import { useEffect, useState } from 'react';
import { WebSocketService } from './websocket-service';

export const useWebSocket = (token: string) => {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocketService();
    ws.connect(token);

    ws.on('connection_status', (data) => {
      setConnected(data.connected);
    });

    // 监听所有事件
    ws.onAny((eventName, eventData) => {
      setEvents(prev => [...prev, { eventName, eventData, timestamp: Date.now() }]);
    });

    return () => {
      ws.disconnect();
    };
  }, [token]);

  return { connected, events };
};
```

### 3. 事件优先级处理

```typescript
const handleEventByPriority = (event: StandardWebSocketEvent) => {
  switch (event.meta?.priority) {
    case 'critical':
      // 立即显示模态对话框或全屏通知
      showCriticalAlert(event);
      break;
    case 'high':
      // 显示顶部通知栏
      showHighPriorityNotification(event);
      break;
    case 'normal':
      // 更新UI状态，可能显示小图标
      updateUIState(event);
      break;
    case 'low':
      // 静默更新，仅记录日志
      logEvent(event);
      break;
  }
};
```

## 🧪 测试指南

### 单元测试示例

```typescript
describe('WebSocket Event Handling', () => {
  it('should handle balance update events', () => {
    const event = {
      type: 'account.balance.updated',
      data: {
        practitionerId: 'prac_123',
        previousBalance: 1000,
        newBalance: 1500,
        changeAmount: 500,
        changeType: 'RECHARGE',
        currency: 'NZD'
      },
      timestamp: '2025-01-09T10:00:00.000Z',
      userId: 'prac_123',
      eventId: 'evt_test_123'
    };

    const handler = new BalanceUpdateHandler();
    handler.handle(event);

    expect(mockBalanceStore.getBalance()).toBe(1500);
  });
});
```

## 📋 错误处理

### 常见错误类型

1. **连接错误**
   - 认证失败：检查JWT token有效性
   - 网络断开：实现自动重连机制

2. **事件处理错误**
   - 数据格式错误：验证事件数据结构
   - 处理逻辑错误：检查事件处理器实现

3. **性能问题**
   - 事件积压：实现事件队列和批处理
   - 内存泄漏：及时清理事件监听器

### 错误恢复策略

```typescript
class WebSocketErrorRecovery {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  handleEventError(event: any, error: Error) {
    console.error(`Failed to handle event ${event.type}:`, error);
    // 发送错误报告到监控系统
    this.reportError(event, error);
  }
}
```

## 🔧 配置选项

### 客户端配置

```typescript
const wsConfig = {
  // 连接超时
  timeout: 20000,
  
  // 自动重连
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  
  // 传输方式
  transports: ['websocket', 'polling'],
  
  // 事件缓冲
  forceNew: false
};
```

---

**文档维护**: 后端开发团队  
**最后更新**: 2025年1月9日  
**下次更新**: Phase 2 Day 2完成后

本文档将随着WebSocket功能的扩展而持续更新。