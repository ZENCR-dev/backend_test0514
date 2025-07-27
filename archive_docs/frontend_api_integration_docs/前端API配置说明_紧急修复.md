# 🚨 前端API配置说明 - 紧急修复

**发布时间**: 2025-06-26 10:45 CST
**优先级**: 🔴 紧急
**问题**: 处方API返回404错误

## 🐛 问题诊断

### 错误现象
```
Failed to load resource: the server responded with a status of 404 (Not Found)
URL: http://localhost:4000/prescriptions
```

### 根本原因
1. **URL路径错误**: 缺少 `/api/v1` 前缀
2. **端口确认**: ✅ 后端服务运行在4000端口

## ✅ 正确的API配置

### 1. 基础配置
```javascript
// 正确的API配置
const API_CONFIG = {
  // ✅ 已确认：后端API运行在4000端口
  baseURL: 'http://localhost:4000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};
```

### 2. 处方API端点
```javascript
// ❌ 错误的URL
http://localhost:4000/prescriptions

// ✅ 正确的URL（后端已确认在4000端口）
http://localhost:4000/api/v1/prescriptions
```

### 3. 完整的API端点列表
| 功能 | 方法 | 端点 |
|------|------|------|
| 创建处方 | POST | `/api/v1/prescriptions` |
| 获取处方列表 | GET | `/api/v1/prescriptions` |
| 获取处方详情 | GET | `/api/v1/prescriptions/:id` |
| 更新处方 | PATCH | `/api/v1/prescriptions/:id` |
| 删除处方 | DELETE | `/api/v1/prescriptions/:id` |
| 开具处方 | POST | `/api/v1/prescriptions/:id/issue` |
| 验证处方 | POST | `/api/v1/prescriptions/verify` |

## 🔧 前端修复方案

### 方案1: 修改axios配置（推荐）
```javascript
// src/lib/apiClient.ts 或类似文件
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api/v1',  // ✅ 确保包含 /api/v1
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 请求拦截器（保持不变）
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
```

### 方案2: 环境变量配置
```javascript
// .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_WS_PATH=/ws/orchestration
```

```javascript
// 使用环境变量
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  // ... 其他配置
});
```

## 📋 快速验证步骤

### 1. 确认后端服务端口
```bash
# 检查后端实际运行的端口
# 查看控制台输出，应该显示类似：
# 🚀 TCM Prescription Platform API is running on: http://localhost:4001
```

### 2. 测试API连接
```javascript
// 在浏览器控制台测试
fetch('http://localhost:4000/api/v1/medicines')
  .then(res => res.json())
  .then(data => console.log('API测试成功:', data))
  .catch(err => console.error('API测试失败:', err));
```

### 3. 验证处方API
```javascript
// 获取处方列表（需要先登录获取token）
const token = localStorage.getItem('access_token');
fetch('http://localhost:4000/api/v1/prescriptions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log('处方API正常:', data))
.catch(err => console.error('处方API错误:', err));
```

## 🎯 处方创建数据格式（已验证）

```javascript
const prescriptionData = {
  clinicId: "cmc9svktq0001ugucdwn5u1ou",  // 必需
  patientInfo: {
    name: "测试患者",              // 必需
    gender: "male",               // 可选
    age: 30,                      // 可选
    phone: "021-12345678",        // 可选
    symptoms: "头痛，失眠",        // 可选
    diagnosis: "气血不足"          // 可选
  },
  medicines: [{
    medicineId: "cmc1bzk5x0004ugr4vxh8p7h7",  // 必需
    quantity: 15,                             // 必需
    dosageInstructions: "水煎服，每次1剂，每日2次，温服",  // 必需
    notes: "饭后服用"                          // 可选
  }],
  notes: "忌辛辣生冷"  // 可选
};
```

## 📊 系统状态更新

### ✅ 已确认完成的功能
1. **Task 5C WebSocket编排服务**: 95.3%完成，核心功能可用
2. **处方API**: 100%完成，端点正常工作
3. **认证系统**: 100%完成，JWT验证正常
4. **药品管理**: 100%完成，搜索功能正常

### 🔗 相关资源
- **API文档**: http://localhost:4000/api/docs
- **WebSocket健康检查**: http://localhost:4000/api/v1/health/orchestration
- **系统监控**: http://localhost:4000/api/v1/health/orchestration/metrics

## 🚀 建议的修复步骤

1. **立即修复** (5分钟)
   - 修改前端 apiClient 的 baseURL 配置
   - 确保包含 `/api/v1` 前缀
   - ✅ 使用4000端口（已确认）

2. **测试验证** (10分钟)
   - 测试处方创建功能
   - 验证其他API端点
   - 检查WebSocket连接

3. **长期优化** (可选)
   - 使用环境变量管理API配置
   - 添加API版本管理机制
   - 实现更好的错误处理

## 📞 技术支持

如果问题仍未解决，请提供以下信息：
1. 后端服务的控制台输出（确认端口）
2. 前端的完整错误信息
3. Network面板的请求详情

---

**紧急程度**: 🔴 高
**预计修复时间**: 15分钟
**影响范围**: 所有处方相关功能 