# MVP 2.2 - 医师端前端开发指南

## 📋 文档概述

本文档为医师端前端开发提供API集成指南、UI/UX规范和技术实施方案。基于MVP2.1后端API的实现，确保前后端协同开发。

**文档版本**：3.0 - **Phase 2 系统增强完成**  
**创建日期**：2025年1月9日  
**最后更新**：2025年7月10日  
**依赖后端**：MVP2.1医师端API + Phase2增强功能  
**预计工期**：2周

## 🎉 Phase 2 重大更新说明

### ✅ Phase 2 系统增强和监控体系 - **100%完成**

#### 🚀 Day 1: WebSocket事件标准化系统
- **标准化事件格式**: 与API响应格式完全一致 `{ success, data, message, meta }`
- **事件发射器服务**: 统一事件生成和发送机制
- **事件处理器服务**: 智能事件路由和处理逻辑
- **OrchestrationGateway集成**: 基于现有代码无缝集成
- **测试覆盖**: 11个集成测试全部通过

#### 📊 Day 2: 实时性能监控仪表板
- **实时性能监控服务**: 完整的性能数据收集和分析
- **WebSocket实时通知**: 性能警告和统计数据实时推送
- **可视化HTML仪表板**: 美观的实时性能监控界面 `http://localhost:4000/dashboard/performance`
- **增强型中间件**: 无缝集成现有性能监控基础设施
- **完整集成测试**: 验证所有核心功能

#### 🌐 Day 3: 公共药品API开发
- **公共药品搜索API**: 无需认证的药品搜索接口
- **药品分类API**: 获取所有可用分类列表
- **热门药品API**: 基于创建时间的热门药品推荐
- **搜索建议API**: 实时搜索建议功能
- **完整集成测试**: 验证所有公共API功能

### ✅ Phase 1 基础功能 (已完成)
- 统一响应格式：`{ success, data, message, meta }`
- 标准化错误处理
- 完整的Swagger文档支持
- 类型安全的TypeScript定义

## 🔌 API集成指南

### 基础配置

```typescript
// 环境变量配置 - 已修正端口
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

// 标准API响应类型定义
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    timestamp: string;
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    [key: string]: any;
  };
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
}

// Axios配置示例
import axios from 'axios';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 统一错误处理
apiClient.interceptors.response.use(
  (response) => {
    // 检查标准响应格式
    if (response.data && typeof response.data.success === 'boolean') {
      if (!response.data.success) {
        // 处理业务错误
        throw new Error(response.data.error?.message || '请求失败');
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 清除token并跳转到登录页
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## 📊 标准API响应格式

### 成功响应格式
```typescript
{
  "success": true,
  "data": { /* 具体数据 */ },
  "message": "操作成功",
  "meta": {
    "timestamp": "2025-07-10T11:39:00.000Z",
    "pagination": { /* 分页信息（如适用） */ }
  }
}
```

### 错误响应格式
```typescript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { /* 错误详情 */ },
    "timestamp": "2025-07-10T11:39:00.000Z"
  },
  "meta": {
    "timestamp": "2025-07-10T11:39:00.000Z"
  }
}
```

### 常见错误代码
- `VALIDATION_ERROR`: 请求参数验证失败
- `UNAUTHORIZED`: 未授权访问
- `FORBIDDEN`: 权限不足
- `NOT_FOUND`: 资源不存在
- `ACCOUNT_NOT_FOUND`: 医师账户不存在
- `INSUFFICIENT_BALANCE`: 账户余额不足
- `PAYMENT_FAILED`: 支付处理失败
- `INTERNAL_ERROR`: 服务器内部错误

## 🏥 医师账户API

### 1. 获取账户余额

**端点**: `GET /api/v1/practitioner-accounts/balance`  
**认证**: 需要Bearer Token

#### 响应示例
```typescript
// 成功响应
{
  "success": true,
  "data": {
    "balance": 1250.50,
    "availableCredit": 2749.50,
    "creditLimit": 4000.00,
    "usedCredit": 1250.50
  },
  "message": "账户余额获取成功",
  "meta": {
    "timestamp": "2025-07-10T11:39:00.000Z"
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "ACCOUNT_NOT_FOUND",
    "message": "医师账户不存在",
    "timestamp": "2025-07-10T11:39:00.000Z"
  },
  "meta": {
    "timestamp": "2025-07-10T11:39:00.000Z"
  }
}
```

#### TypeScript接口定义
```typescript
interface BalanceData {
  balance: number;
  availableCredit: number;
  creditLimit: number;
  usedCredit: number;
  currency: string;
  };
}

async function getAccountBalance(): Promise<BalanceResponse> {
  const response = await apiClient.get('/practitioner-accounts/balance');
  return response.data;
}

// React Hook示例
function useAccountBalance() {
  const { data, error, isLoading } = useSWR(
    '/practitioner-accounts/balance',
    () => getAccountBalance()
  );

  return {
    balance: data?.data,
    isLoading,
    error,
  };
}
```

#### 2. 获取交易历史

```typescript
interface Transaction {
  id: string;
  transactionType: 'DEBIT' | 'CREDIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface TransactionHistoryResponse {
  success: boolean;
  data: Transaction[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

async function getTransactionHistory(
  limit: number = 50,
  offset: number = 0
): Promise<TransactionHistoryResponse> {
  const response = await apiClient.get('/practitioner-accounts/transactions', {
    params: { limit, offset },
  });
  return response.data;
}
```

#### 3. 账户充值

```typescript
interface RechargeRequest {
  amount: number;
  currency?: string;
}

interface RechargeResponse {
  success: boolean;
  data: {
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
    currency: string;
  };
}

async function createRechargeIntent(amount: number): Promise<RechargeResponse> {
  const response = await apiClient.post('/practitioner-accounts/recharge', {
    amount,
    currency: 'NZD',
  });
  return response.data;
}

// Stripe支付集成
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function RechargeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) return;
    
    setLoading(true);
    
    try {
      // 1. 创建支付意图
      const { data } = await createRechargeIntent(amount);
      
      // 2. 确认支付
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });
      
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success('充值成功！');
        // 刷新余额
        mutate('/practitioner-accounts/balance');
      }
    } catch (error) {
      toast.error('充值失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        min={10}
        max={10000}
      />
      <CardElement />
      <button type="submit" disabled={!stripe || loading}>
        充值 ${amount}
      </button>
    </form>
  );
}
```

### 处方管理API

#### 1. 创建处方

```typescript
interface Medicine {
  medicineId: string;
  quantity: number;
  dosage: string;
  duration: number;
}

interface CreatePrescriptionRequest {
  medicines: Medicine[];
  notes?: string;
}

interface PrescriptionResponse {
  success: boolean;
  data: {
    id: string;
    qrCode: string;
    totalAmount: number;
    status: 'created' | 'paid' | 'dispensed' | 'completed';
    medicines: Medicine[];
    createdAt: string;
  };
}

async function createPrescription(
  prescription: CreatePrescriptionRequest
): Promise<PrescriptionResponse> {
  const response = await apiClient.post('/prescriptions', prescription);
  return response.data;
}
```

#### 2. 处方支付

```typescript
interface PayPrescriptionRequest {
  prescriptionId: string;
  paymentMethod: 'balance' | 'stripe';
}

async function payPrescription(request: PayPrescriptionRequest) {
  if (request.paymentMethod === 'balance') {
    // 余额支付
    const response = await apiClient.post(
      `/prescriptions/${request.prescriptionId}/pay-with-balance`
    );
    return response.data;
  } else {
    // Stripe支付
    const response = await apiClient.post(
      `/prescriptions/${request.prescriptionId}/pay-with-stripe`
    );
    return response.data;
  }
}
```

### WebSocket实时通知 - **Phase 2 标准化升级**

```typescript
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io(WS_URL, {
      auth: { token },
      path: '/ws/orchestration',
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    // Phase 2 标准化事件格式监听
    this.socket.onmessage = (event) => {
      const response = JSON.parse(event.data);
      
      // 标准化响应格式: { success, data, message, meta }
      if (response.success) {
        switch (response.data.eventType) {
          case 'prescription_status_update':
            this.handlePrescriptionUpdate(response.data);
            break;
          case 'account_balance_update':
            this.handleBalanceUpdate(response.data);
            break;
          case 'performance_stats_update':
            this.handlePerformanceUpdate(response.data);
            break;
        }
      }
    };

    // 性能监控事件 (Phase 2 新增)
    this.socket.on('system', (data) => {
      if (data.eventType === 'performance_stats_update') {
        this.updatePerformanceDashboard(data.stats);
      }
      
      if (data.alertType === 'performance') {
        this.showPerformanceAlert(data);
      }
    });

    // 传统事件监听 (向后兼容)
    this.socket.on('prescription.payment.completed', (data) => {
      toast.success(`处方 ${data.prescriptionId} 支付成功`);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handlePerformanceUpdate(data: any) {
    // 更新性能仪表板
    const event = new CustomEvent('performance-update', { detail: data });
    window.dispatchEvent(event);
  }

  private showPerformanceAlert(data: any) {
    // 显示性能警告
    if (data.severity === 'high') {
      toast.error(`性能警告: ${data.message}`);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// React Context
const WebSocketContext = React.createContext<WebSocketService | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsService = useRef(new WebSocketService());

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      wsService.current.connect(token);
    }

    return () => {
      wsService.current.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={wsService.current}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

## 🎨 UI/UX设计规范

### 页面布局

```tsx
// 医师端主布局
function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">中医处方系统</h1>
            </div>
            <div className="flex items-center space-x-4">
              <AccountBalance />
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* 侧边栏 */}
      <div className="flex">
        <aside className="w-64 bg-white shadow-sm">
          <nav className="mt-5 px-2">
            <Link href="/doctor/prescriptions/new">
              <a className="nav-item">开具处方</a>
            </Link>
            <Link href="/doctor/prescriptions">
              <a className="nav-item">处方历史</a>
            </Link>
            <Link href="/doctor/account">
              <a className="nav-item">账户管理</a>
            </Link>
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 核心组件设计

#### 1. 账户余额显示

```tsx
function AccountBalance() {
  const { balance, isLoading } = useAccountBalance();

  if (isLoading) return <Skeleton width={100} height={20} />;

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-500">余额:</span>
      <span className="text-lg font-semibold text-green-600">
        ${balance?.balance.toFixed(2)}
      </span>
      {balance?.availableCredit > 0 && (
        <span className="text-sm text-gray-500">
          (可用额度: ${balance.availableCredit.toFixed(2)})
        </span>
      )}
    </div>
  );
}
```

## 🌐 Phase 2 公共药品API集成指南

### ✅ 数据库验证完成 - 立即可用

**验证状态**: 2025年7月10日完成数据库验证，所有API字段100%匹配  
**数据完整性**: 50种药品，7个分类，完整索引优化  
**搜索功能**: 支持中文、拼音、英文多语言搜索

### 🔧 公共药品API端点详解

#### 1. 药品搜索API - `GET /public/medicines`

**特点**: 无需认证，支持多条件搜索和分页

```typescript
// API调用示例
interface MedicineSearchParams {
  search?: string;      // 搜索关键词 (支持中文、拼音、英文)
  category?: string;    // 药品分类过滤
  limit?: number;       // 每页数量 (默认25, 最大100)
  offset?: number;      // 偏移量 (分页用)
}

// 实际API调用
async function searchMedicines(params: MedicineSearchParams) {
  const response = await fetch(`http://localhost:4000/public/medicines?${new URLSearchParams(params as any)}`);
  return await response.json();
}

// 实际响应格式 (已验证)
{
  "success": true,
  "data": {
    "medicines": [
      {
        "id": "cmc1bzjmg0000ugr4y037tf2i",
        "name": "当归",
        "chineseName": "当归", 
        "englishName": "Angelica sinensis",
        "pinyinName": "danggui",
        "category": "补益药",
        "basePrice": "0.85",  // 注意: 数据库返回string，需转换
        "unit": "g",
        "sku": "DG",
        "status": "active",
        "description": "当归 (Angelica sinensis)",
        "requiresPrescription": false
      }
    ],
    "total": 50
  },
  "meta": {
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 25,
      "totalPages": 2
    },
    "timestamp": "2025-07-10T12:07:00.000Z"
  }
}
```

#### 2. 药品分类API - `GET /public/medicines/categories`

**特点**: 获取所有可用分类，数据稳定

```typescript
// API调用
async function getMedicineCategories() {
  const response = await fetch('http://localhost:4000/public/medicines/categories');
  return await response.json();
}

// 实际响应 (已验证的7个分类)
{
  "success": true,
  "data": {
    "categories": [
      "其他中药",    // 28种药品
      "补益药",      // 7种药品  
      "清热药",      // 6种药品
      "化痰药",      // 3种药品
      "止咳药",      // 2种药品
      "活血药",      // 2种药品
      "理气药"       // 2种药品
    ]
  },
  "meta": {
    "timestamp": "2025-07-10T12:07:00.000Z"
  }
}
```

#### 3. 热门药品API - `GET /public/medicines/popular`

```typescript
// API调用
async function getPopularMedicines(limit: number = 10) {
  const response = await fetch(`http://localhost:4000/public/medicines/popular?limit=${limit}`);
  return await response.json();
}

// 响应格式 (基于创建时间排序)
{
  "success": true,
  "data": {
    "medicines": [
      {
        "id": "cmc1bzjmg0000ugr4y037tf2i",
        "name": "当归",
        "chineseName": "当归",
        "category": "补益药",
        "basePrice": "0.85",
        "unit": "g"
      }
      // ... 更多热门药品
    ]
  }
}
```

#### 4. 搜索建议API - `GET /public/medicines/search/suggestions`

```typescript
// API调用 (实时搜索建议)
async function getMedicineSearchSuggestions(query: string) {
  const response = await fetch(`http://localhost:4000/public/medicines/search/suggestions?q=${encodeURIComponent(query)}`);
  return await response.json();
}

// 使用示例: 搜索"当"
// 响应: { "success": true, "data": { "suggestions": ["当归", "当参"] } }
```

### 🎯 完整的React集成示例

#### 1. 药品搜索组件

```tsx
// components/MedicineSearch.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

interface Medicine {
  id: string;
  name: string;
  chineseName: string;
  englishName: string;
  pinyinName: string;
  category: string;
  basePrice: string;
  unit: string;
  sku: string;
  description: string;
  requiresPrescription: boolean;
}

interface SearchResult {
  medicines: Medicine[];
  total: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const MedicineSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 获取分类列表
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('http://localhost:4000/public/medicines/categories');
        const data = await response.json();
        if (data.success) {
          setCategories(data.data.categories);
        }
      } catch (error) {
        console.error('获取分类失败:', error);
      }
    }
    fetchCategories();
  }, []);

  // 搜索建议 (防抖)
  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
        setSuggestions([]);
        return;
      }
      
      try {
        const response = await fetch(
          `http://localhost:4000/public/medicines/search/suggestions?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.data.suggestions);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('获取搜索建议失败:', error);
      }
    }, 300),
    []
  );

  // 搜索药品
  const searchMedicines = async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '25',
        offset: ((page - 1) * 25).toString(),
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`http://localhost:4000/public/medicines?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults({
          medicines: data.data.medicines.map((medicine: Medicine) => ({
            ...medicine,
            basePrice: parseFloat(medicine.basePrice) // 转换价格为数字
          })),
          total: data.data.total,
          pagination: data.meta.pagination
        });
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索输入
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    fetchSuggestions(value);
  };

  // 选择搜索建议
  const selectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    searchMedicines(1);
  };

  // 处理搜索提交
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    searchMedicines(1);
  };

  return (
    <div className="medicine-search">
      {/* 搜索表单 */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-4 mb-4">
          {/* 搜索输入框 */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="搜索药品 (支持中文、拼音、英文)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onFocus={() => searchQuery && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            
            {/* 搜索建议下拉 */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 分类选择 */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">所有分类</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          {/* 搜索按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>
      </form>

      {/* 搜索结果 */}
      {searchResults && (
        <div>
          {/* 结果统计 */}
          <div className="mb-4 text-gray-600">
            找到 {searchResults.total} 种药品
            {selectedCategory && ` (分类: ${selectedCategory})`}
          </div>

          {/* 药品列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {searchResults.medicines.map((medicine) => (
              <div key={medicine.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-lg mb-2">
                  {medicine.name}
                  {medicine.chineseName !== medicine.name && (
                    <span className="text-gray-600 ml-2">({medicine.chineseName})</span>
                  )}
                </h3>
                
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>英文名:</strong> {medicine.englishName}</p>
                  <p><strong>拼音:</strong> {medicine.pinyinName}</p>
                  <p><strong>分类:</strong> {medicine.category}</p>
                  <p><strong>价格:</strong> ${parseFloat(medicine.basePrice).toFixed(2)} / {medicine.unit}</p>
                  <p><strong>SKU:</strong> {medicine.sku}</p>
                  {medicine.requiresPrescription && (
                    <p className="text-red-600"><strong>需要处方</strong></p>
                  )}
                </div>
                
                {medicine.description && (
                  <p className="mt-2 text-sm text-gray-700">{medicine.description}</p>
                )}
              </div>
            ))}
          </div>

          {/* 分页 */}
          {searchResults.pagination.totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => searchMedicines(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                上一页
              </button>
              
              <span className="px-4 py-2">
                第 {currentPage} 页，共 {searchResults.pagination.totalPages} 页
              </span>
              
              <button
                onClick={() => searchMedicines(currentPage + 1)}
                disabled={currentPage === searchResults.pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

#### 2. 热门药品组件

```tsx
// components/PopularMedicines.tsx
import React, { useState, useEffect } from 'react';

interface PopularMedicine {
  id: string;
  name: string;
  chineseName: string;
  category: string;
  basePrice: string;
  unit: string;
}

export const PopularMedicines: React.FC = () => {
  const [medicines, setMedicines] = useState<PopularMedicine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPopularMedicines() {
      try {
        const response = await fetch('http://localhost:4000/public/medicines/popular?limit=12');
        const data = await response.json();
        
        if (data.success) {
          setMedicines(data.data.medicines);
        }
      } catch (error) {
        console.error('获取热门药品失败:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPopularMedicines();
  }, []);

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="popular-medicines">
      <h2 className="text-2xl font-bold mb-6">热门药品</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {medicines.map((medicine) => (
          <div key={medicine.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer">
            <h3 className="font-medium text-sm mb-1">{medicine.name}</h3>
            <p className="text-xs text-gray-600 mb-1">{medicine.category}</p>
            <p className="text-sm font-semibold text-green-600">
              ${parseFloat(medicine.basePrice).toFixed(2)} / {medicine.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 🚀 快速开始指南

### 1. 安装依赖
```bash
npm install axios lodash
npm install -D @types/lodash
# 或
yarn add axios lodash
yarn add -D @types/lodash
```

### 2. 自定义Hook集成

#### 药品搜索Hook

```typescript
// hooks/useMedicineSearch.ts
import { useState, useCallback } from 'react';

interface Medicine {
  id: string;
  name: string;
  chineseName: string;
  englishName: string;
  pinyinName: string;
  category: string;
  basePrice: string;
  unit: string;
  sku: string;
  description: string;
  requiresPrescription: boolean;
}

interface SearchParams {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

interface SearchResult {
  medicines: Medicine[];
  total: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const useMedicineSearch = () => {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMedicines = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.category) searchParams.append('category', params.category);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.offset) searchParams.append('offset', params.offset.toString());

      const response = await fetch(`http://localhost:4000/public/medicines?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || '搜索失败');
      }

      // 转换价格为数字类型
      const processedMedicines = data.data.medicines.map((medicine: Medicine) => ({
        ...medicine,
        basePrice: parseFloat(medicine.basePrice)
      }));

      setResults({
        medicines: processedMedicines,
        total: data.data.total,
        pagination: data.meta.pagination
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    searchMedicines,
    clearResults
  };
};
```

#### 药品分类Hook

```typescript
// hooks/useMedicineCategories.ts
import { useState, useEffect } from 'react';

export const useMedicineCategories = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('http://localhost:4000/public/medicines/categories');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setCategories(data.data.categories);
        } else {
          throw new Error(data.error?.message || '获取分类失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取分类失败');
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  return { categories, loading, error };
};
```

#### 搜索建议Hook

```typescript
// hooks/useMedicineSearchSuggestions.ts
import { useState, useCallback } from 'react';
import { debounce } from 'lodash';

export const useMedicineSearchSuggestions = () => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      
      try {
        const response = await fetch(
          `http://localhost:4000/public/medicines/search/suggestions?q=${encodeURIComponent(query)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSuggestions(data.data.suggestions || []);
          }
        }
      } catch (error) {
        console.error('获取搜索建议失败:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    loading,
    fetchSuggestions,
    clearSuggestions
  };
};
```

### 3. 错误处理和加载状态

#### 统一错误处理组件

```tsx
// components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Medicine search error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-center py-8">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">出现错误</h3>
          <p className="text-gray-600 mb-4">药品搜索功能暂时不可用，请稍后重试</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 加载状态组件

```tsx
// components/LoadingSpinner.tsx
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = '加载中...' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
      {text && <p className="mt-2 text-gray-600">{text}</p>}
    </div>
  );
};
```

### 4. 性能优化示例

#### 虚拟化长列表 (使用react-window)

```tsx
// components/VirtualizedMedicineList.tsx
import React from 'react';
import { FixedSizeList as List } from 'react-window';

interface Medicine {
  id: string;
  name: string;
  chineseName: string;
  category: string;
  basePrice: number;
  unit: string;
}

interface VirtualizedMedicineListProps {
  medicines: Medicine[];
  onMedicineSelect?: (medicine: Medicine) => void;
}

const MedicineItem: React.FC<{
  index: number;
  style: React.CSSProperties;
  data: { medicines: Medicine[]; onSelect?: (medicine: Medicine) => void };
}> = ({ index, style, data }) => {
  const medicine = data.medicines[index];
  
  return (
    <div style={style} className="px-4 py-2 border-b border-gray-200">
      <div 
        className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
        onClick={() => data.onSelect?.(medicine)}
      >
        <div>
          <h3 className="font-medium">{medicine.name}</h3>
          <p className="text-sm text-gray-600">{medicine.category}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">${medicine.basePrice.toFixed(2)}</p>
          <p className="text-sm text-gray-600">/{medicine.unit}</p>
        </div>
      </div>
    </div>
  );
};

export const VirtualizedMedicineList: React.FC<VirtualizedMedicineListProps> = ({
  medicines,
  onMedicineSelect
}) => {
  return (
    <div className="border border-gray-200 rounded-lg">
      <List
        height={400}
        itemCount={medicines.length}
        itemSize={80}
        itemData={{ medicines, onSelect: onMedicineSelect }}
      >
        {MedicineItem}
      </List>
    </div>
  );
};
```

#### 缓存和本地存储

```typescript
// utils/medicineCache.ts
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class MedicineCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_EXPIRY = 5 * 60 * 1000; // 5分钟

  set<T>(key: string, data: T, expiry: number = this.DEFAULT_EXPIRY): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  // 缓存药品分类
  async getCategories(): Promise<string[]> {
    const cached = this.get<string[]>('categories');
    if (cached) return cached;

    try {
      const response = await fetch('http://localhost:4000/public/medicines/categories');
      const data = await response.json();
      
      if (data.success) {
        this.set('categories', data.data.categories, 30 * 60 * 1000); // 30分钟缓存
        return data.data.categories;
      }
    } catch (error) {
      console.error('获取分类失败:', error);
    }
    
    return [];
  }

  // 缓存搜索结果
  getCachedSearchResults(searchKey: string) {
    return this.get(`search:${searchKey}`);
  }

  setCachedSearchResults(searchKey: string, results: any) {
    this.set(`search:${searchKey}`, results, 2 * 60 * 1000); // 2分钟缓存
  }
}

export const medicineCache = new MedicineCache();
```

### 5. 完整的集成示例页面

```tsx
// pages/MedicineSearchPage.tsx
import React, { useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MedicineSearch } from '../components/MedicineSearch';
import { PopularMedicines } from '../components/PopularMedicines';
import { useMedicineCategories } from '../hooks/useMedicineCategories';

export const MedicineSearchPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'popular'>('search');
  const { categories, loading: categoriesLoading } = useMedicineCategories();

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">药品搜索</h1>
          <p className="text-gray-600">
            搜索我们的药品数据库，包含50种中药材，支持中文、拼音和英文搜索
          </p>
        </div>

        {/* 标签页导航 */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('search')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              药品搜索
            </button>
            <button
              onClick={() => setActiveTab('popular')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'popular'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              热门药品
            </button>
          </nav>
        </div>

        {/* 分类加载状态 */}
        {categoriesLoading && (
          <div className="mb-4">
            <LoadingSpinner size="sm" text="加载分类中..." />
          </div>
        )}

        {/* 分类快速选择 */}
        {!categoriesLoading && categories.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">快速选择分类:</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  onClick={() => {
                    // 这里可以触发搜索
                    console.log('选择分类:', category);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 主要内容 */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'search' ? (
            <div className="p-6">
              <MedicineSearch />
            </div>
          ) : (
            <div className="p-6">
              <PopularMedicines />
            </div>
          )}
        </div>

        {/* 统计信息 */}
        <div className="mt-8 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>数据库状态:</strong> 50种药品 • 7个分类 • 支持多语言搜索 • 实时更新
              </p>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
```

### 2. 设置API客户端
```typescript
// api/client.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加认证拦截器
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 添加响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    if (response.data && !response.data.success) {
      throw new Error(response.data.error?.message || '请求失败');
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 3. 创建API服务
```typescript
// api/practitioner-account.ts
import { apiClient } from './client';

export class PractitionerAccountAPI {
  // 获取账户余额
  static async getBalance(): Promise<BalanceData> {
    const response = await apiClient.get<BalanceResponse>('/practitioner-accounts/balance');
    return response.data.data!;
  }

  // 获取交易历史
  static async getTransactionHistory(limit = 20, offset = 0) {
    const response = await apiClient.get<TransactionHistoryResponse>(
      `/practitioner-accounts/transactions?limit=${limit}&offset=${offset}`
    );
    return {
      data: response.data.data!,
      pagination: response.data.meta!.pagination
    };
  }

  // 获取账户信息
  static async getAccountInfo() {
    const response = await apiClient.get('/practitioner-accounts/info');
    return response.data.data;
  }

  // 创建充值支付意图
  static async createRecharge(amount: number, currency = 'NZD') {
    const response = await apiClient.post('/practitioner-accounts/recharge', {
      amount,
      currency
    });
    return response.data.data;
  }
}
```

### 4. React组件使用示例
```typescript
// components/AccountBalance.tsx
import React, { useEffect, useState } from 'react';
import { PractitionerAccountAPI } from '../api/practitioner-account';

interface BalanceData {
  balance: number;
  availableCredit: number;
  creditLimit: number;
  usedCredit: number;
}

export const AccountBalance: React.FC = () => {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const data = await PractitionerAccountAPI.getBalance();
        setBalance(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取余额失败');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, []);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  if (!balance) return <div>无数据</div>;

  return (
    <div className="balance-card">
      <h3>账户余额</h3>
      <div className="balance-info">
        <p>当前余额: {balance.currency} {balance.balance.toFixed(2)}</p>
        <p>可用信用: {balance.currency} {balance.availableCredit.toFixed(2)}</p>
        <p>信用额度: {balance.currency} {balance.creditLimit.toFixed(2)}</p>
        <p>已用信用: {balance.currency} {balance.usedCredit.toFixed(2)}</p>
      </div>
    </div>
  );
};
```

## 💡 最佳实践

### 1. 错误处理
```typescript
// 统一错误处理函数
export const handleApiError = (error: any) => {
  if (error.response?.data?.error) {
    const apiError = error.response.data.error;
    switch (apiError.code) {
      case 'ACCOUNT_NOT_FOUND':
        return '账户不存在，请联系管理员';
      case 'INSUFFICIENT_BALANCE':
        return '账户余额不足';
      case 'VALIDATION_ERROR':
        return `参数错误: ${apiError.message}`;
      default:
        return apiError.message || '操作失败';
    }
  }
  return '网络错误，请稍后重试';
};
```

### 2. 加载状态管理
```typescript
// hooks/useApiState.ts
import { useState, useCallback } from 'react';

export const useApiState = <T>() => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (apiCall: () => Promise<T>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
};
```

### 3. 类型安全
```typescript
// 确保所有API调用都有正确的类型定义
// 使用泛型确保响应数据类型安全
// 利用TypeScript的严格模式检查

// 示例：类型安全的API调用
const balance = await PractitionerAccountAPI.getBalance(); // 返回类型自动推断为 BalanceData
```

#### 2. 处方创建表单

```tsx
function PrescriptionForm() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);

  const addMedicine = () => {
    setMedicines([
      ...medicines,
      {
        medicineId: '',
        quantity: 1,
        dosage: '',
        duration: 7,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createPrescription({ medicines });
      
      // 显示二维码
      showQRCodeModal(result.data.qrCode);
      
      // 询问支付方式
      const paymentMethod = await showPaymentMethodDialog();
      
      if (paymentMethod) {
        await payPrescription({
          prescriptionId: result.data.id,
          paymentMethod,
        });
      }
    } catch (error) {
      toast.error('处方创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">处方信息</h2>
        
        {medicines.map((medicine, index) => (
          <MedicineInput
            key={index}
            medicine={medicine}
            onChange={(updated) => updateMedicine(index, updated)}
            onRemove={() => removeMedicine(index)}
          />
        ))}
        
        <button
          type="button"
          onClick={addMedicine}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          + 添加药品
        </button>
      </div>

      <div className="flex justify-end space-x-4">
        <button type="button" className="btn-secondary">
          保存草稿
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '处理中...' : '创建处方'}
        </button>
      </div>
    </form>
  );
}
```

#### 3. 药品搜索组件

```tsx
function MedicineSearch({ onSelect }: { onSelect: (medicine: Medicine) => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // 防抖搜索
  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        if (query.length < 2) {
          setResults([]);
          return;
        }

        setLoading(true);
        try {
          const response = await apiClient.get('/medicines/search', {
            params: { q: query },
          });
          setResults(response.data.data);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setLoading(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(search);
  }, [search, debouncedSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索药品（拼音/中文）"
        className="w-full px-4 py-2 border rounded-lg"
      />
      
      {loading && (
        <div className="absolute right-2 top-2">
          <Spinner size="sm" />
        </div>
      )}

      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
          {results.map((medicine) => (
            <div
              key={medicine.id}
              onClick={() => onSelect(medicine)}
              className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <div className="font-medium">{medicine.name}</div>
              <div className="text-sm text-gray-500">
                {medicine.specification} - {medicine.manufacturer}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 📱 移动端适配

### 响应式设计原则

```css
/* 移动优先的断点设置 */
/* 默认: 移动端 */
/* sm: 640px - 平板竖屏 */
/* md: 768px - 平板横屏 */
/* lg: 1024px - 笔记本 */
/* xl: 1280px - 桌面显示器 */
```

### 移动端特殊处理

```tsx
// 移动端处方创建优化
function MobilePrescriptionForm() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 固定顶部 */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-10">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={goBack}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-medium">开具处方</h1>
          <button onClick={saveDraft}>
            <Save className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* 可滚动内容区 */}
      <div className="pt-14 pb-20">
        {/* 处方表单内容 */}
      </div>

      {/* 固定底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex p-4 space-x-4">
          <button className="flex-1 btn-secondary">预览</button>
          <button className="flex-1 btn-primary">提交</button>
        </div>
      </div>
    </div>
  );
}
```

## 🔧 开发工具配置

### 推荐技术栈

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "next": "^14.0.0",
    "axios": "^1.6.0",
    "swr": "^2.2.0",
    "@stripe/stripe-js": "^2.2.0",
    "@stripe/react-stripe-js": "^2.4.0",
    "socket.io-client": "^4.6.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### 状态管理

```typescript
// 使用Zustand管理全局状态
import { create } from 'zustand';

interface AccountStore {
  balance: number;
  availableCredit: number;
  updateBalance: (balance: number, credit: number) => void;
}

const useAccountStore = create<AccountStore>((set) => ({
  balance: 0,
  availableCredit: 0,
  updateBalance: (balance, availableCredit) => set({ balance, availableCredit }),
}));
```

## 📋 开发检查清单

### 第1周：基础功能实现
- [ ] 项目初始化和环境配置
- [ ] 认证流程实现（登录/登出）
- [ ] 医师账户页面
  - [ ] 余额显示组件
  - [ ] 交易历史列表
  - [ ] 充值功能（Stripe集成）
- [ ] 基础布局和导航

### 第2周：处方功能和优化
- [ ] 处方创建流程
  - [ ] 药品搜索和选择
  - [ ] 剂量和用法输入
  - [ ] 处方预览
- [ ] 处方历史管理
  - [ ] 列表展示
  - [ ] 状态筛选
  - [ ] 详情查看
- [ ] 支付流程集成
  - [ ] 余额支付
  - [ ] Stripe支付
- [ ] WebSocket实时通知
- [ ] 移动端适配
- [ ] 性能优化

## 🚀 部署准备

### 环境变量配置

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.tcm-prescription.nz/api/v1
NEXT_PUBLIC_WS_URL=wss://api.tcm-prescription.nz
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### 构建优化

```javascript
// next.config.js
module.exports = {
  output: 'standalone',
  images: {
    domains: ['api.tcm-prescription.nz'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};
```

---

## 📋 Phase 1 完成总结

### ✅ 已完成的标准化工作

1. **API响应格式统一**
   - 成功响应：`{ success: true, data, message, meta }`
   - 错误响应：`{ success: false, error: { code, message, details, timestamp }, meta }`
   - 分页响应：包含完整的分页元数据

2. **错误处理标准化**
   - 统一错误代码枚举
   - 结构化错误信息
   - 时间戳和详情支持

3. **TypeScript类型定义**
   - 完整的接口定义
   - 泛型响应类型
   - 类型安全的API调用

4. **开发者工具**
   - 响应辅助工具类
   - 标准装饰器
   - 验证和分页工具

### 🔧 医师账户API端点

| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/v1/practitioner-accounts/balance` | GET | 获取账户余额 | ✅ 已标准化 |
| `/api/v1/practitioner-accounts/transactions` | GET | 获取交易历史 | ✅ 已标准化 |
| `/api/v1/practitioner-accounts/info` | GET | 获取账户信息 | ✅ 已标准化 |
| `/api/v1/practitioner-accounts/recharge` | POST | 账户充值 | ✅ 已标准化 |

### 🌐 Phase 2 新增API端点

#### 性能监控API
| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/dashboard/performance` | GET | 性能监控仪表板 | ✅ Phase 2 新增 |
| `/dashboard/performance/api` | GET | 性能数据API | ✅ Phase 2 新增 |

#### 公共药品API (无需认证)
| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/public/medicines` | GET | 公共药品搜索 | ✅ Phase 2 新增 |
| `/public/medicines/categories` | GET | 药品分类列表 | ✅ Phase 2 新增 |
| `/public/medicines/popular` | GET | 热门药品推荐 | ✅ Phase 2 新增 |
| `/public/medicines/search/suggestions` | GET | 搜索建议 | ✅ Phase 2 新增 |

### 🎯 前端开发建议

1. **立即可用**
   - 所有医师账户API已标准化，可立即开始前端开发
   - 使用提供的TypeScript接口确保类型安全
   - 参考React组件示例快速实现

2. **错误处理**
   - 使用统一的错误处理函数
   - 根据错误代码提供用户友好的提示
   - 实现自动重试机制（适用于网络错误）

3. **性能优化**
   - 实现适当的缓存策略
   - 使用分页避免大量数据加载
   - 考虑实现乐观更新

## 🚀 下一步计划 (Phase 2)

### Week 2: 系统增强和监控体系

1. **实时通知系统规范化**
   - WebSocket事件标准格式
   - 账户余额变化通知
   - 支付状态更新通知

2. **性能监控仪表板**
   - API响应时间监控
   - 错误率统计
   - 并发用户监控

3. **健康检查系统**
   - 系统状态检查端点
   - 数据库连接监控
   - 外部服务状态检查

### 📞 技术支持

如有任何API相关问题，请联系后端团队：
- **Slack频道**: #backend-support
- **技术文档**: 本文档将持续更新
- **API测试**: 使用Swagger文档进行测试 (`http://localhost:4000/api/docs`)

---

**文档维护**: 后端开发团队  
## 🧪 测试和调试指南

### 1. API测试工具

#### 使用curl测试公共API

```bash
# 测试药品搜索
curl -X GET "http://localhost:4000/public/medicines?search=当归&limit=5" \
  -H "Content-Type: application/json"

# 测试分类API
curl -X GET "http://localhost:4000/public/medicines/categories" \
  -H "Content-Type: application/json"

# 测试热门药品
curl -X GET "http://localhost:4000/public/medicines/popular?limit=10" \
  -H "Content-Type: application/json"

# 测试搜索建议
curl -X GET "http://localhost:4000/public/medicines/search/suggestions?q=当" \
  -H "Content-Type: application/json"
```

#### 使用Postman测试

```json
// Postman Collection for Medicine APIs
{
  "info": {
    "name": "Medicine Public APIs",
    "description": "Phase 2 公共药品API测试集合"
  },
  "item": [
    {
      "name": "Search Medicines",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/public/medicines?search={{searchTerm}}&category={{category}}&limit={{limit}}&offset={{offset}}",
          "host": ["{{baseUrl}}"],
          "path": ["public", "medicines"],
          "query": [
            {"key": "search", "value": "{{searchTerm}}"},
            {"key": "category", "value": "{{category}}"},
            {"key": "limit", "value": "{{limit}}"},
            {"key": "offset", "value": "{{offset}}"}
          ]
        }
      }
    }
  ],
  "variable": [
    {"key": "baseUrl", "value": "http://localhost:4000"},
    {"key": "searchTerm", "value": "当归"},
    {"key": "category", "value": "补益药"},
    {"key": "limit", "value": "25"},
    {"key": "offset", "value": "0"}
  ]
}
```

### 2. 单元测试示例

#### Jest + React Testing Library

```typescript
// __tests__/components/MedicineSearch.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MedicineSearch } from '../components/MedicineSearch';

// Mock fetch
global.fetch = jest.fn();

const mockMedicinesResponse = {
  success: true,
  data: {
    medicines: [
      {
        id: "test-id-1",
        name: "当归",
        chineseName: "当归",
        englishName: "Angelica sinensis",
        pinyinName: "danggui",
        category: "补益药",
        basePrice: "0.85",
        unit: "g",
        sku: "DG",
        description: "当归 (Angelica sinensis)",
        requiresPrescription: false
      }
    ],
    total: 1
  },
  meta: {
    pagination: {
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1
    }
  }
};

const mockCategoriesResponse = {
  success: true,
  data: {
    categories: ["补益药", "清热药", "活血药"]
  }
};

describe('MedicineSearch', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  test('renders search form', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCategoriesResponse
    });

    render(<MedicineSearch />);
    
    expect(screen.getByPlaceholderText(/搜索药品/)).toBeInTheDocument();
    expect(screen.getByText('搜索')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('补益药')).toBeInTheDocument();
    });
  });

  test('performs search and displays results', async () => {
    // Mock categories call
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCategoriesResponse
    });

    // Mock search call
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMedicinesResponse
    });

    render(<MedicineSearch />);
    
    const searchInput = screen.getByPlaceholderText(/搜索药品/);
    const searchButton = screen.getByText('搜索');

    fireEvent.change(searchInput, { target: { value: '当归' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('当归')).toBeInTheDocument();
      expect(screen.getByText('$0.85')).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/medicines?search=当归')
    );
  });

  test('handles search error gracefully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategoriesResponse
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<MedicineSearch />);
    
    const searchInput = screen.getByPlaceholderText(/搜索药品/);
    const searchButton = screen.getByText('搜索');

    fireEvent.change(searchInput, { target: { value: '当归' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/搜索失败/)).toBeInTheDocument();
    });
  });
});
```

#### Hook测试

```typescript
// __tests__/hooks/useMedicineSearch.test.ts
import { renderHook, act } from '@testing-library/react';
import { useMedicineSearch } from '../hooks/useMedicineSearch';

global.fetch = jest.fn();

describe('useMedicineSearch', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  test('should search medicines successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        medicines: [{ id: '1', name: '当归', basePrice: '0.85' }],
        total: 1
      },
      meta: { pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const { result } = renderHook(() => useMedicineSearch());

    await act(async () => {
      await result.current.searchMedicines({ search: '当归' });
    });

    expect(result.current.results).toEqual({
      medicines: [{ id: '1', name: '当归', basePrice: 0.85 }],
      total: 1,
      pagination: { total: 1, page: 1, limit: 25, totalPages: 1 }
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });
});
```

### 3. 性能监控和优化

#### 性能监控Hook

```typescript
// hooks/usePerformanceMonitor.ts
import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  apiCallDuration: number;
  renderTime: number;
  searchResultsCount: number;
}

export const usePerformanceMonitor = () => {
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  const recordApiCall = (duration: number, resultsCount: number) => {
    metricsRef.current.push({
      apiCallDuration: duration,
      renderTime: performance.now(),
      searchResultsCount: resultsCount
    });

    // 保持最近100次记录
    if (metricsRef.current.length > 100) {
      metricsRef.current = metricsRef.current.slice(-100);
    }
  };

  const getAverageApiTime = () => {
    if (metricsRef.current.length === 0) return 0;
    const total = metricsRef.current.reduce((sum, metric) => sum + metric.apiCallDuration, 0);
    return total / metricsRef.current.length;
  };

  const getSlowQueries = (threshold: number = 1000) => {
    return metricsRef.current.filter(metric => metric.apiCallDuration > threshold);
  };

  return {
    recordApiCall,
    getAverageApiTime,
    getSlowQueries,
    metrics: metricsRef.current
  };
};
```

### 4. 故障排除指南

#### 常见问题和解决方案

```typescript
// utils/troubleshooting.ts
export const troubleshootingGuide = {
  // 网络连接问题
  networkIssues: {
    symptoms: ['fetch failed', 'Network request failed', 'CORS error'],
    solutions: [
      '检查后端服务是否运行在 http://localhost:4000',
      '确认CORS配置正确',
      '检查网络连接',
      '验证API端点URL是否正确'
    ],
    testCommand: 'curl -X GET "http://localhost:4000/public/medicines/categories"'
  },

  // API响应格式错误
  responseFormatIssues: {
    symptoms: ['Unexpected token', 'Cannot read property of undefined', 'data.success is not a function'],
    solutions: [
      '检查API响应是否符合标准格式 { success, data, message, meta }',
      '验证Content-Type是否为application/json',
      '检查后端API版本是否为最新',
      '确认数据库连接正常'
    ],
    debugCode: `
      // 添加响应调试
      const response = await fetch(url);
      const text = await response.text();
      console.log('Raw response:', text);
      const data = JSON.parse(text);
      console.log('Parsed data:', data);
    `
  },

  // 搜索功能问题
  searchIssues: {
    symptoms: ['No search results', 'Search too slow', 'Chinese characters not working'],
    solutions: [
      '确认数据库中有药品数据 (应该有50种)',
      '检查搜索索引是否正确建立',
      '验证中文编码设置',
      '测试不同的搜索关键词'
    ],
    testQueries: [
      '当归', // 应该返回1个结果
      '补益药', // 按分类搜索，应该返回7个结果
      'angelica' // 英文搜索
    ]
  },

  // 性能问题
  performanceIssues: {
    symptoms: ['Slow API responses', 'UI freezing', 'Memory leaks'],
    solutions: [
      '实现搜索防抖 (300ms)',
      '使用虚拟化长列表',
      '添加结果缓存',
      '优化图片和资源加载',
      '检查内存泄漏'
    ],
    optimizations: `
      // 防抖搜索
      const debouncedSearch = debounce(searchFunction, 300);
      
      // 结果缓存
      const cache = new Map();
      
      // 虚拟化列表
      import { FixedSizeList } from 'react-window';
    `
  }
};

// 自动诊断函数
export const runDiagnostics = async () => {
  const results = {
    backendConnection: false,
    apiResponse: false,
    dataAvailability: false,
    searchFunctionality: false
  };

  try {
    // 测试后端连接
    const healthResponse = await fetch('http://localhost:4000/public/medicines/categories');
    results.backendConnection = healthResponse.ok;

    if (results.backendConnection) {
      const data = await healthResponse.json();
      results.apiResponse = data.success === true;
      results.dataAvailability = Array.isArray(data.data?.categories) && data.data.categories.length > 0;
    }

    // 测试搜索功能
    if (results.dataAvailability) {
      const searchResponse = await fetch('http://localhost:4000/public/medicines?search=当归');
      const searchData = await searchResponse.json();
      results.searchFunctionality = searchData.success && searchData.data?.medicines?.length > 0;
    }

  } catch (error) {
    console.error('Diagnostics failed:', error);
  }

  return results;
};
```

### 5. 部署检查清单

#### 生产环境配置

```typescript
// config/production.ts
export const productionConfig = {
  // API配置
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.tcm-prescription.nz/api/v1',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.tcm-prescription.nz',
  
  // 性能配置
  enableCaching: true,
  cacheExpiry: 5 * 60 * 1000, // 5分钟
  maxRetries: 3,
  requestTimeout: 10000, // 10秒
  
  // 监控配置
  enablePerformanceMonitoring: true,
  enableErrorReporting: true,
  
  // 功能开关
  features: {
    searchSuggestions: true,
    virtualizedLists: true,
    offlineSupport: false
  }
};

// 部署前检查
export const preDeploymentChecks = async () => {
  const checks = [];
  
  // 检查环境变量
  if (!process.env.NEXT_PUBLIC_API_URL) {
    checks.push('❌ NEXT_PUBLIC_API_URL 未设置');
  } else {
    checks.push('✅ API URL 已配置');
  }
  
  // 检查API连接
  try {
    const response = await fetch(`${productionConfig.apiBaseUrl.replace('/api/v1', '')}/public/medicines/categories`);
    if (response.ok) {
      checks.push('✅ API 连接正常');
    } else {
      checks.push(`❌ API 连接失败: ${response.status}`);
    }
  } catch (error) {
    checks.push(`❌ API 连接错误: ${error}`);
  }
  
  // 检查构建配置
  if (process.env.NODE_ENV === 'production') {
    checks.push('✅ 生产环境构建');
  } else {
    checks.push('⚠️ 非生产环境构建');
  }
  
  return checks;
};
```

## 📞 技术支持和联系方式

### 🆘 获取帮助

1. **API问题**: 
   - 查看 `http://localhost:4000/api/docs` Swagger文档
   - 运行诊断: `runDiagnostics()` 函数

2. **集成问题**:
   - 参考本文档的完整示例
   - 检查浏览器开发者工具的网络和控制台

3. **性能问题**:
   - 使用性能监控Hook
   - 检查 `http://localhost:4000/dashboard/performance`

### 📋 快速检查清单

#### 开发环境设置
- [ ] 后端服务运行在 http://localhost:4000
- [ ] 数据库连接正常 (50种药品数据)
- [ ] API响应格式正确 `{ success, data, message, meta }`
- [ ] CORS配置允许前端域名

#### API集成验证
- [ ] 公共药品搜索API工作正常
- [ ] 分类API返回7个分类
- [ ] 搜索建议API响应及时
- [ ] 热门药品API返回数据

#### 前端功能测试
- [ ] 搜索功能支持中文、拼音、英文
- [ ] 分页功能正常工作
- [ ] 错误处理显示友好提示
- [ ] 加载状态正确显示

---

**文档维护**: 后端开发团队  
**最后更新**: 2025年7月10日 12:07 NZST - **Phase 2 完成 + 前端集成指南**  
**下次更新**: Phase 3开始后 (预计2025年7月17日)

**前端集成状态**: ✅ **完全就绪** - 包含完整示例、测试指南和故障排除方案

本文档将随着后端API的更新而同步更新，确保前后端开发的一致性。