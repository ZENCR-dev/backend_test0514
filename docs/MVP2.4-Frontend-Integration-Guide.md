# MVP 2.4 前端团队集成指南

**文档版本**: 1.0  
**创建日期**: 2025年7月11日  
**适用团队**: 前端开发团队  
**后端状态**: MVP 2.3 基础设施就绪 (90%完成)

---

## 🚀 集成准备状态

### ✅ 可以立即开始集成的功能

1. **用户认证系统** - 100%就绪
2. **药房账户余额查询** - 100%就绪  
3. **可提现订单查询** - 100%就绪
4. **基础API框架** - 所有15个端点路由已注册

### ⚠️ 需要等待后端修复的功能

1. **处方查询API** - 参数验证问题，预计1天修复
2. **交易记录API** - 参数验证问题，预计1天修复
3. **价目表管理** - 缺少初始数据，预计2天完成
4. **履约凭证上传** - 文件上传功能，预计2天完成

---

## 🔐 认证集成指南

### 1. 药房用户登录

**端点**: `POST /api/v1/auth/login`  
**服务器**: `http://localhost:4000` (开发环境)

**请求示例**:
```javascript
const response = await fetch('http://localhost:4000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'pharmacy@test.com',
    password: 'Test123!'
  })
});

const result = await response.json();
const accessToken = result.data.accessToken;
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "user": {
      "id": "cmcylqlnj0005whhmiclu04qu",
      "email": "pharmacy@test.com",
      "name": "药店操作员",
      "role": "pharmacy_operator"
    }
  }
}
```

### 2. API认证头设置

所有pharmacy API调用都需要包含认证头：

```javascript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};
```

---

## 💰 已就绪的API端点

### 1. 账户余额查询 ✅

**端点**: `GET /api/v1/pharmacy/account/balance`

**使用示例**:
```javascript
const response = await fetch('http://localhost:4000/api/v1/pharmacy/account/balance', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  }
});

const balanceData = await response.json();
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "accountId": "cmcylqm2e0009whhm1mjzlk5s",
    "balance": 0,
    "currency": "NZD",
    "pendingAmount": 0,
    "availableForWithdrawal": 0,
    "status": "active"
  }
}
```

**前端实现建议**:
```jsx
// React Hook示例
const usePharmacyBalance = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await pharmacyAPI.getAccountBalance();
        setBalance(response.data);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBalance();
  }, []);
  
  return { balance, loading };
};
```

### 2. 可提现订单查询 ✅

**端点**: `GET /api/v1/pharmacy/purchase-orders/withdrawable`

**使用示例**:
```javascript
const response = await fetch('http://localhost:4000/api/v1/pharmacy/purchase-orders/withdrawable', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  }
});

const withdrawableOrders = await response.json();
```

---

## ⚠️ 暂时不可用的API端点

### 1. 交易记录查询 (修复中)

**端点**: `GET /api/v1/pharmacy/account/transactions`  
**问题**: 参数验证错误  
**预计修复**: 1天  

**目前错误**:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "BadRequestException"
}
```

### 2. 待履约处方查询 (修复中)

**端点**: `GET /api/v1/pharmacy/prescriptions/pending`  
**问题**: 参数验证错误  
**预计修复**: 1天

### 3. 采购订单列表 (修复中)

**端点**: `GET /api/v1/pharmacy/purchase-orders`  
**问题**: 参数验证错误  
**预计修复**: 1天

---

## 🏗️ 推荐的前端架构

### 1. API服务层

```javascript
// services/pharmacyAPI.js
class PharmacyAPI {
  constructor(baseURL = 'http://localhost:4000/api/v1') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('pharmacy_token');
  }
  
  setToken(token) {
    this.token = token;
    localStorage.setItem('pharmacy_token', token);
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // 已就绪的方法
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }
  
  async getAccountBalance() {
    return this.request('/pharmacy/account/balance');
  }
  
  async getWithdrawableOrders() {
    return this.request('/pharmacy/purchase-orders/withdrawable');
  }
  
  // 待修复的方法 (先实现，后端修复后立即可用)
  async getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/pharmacy/account/transactions?${query}`);
  }
  
  async getPendingPrescriptions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/pharmacy/prescriptions/pending?${query}`);
  }
}

export default new PharmacyAPI();
```

### 2. 状态管理 (Zustand示例)

```javascript
// stores/pharmacyStore.js
import { create } from 'zustand';
import pharmacyAPI from '../services/pharmacyAPI';

export const usePharmacyStore = create((set, get) => ({
  // 认证状态
  isAuthenticated: false,
  user: null,
  token: null,
  
  // 账户数据
  balance: null,
  withdrawableOrders: [],
  
  // 加载状态
  loading: {
    balance: false,
    orders: false,
    login: false
  },
  
  // 认证操作
  login: async (email, password) => {
    set((state) => ({
      loading: { ...state.loading, login: true }
    }));
    
    try {
      const response = await pharmacyAPI.login(email, password);
      const { accessToken, user } = response.data;
      
      pharmacyAPI.setToken(accessToken);
      
      set({
        isAuthenticated: true,
        user,
        token: accessToken,
        loading: { ...get().loading, login: false }
      });
      
      return { success: true };
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, login: false }
      }));
      return { success: false, error: error.message };
    }
  },
  
  logout: () => {
    localStorage.removeItem('pharmacy_token');
    set({
      isAuthenticated: false,
      user: null,
      token: null,
      balance: null,
      withdrawableOrders: []
    });
  },
  
  // 数据获取操作
  fetchBalance: async () => {
    set((state) => ({
      loading: { ...state.loading, balance: true }
    }));
    
    try {
      const response = await pharmacyAPI.getAccountBalance();
      set({
        balance: response.data,
        loading: { ...get().loading, balance: false }
      });
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      set((state) => ({
        loading: { ...state.loading, balance: false }
      }));
    }
  },
  
  fetchWithdrawableOrders: async () => {
    set((state) => ({
      loading: { ...state.loading, orders: true }
    }));
    
    try {
      const response = await pharmacyAPI.getWithdrawableOrders();
      set({
        withdrawableOrders: response.data || [],
        loading: { ...get().loading, orders: false }
      });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      set((state) => ({
        loading: { ...state.loading, orders: false }
      }));
    }
  }
}));
```

### 3. React组件示例

```jsx
// components/PharmacyDashboard.jsx
import React, { useEffect } from 'react';
import { usePharmacyStore } from '../stores/pharmacyStore';

const PharmacyDashboard = () => {
  const {
    balance,
    withdrawableOrders,
    loading,
    fetchBalance,
    fetchWithdrawableOrders
  } = usePharmacyStore();
  
  useEffect(() => {
    fetchBalance();
    fetchWithdrawableOrders();
  }, []);
  
  if (loading.balance) {
    return <div>加载余额中...</div>;
  }
  
  return (
    <div className="pharmacy-dashboard">
      <div className="balance-card">
        <h2>账户余额</h2>
        <div className="balance-amount">
          ${balance?.balance || 0} {balance?.currency || 'NZD'}
        </div>
        <div className="balance-details">
          <p>可提现: ${balance?.availableForWithdrawal || 0}</p>
          <p>待处理: ${balance?.pendingAmount || 0}</p>
        </div>
      </div>
      
      <div className="orders-section">
        <h2>可提现订单</h2>
        {loading.orders ? (
          <div>加载订单中...</div>
        ) : (
          <div className="orders-list">
            {withdrawableOrders.length > 0 ? (
              withdrawableOrders.map(order => (
                <div key={order.id} className="order-item">
                  <span>订单 #{order.poNumber}</span>
                  <span>${order.totalAmount}</span>
                </div>
              ))
            ) : (
              <p>暂无可提现订单</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PharmacyDashboard;
```

---

## 🔄 开发流程建议

### 阶段1：立即开始 (已就绪功能)

1. **用户登录界面**
   - 实现pharmacy_operator登录
   - JWT token存储和管理
   - 认证状态持久化

2. **账户管理界面**
   - 余额显示
   - 基础dashboard布局
   - 响应式设计

3. **可提现订单显示**
   - 订单列表组件
   - 订单详情模态框

### 阶段2：等待后端修复 (1-2天)

1. **交易记录界面** (等待参数验证修复)
2. **处方管理界面** (等待参数验证修复)  
3. **采购订单界面** (等待参数验证修复)

### 阶段3：完整功能 (2-3天)

1. **价目表管理** (等待初始数据和完整功能)
2. **履约凭证上传** (等待文件上传功能)
3. **处方扫码** (等待完整业务逻辑)

---

## 🐛 错误处理指南

### 1. 常见错误类型

```javascript
// 认证错误
{
  "statusCode": 401,
  "message": "Unauthorized"
}

// 参数验证错误 (目前多个API存在)
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "BadRequestException"
}

// 业务逻辑错误
{
  "success": false,
  "error": {
    "code": "PRICE_LIST_NOT_FOUND",
    "message": "未找到当前生效的价目表"
  }
}
```

### 2. 错误处理策略

```javascript
const handleAPIError = (error, context) => {
  console.error(`API Error in ${context}:`, error);
  
  // 认证错误 - 重新登录
  if (error.status === 401) {
    usePharmacyStore.getState().logout();
    window.location.href = '/login';
    return;
  }
  
  // 参数验证错误 - 显示友好提示
  if (error.status === 400 && error.message === 'Validation failed') {
    toast.error('后端正在修复此功能，请稍后再试');
    return;
  }
  
  // 其他错误 - 通用处理
  toast.error(error.message || '操作失败，请重试');
};
```

---

## 📞 联系方式

### 后端开发状态查询
- **Slack**: #backend-dev-channel
- **Email**: backend-team@nztcm.co.nz

### 紧急问题
- **当前可用功能**: 用户登录、余额查询、可提现订单
- **修复中功能**: 6个API的参数验证问题
- **预计完成**: 2-3天内全部功能可用

### API测试
- **测试服务器**: http://localhost:4000
- **测试账号**: pharmacy@test.com / Test123!
- **Swagger文档**: http://localhost:4000/api/docs

---

**文档维护**: 后端开发团队  
**最后更新**: 2025年7月11日  
**版本**: 1.0 (基于MVP 2.3验证结果) 