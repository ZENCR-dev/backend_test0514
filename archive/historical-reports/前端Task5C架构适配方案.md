# 前端Task5C架构适配方案

## 一、背景概述

后端小组已决定回档关于Task5C的开发进度，并对Task 5C开发指南进行以下修订：
- 明确技术选型：使用NestJS原生EventEmitter2，不引入复杂的CQRS/Saga
- 提供完整的模块结构和初始化流程
- 明确事件定义和处理机制
- 完善幂等性和错误处理策略
- 强化测试优先原则

前端需要针对这些变更进行相应的架构和模块调整，确保与后端的事件驱动机制兼容并保持一致。

## 二、当前前端架构分析

### 1. 现有实现

前端目前已实现了基于WebSocket的事件监听机制：
- `useOrchestrationStore.ts`: Zustand全局状态管理，存储事件和UI反馈
- `useOrchestrationEvents.ts`: WebSocket连接和事件处理Hook
- `GlobalBanner.tsx`: 全局事件通知UI组件

### 2. 存在问题

- WebSocket连接失败（ws://localhost:3001/ws/orchestration）
- 事件格式可能与后端新的EventEmitter2不兼容
- 缺乏明确的幂等性处理机制
- 测试策略需要调整以适应新的事件机制

## 三、前端适配方案

### 1. WebSocket连接配置调整

```typescript
// src/hooks/useOrchestrationEvents.ts
const connect = () => {
  // 修改为可配置的WebSocket地址
  const wsUrl = process.env.NEXT_PUBLIC_WS_ORCHESTRATION_URL || 'ws://localhost:3001/ws/events';
  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;
  // ... 其余代码不变
};
```

### 2. 事件格式适配

```typescript
// src/hooks/useOrchestrationEvents.ts
ws.onmessage = (e) => {
  try {
    // 适配NestJS EventEmitter2的事件格式
    const rawData = JSON.parse(e.data);
    // EventEmitter2格式通常为 { event: 'event.name', data: {...} }
    const event: OrchestratorEventPayload = {
      type: rawData.event,
      timestamp: rawData.data?.timestamp || new Date().toISOString(),
      data: rawData.data
    };
    handleEvent(event);
  } catch (err) {
    setUIFeedback('error', '事件解析失败');
  }
};
```

### 3. 错误处理与重连机制增强

```typescript
// src/hooks/useOrchestrationEvents.ts
// 添加指数退避重连
const maxReconnectAttempts = 5;
const reconnectAttemptRef = useRef(0);

const connect = () => {
  // ... 现有连接代码

  ws.onclose = () => {
    if (reconnectAttemptRef.current < maxReconnectAttempts) {
      // 指数退避算法
      const timeout = Math.min(3000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current += 1;
      reconnectTimer.current = setTimeout(connect, timeout);
      setUIFeedback('warning', `事件流断开，正在尝试第${reconnectAttemptRef.current}次重连...`);
    } else {
      setUIFeedback('error', '事件流连接失败，请刷新页面重试');
    }
  };

  ws.onopen = () => {
    // 连接成功后重置重连计数
    reconnectAttemptRef.current = 0;
  };
};
```

### 4. 幂等性处理

```typescript
// src/hooks/useOrchestrationEvents.ts
// 添加事件去重逻辑
const processedEventsRef = useRef(new Set<string>());

function handleEvent(event: OrchestratorEventPayload) {
  // 生成事件唯一标识
  const eventId = `${event.type}-${event.data?.id || ''}-${event.timestamp}`;
  
  // 检查是否处理过相同事件
  if (processedEventsRef.current.has(eventId)) {
    console.log('重复事件，已忽略', event);
    return;
  }
  
  // 记录已处理事件
  processedEventsRef.current.add(eventId);
  
  // 限制已处理事件集合大小
  if (processedEventsRef.current.size > 100) {
    const iterator = processedEventsRef.current.values();
    processedEventsRef.current.delete(iterator.next().value);
  }
  
  // 处理事件
  setEvent(event);
  const mapping = eventToStatusAndFeedback[event.type as OrchestratorEventType];
  if (mapping) {
    setStatus(mapping.status);
    setUIFeedback(mapping.feedback.type, mapping.feedback.message);
  }
}
```

### 5. 测试策略调整

```typescript
// src/hooks/useOrchestrationEvents.test.tsx
// 添加NestJS EventEmitter2格式的测试用例
it('handles NestJS EventEmitter2 format events', () => {
  renderHook(() => useOrchestrationEvents({ mock: true }));
  
  // 模拟NestJS EventEmitter2格式的事件
  const nestjsEvent = {
    event: 'payment.succeeded',
    data: {
      orderId: '123',
      timestamp: new Date().toISOString()
    }
  };
  
  // 模拟WebSocket消息
  act(() => {
    const mockMessageEvent = {
      data: JSON.stringify(nestjsEvent)
    };
    const handler = (window as any).WebSocket.mock.instances[0].onmessage;
    handler(mockMessageEvent);
  });
  
  expect(useOrchestrationStore.getState().status).toBe(PrescriptionStatus.PROCESSING);
  expect(useOrchestrationStore.getState().uiFeedback.message).toMatch('支付成功');
});
```

## 四、实施步骤

1. **配置调整**
   - 添加环境变量配置WebSocket地址
   - 更新Next.js环境配置文件

2. **代码修改**
   - 修改`useOrchestrationEvents.ts`以适配NestJS EventEmitter2
   - 增强错误处理与重连机制
   - 添加事件幂等性处理

3. **测试与修复**
   - 更新单元测试以覆盖新的事件格式
   - 添加幂等性和错误处理的测试用例
   - 确保E2E测试能正确模拟新的事件流程

4. **文档更新**
   - 更新前端开发文档，说明事件处理机制变更
   - 添加与后端的事件格式约定文档

## 五、与后端的协作要点

1. **事件格式统一**
   - 明确定义事件名称、数据结构和格式
   - 确保前后端使用相同的事件类型和字段名

2. **WebSocket端点确认**
   - 确认后端WebSocket服务的准确URL和路径
   - 确认认证机制（如需要）

3. **错误处理策略**
   - 同步前后端的错误码和错误处理机制
   - 确保异常情况下的用户体验一致

4. **测试协作**
   - 开发联合测试用例，确保端到端事件流转正常
   - 模拟各种异常场景，验证系统稳定性

## 六、风险与缓解措施

1. **WebSocket连接不稳定**
   - 风险：网络波动导致事件丢失
   - 缓解：实现指数退避重连、定期心跳检测、离线事件缓存

2. **事件重复处理**
   - 风险：同一事件多次触发UI更新
   - 缓解：实现事件去重机制，确保幂等性

3. **事件格式不兼容**
   - 风险：后端格式变更导致前端解析错误
   - 缓解：添加格式适配层，增强错误处理，定期同步前后端事件格式

## 七、进度计划

| 阶段 | 内容 | 时间估计 | 负责人 |
|------|------|----------|--------|
| 1. 需求分析与设计 | 分析后端变更，设计前端适配方案 | 1天 | 前端团队 |
| 2. 代码实现 | 修改WebSocket连接、事件处理、幂等性逻辑 | 2天 | 前端团队 |
| 3. 测试与修复 | 单元测试、集成测试、E2E测试 | 2天 | 前端团队 |
| 4. 联调与验证 | 与后端联调，验证事件流转 | 1天 | 前后端团队 |
| 5. 文档与交付 | 更新文档，提交代码，完成交付 | 1天 | 前端团队 |

## 八、结论

前端已准备好根据后端Task5C的修订进行相应调整，主要涉及WebSocket连接配置、事件格式适配、错误处理增强、幂等性处理和测试策略调整。我们将与后端团队紧密协作，确保事件驱动机制的顺利实现和系统的稳定运行。

请后端团队尽快确认WebSocket端点和事件格式，以便前端团队开始实施调整。 