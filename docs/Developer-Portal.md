# 🚀 MVP 2.0 开发者门户

**版本**: v2.0  
**最后更新**: 2025年1月9日  
**状态**: Phase 2 完成，生产就绪

---

## 📋 快速导航

### 🎯 核心功能
- [API响应格式标准化](#api响应格式标准化)
- [实时WebSocket通知](#实时websocket通知)
- [性能监控仪表板](#性能监控仪表板)
- [公共药品API](#公共药品api)

### 📚 开发指南
- [前端集成指南](#前端集成指南)
- [API文档](#api文档)
- [WebSocket事件规范](#websocket事件规范)
- [性能优化建议](#性能优化建议)

### 🔧 技术参考
- [认证和授权](#认证和授权)
- [错误处理](#错误处理)
- [测试指南](#测试指南)
- [部署说明](#部署说明)

---

## 🎯 API响应格式标准化

### 统一响应格式
所有API端点都遵循以下标准格式：

```json
{
  "success": true,
  "data": {
    // 具体业务数据
  },
  "message": "操作成功信息",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "api-source",
    "version": "v1.2"
  }
}
```

### 错误响应格式
```json
{
  "success": false,
  "data": null,
  "message": "具体错误信息",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "api-source",
    "error": "ErrorType"
  }
}
```

---

## 🔌 实时WebSocket通知

### 连接地址
```javascript
const socket = new WebSocket('ws://localhost:4000');
```

### 标准事件格式
```typescript
interface StandardWebSocketEvent<T = any> {
  type: 'system' | 'account' | 'payment' | 'prescription' | 'order' | 'medicine' | 'notification';
  data: T;
  timestamp: string;
  eventId: string;
  userId?: string;
  meta: {
    priority: 'low' | 'normal' | 'high' | 'critical';
    source?: string;
  };
}
```

### 事件监听示例
```javascript
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'system':
      handleSystemEvent(data);
      break;
    case 'account':
      handleAccountEvent(data);
      break;
    case 'payment':
      handlePaymentEvent(data);
      break;
    case 'prescription':
      handlePrescriptionEvent(data);
      break;
    // ... 其他事件类型
  }
};
```

### 支持的事件类型

#### 系统事件 (system)
- `performance_stats_update` - 性能统计更新
- `performance_alert` - 性能警告
- `maintenance_notification` - 系统维护通知

#### 账户事件 (account)
- `balance_updated` - 余额更新
- `recharge_completed` - 充值完成
- `account_locked` - 账户锁定

#### 支付事件 (payment)
- `payment_succeeded` - 支付成功
- `payment_failed` - 支付失败
- `refund_processed` - 退款处理

#### 处方事件 (prescription)
- `prescription_created` - 处方创建
- `prescription_paid` - 处方支付
- `prescription_dispensed` - 处方配药

---

## 📊 性能监控仪表板

### 访问地址
- **HTML仪表板**: `http://localhost:4000/dashboard/performance`
- **API数据**: `GET /dashboard/performance/api`

### 实时性能数据
```javascript
// 获取性能数据
fetch('/dashboard/performance/api')
  .then(res => res.json())
  .then(data => {
    const stats = data.data.currentStats;
    console.log('系统健康状态:', stats.systemHealth);
    console.log('平均响应时间:', stats.averageResponseTime);
    console.log('错误率:', stats.errorRate);
  });
```

### WebSocket性能通知
```javascript
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // 性能统计更新
  if (data.type === 'system' && data.data.eventType === 'performance_stats_update') {
    updatePerformanceDashboard(data.data.stats);
  }
  
  // 性能警告
  if (data.type === 'system' && data.data.alertType === 'performance') {
    showPerformanceAlert(data.data);
  }
};
```

---

## 💊 公共药品API

### 无需认证访问
所有公共药品API都无需认证，可直接访问。

### 1. 药品搜索
```http
GET /public/medicines?search=阿司匹林&page=1&limit=20
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "medicines": [
      {
        "id": "med-001",
        "name": "阿司匹林",
        "englishName": "Aspirin",
        "chineseName": "阿司匹林",
        "sku": "ASP001",
        "category": "解热镇痛药",
        "description": "用于解热镇痛，预防心血管疾病"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### 2. 药品分类
```http
GET /public/medicines/categories
```

### 3. 热门药品
```http
GET /public/medicines/popular?limit=10
```

### 4. 搜索建议
```http
GET /public/medicines/search/suggestions?q=阿&limit=5
```

---

## 🔧 前端集成指南

### React集成示例

#### 药品搜索Hook
```javascript
import { useState, useEffect } from 'react';

const useMedicineSearch = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState(null);

  const searchMedicines = async (params) => {
    setLoading(true);
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/public/medicines?${queryString}`);
      const data = await response.json();
      
      if (data.success) {
        setMedicines(data.data.medicines);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return { medicines, loading, pagination, searchMedicines };
};
```

#### WebSocket连接Hook
```javascript
import { useState, useEffect } from 'react';

const useWebSocket = (url = 'ws://localhost:4000') => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      setIsConnected(true);
      setSocket(ws);
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      setSocket(null);
    };
    
    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = (message) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
    }
  };

  return { socket, isConnected, sendMessage };
};
```

#### 性能监控组件
```javascript
import React, { useState, useEffect } from 'react';

const PerformanceMonitor = () => {
  const [stats, setStats] = useState(null);
  const { socket } = useWebSocket();

  useEffect(() => {
    // 获取初始数据
    fetch('/dashboard/performance/api')
      .then(res => res.json())
      .then(data => setStats(data.data.currentStats));
  }, []);

  useEffect(() => {
    if (socket) {
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'system' && data.data.eventType === 'performance_stats_update') {
          setStats(data.data.stats);
        }
      };
    }
  }, [socket]);

  if (!stats) return <div>加载中...</div>;

  return (
    <div className="performance-monitor">
      <h3>系统性能</h3>
      <div className={`health-status ${stats.systemHealth}`}>
        状态: {stats.systemHealth}
      </div>
      <div>平均响应时间: {stats.averageResponseTime.toFixed(1)}ms</div>
      <div>错误率: {stats.errorRate.toFixed(2)}%</div>
    </div>
  );
};
```

### Vue集成示例

#### Composition API
```javascript
import { ref, reactive, onMounted } from 'vue';

export function useMedicineSearch() {
  const medicines = ref([]);
  const loading = ref(false);
  const pagination = reactive({});

  const searchMedicines = async (params) => {
    loading.value = true;
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/public/medicines?${queryString}`);
      const data = await response.json();
      
      if (data.success) {
        medicines.value = data.data.medicines;
        Object.assign(pagination, data.data.pagination);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      loading.value = false;
    }
  };

  return { medicines, loading, pagination, searchMedicines };
}

export function useWebSocket(url = 'ws://localhost:4000') {
  const socket = ref(null);
  const isConnected = ref(false);

  onMounted(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      isConnected.value = true;
      socket.value = ws;
    };
    
    ws.onclose = () => {
      isConnected.value = false;
      socket.value = null;
    };
  });

  return { socket, isConnected };
}
```

---

## 📚 API文档

### 认证API
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/refresh` - 刷新令牌
- `GET /api/v1/auth/me` - 获取当前用户信息

### 药品API
- `GET /api/v1/medicines` - 获取药品列表 (需认证)
- `GET /api/v1/medicines/:id` - 获取药品详情 (需认证)
- `GET /public/medicines` - 公共药品搜索 (无需认证)
- `GET /public/medicines/categories` - 药品分类 (无需认证)
- `GET /public/medicines/popular` - 热门药品 (无需认证)
- `GET /public/medicines/search/suggestions` - 搜索建议 (无需认证)

### 处方API
- `POST /api/v1/prescriptions` - 创建处方
- `GET /api/v1/prescriptions` - 获取处方列表
- `GET /api/v1/prescriptions/:id` - 获取处方详情
- `PUT /api/v1/prescriptions/:id` - 更新处方
- `POST /api/v1/prescriptions/:id/issue` - 开具处方

### 订单API
- `POST /api/v1/orders` - 创建订单
- `GET /api/v1/orders` - 获取订单列表
- `GET /api/v1/orders/:id` - 获取订单详情
- `PUT /api/v1/orders/:id/status` - 更新订单状态

### 支付API
- `POST /api/v1/payments/intent` - 创建支付意图
- `GET /api/v1/payments/:id` - 获取支付详情
- `POST /api/v1/payments/:id/confirm` - 确认支付

### 账户API
- `GET /api/v1/accounts/balance` - 获取账户余额
- `POST /api/v1/accounts/recharge` - 账户充值
- `GET /api/v1/accounts/transactions` - 交易历史

### 监控API
- `GET /dashboard/performance` - 性能监控仪表板 (HTML)
- `GET /dashboard/performance/api` - 性能数据 (JSON)

---

## 🔒 认证和授权

### JWT令牌
```javascript
// 请求头设置
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### 角色权限
- **admin**: 系统管理员，全部权限
- **doctor**: 医师，处方相关权限
- **pharmacy_operator**: 药房操作员，订单处理权限
- **patient**: 患者，个人信息权限

---

## ⚠️ 错误处理

### HTTP状态码
- `200` - 成功
- `400` - 请求参数错误
- `401` - 未认证
- `403` - 权限不足
- `404` - 资源不存在
- `409` - 资源冲突
- `429` - 请求频率过高
- `500` - 服务器内部错误

### 错误响应示例
```json
{
  "success": false,
  "data": null,
  "message": "用户名或密码错误",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "auth-service",
    "error": "INVALID_CREDENTIALS"
  }
}
```

---

## 🚀 性能优化建议

### 前端优化
1. **缓存策略**: 实现5分钟TTL缓存
2. **防抖技术**: 搜索输入使用300ms防抖
3. **分页加载**: 使用虚拟滚动或无限滚动
4. **WebSocket重连**: 实现自动重连机制

### 网络优化
1. **请求合并**: 批量API请求
2. **数据压缩**: 启用gzip压缩
3. **CDN加速**: 静态资源使用CDN
4. **HTTP/2**: 启用HTTP/2支持

---

## 🧪 测试指南

### 单元测试
```javascript
// Jest测试示例
describe('MedicineSearch', () => {
  it('should search medicines successfully', async () => {
    const result = await searchMedicines({ search: '阿司匹林' });
    expect(result.success).toBe(true);
    expect(result.data.medicines).toHaveLength(1);
  });
});
```

### 集成测试
```javascript
// API集成测试
describe('Public Medicines API', () => {
  it('should return medicines without authentication', async () => {
    const response = await fetch('/public/medicines');
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

---

## 🚀 部署说明

### 环境变量
```bash
# 数据库
DATABASE_URL="postgresql://..."

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"

# WebSocket
WEBSOCKET_PORT=4000

# 性能监控
PERFORMANCE_MONITORING_ENABLED=true
```

### Docker部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "run", "start:prod"]
```

---

## 📞 技术支持

### 开发团队联系
- **后端团队**: 负责API开发和维护
- **前端团队**: 负责界面开发和集成
- **DevOps团队**: 负责部署和运维

### 问题反馈
1. **Bug报告**: 通过GitHub Issues提交
2. **功能请求**: 通过产品需求流程提交
3. **技术咨询**: 联系对应技术团队

---

## 📈 版本历史

### v2.0 (2025-01-09) - Phase 2 完成
- ✅ API响应格式标准化
- ✅ 实时WebSocket通知系统
- ✅ 性能监控仪表板
- ✅ 公共药品API

### v1.0 (2024-12-XX) - MVP 1.0
- ✅ 基础认证系统
- ✅ 药品管理
- ✅ 处方管理
- ✅ 订单管理
- ✅ 支付系统

---

**文档维护**: 本文档随系统更新持续维护  
**最后更新**: 2025年1月9日  
**下次更新**: Phase 3 开发完成后