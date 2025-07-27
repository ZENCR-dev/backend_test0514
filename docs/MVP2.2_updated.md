# MVP 2.2 - 医师端前端开发指导文档

## 📋 文档概述

本文档为医师端前端开发团队提供完整的开发指导，基于后端Stage 3.2代码优化和质量验证完成的稳定API基础。前端团队现在可以立即开始完整的医师端界面开发。

**文档版本**：2.0  
**创建日期**：2025年7月12日  
**最后更新**：2025年7月12日 23:25  
**所属模块**：MVP 2.2 - 医师端前端  
**预计工期**：第1周（根据第二螺旋4周计划）  
**前置依赖**：✅ MVP 2.1 后端API 100%完成

---

## 🎯 MVP 2.2 开发任务清单

根据前端团队便签明确的第1周任务，MVP 2.2需要完成以下核心功能：

### 🔥 **第1周核心任务**

1. **🔐 登录/注册界面** → 使用现有认证API
2. **📝 处方创建表单** → 集成药品搜索API  
3. **💰 余额支付流程** → 集成支付API

### 📊 **后端支持状态确认**

- ✅ **后端服务稳定运行**：`npm run start:dev` (端口4000)
- ✅ **API文档完整同步**：`http://localhost:4000/api/docs`
- ✅ **测试数据准备完毕**：284个测试通过，95.23%覆盖率
- ✅ **开发环境配置就绪**：自动迁移，无需手动配置

---

## 🔌 MVP 2.2 专用API接口清单

### **医师端MVP 2.2 可用接口**

```typescript
// 认证管理 (登录/注册界面使用)
POST   /api/v1/auth/login              // 医师登录
POST   /api/v1/auth/register           // 医师注册  
POST   /api/v1/auth/refresh            // 刷新Token
GET    /api/v1/auth/profile            // 获取用户信息

// 处方管理 (处方创建表单使用)
POST   /api/v1/prescriptions           // 创建处方
GET    /api/v1/prescriptions           // 查询历史处方  
GET    /api/v1/prescriptions/:id       // 获取处方详情
PATCH  /api/v1/prescriptions/:id       // 更新处方
POST   /api/v1/prescriptions/:id/issue // 确认开方

// 药品搜索 (处方创建表单使用)
GET    /public/medicines               // 公共药品搜索
GET    /public/medicines/categories    // 药品分类
GET    /public/medicines/popular       // 热门药品
GET    /public/medicines/search/suggestions  // 搜索建议

// 账户管理 (余额支付流程使用)
GET    /api/v1/practitioner-account/balance      // 查询余额
POST   /api/v1/practitioner-account/recharge     // 充值
GET    /api/v1/practitioner-account/transactions // 交易记录

// 支付功能 (余额支付流程使用)
POST   /api/v1/prescriptions/:id/pay-with-balance // 余额支付
POST   /api/v1/payments/stripe/create-intent      // Stripe支付
```

---

## 🔐 任务1：登录/注册界面开发

### **功能目标**
创建完整的医师认证界面，支持登录、注册和状态管理。

### **界面要求**

#### 1.1 登录界面
**必需元素**：
- 邮箱/用户名输入框
- 密码输入框（支持显示/隐藏）
- "记住登录"复选框
- 登录按钮（防重复点击）
- "忘记密码"链接
- 注册入口链接

**交互要求**：
- 实时表单验证
- 登录中状态显示
- 错误信息友好提示
- 支持回车键提交
- 自动focus第一个输入框

#### 1.2 注册界面
**必需元素**：
- 姓名输入框
- 邮箱输入框（唯一性验证）
- 密码输入框（强度指示）
- 确认密码输入框
- 医师执照号输入框
- 用户协议复选框
- 注册按钮

**验证要求**：
- 邮箱格式验证
- 密码强度要求（8位，包含数字字母）
- 两次密码一致性验证
- 医师执照号格式验证

### **API集成**

#### 登录API调用
```typescript
// POST /api/v1/auth/login
const loginRequest = {
  email: string,
  password: string,
  rememberMe?: boolean
}

const loginResponse = {
  success: boolean,
  data: {
    token: string,
    refreshToken: string,
    user: {
      id: string,
      name: string,
      email: string,
      role: string
    }
  }
}
```

#### 注册API调用
```typescript
// POST /api/v1/auth/register
const registerRequest = {
  name: string,
  email: string,
  password: string,
  licenseNumber: string
}
```

### **状态管理要求**
- Token存储（localStorage/sessionStorage）
- 用户信息全局状态
- 登录状态持久化
- 自动Token刷新机制

### **测试用例**
- ✅ 正确登录凭据验证
- ✅ 错误凭据处理
- ✅ 注册表单验证
- ✅ 重复邮箱提示
- ✅ Token过期自动刷新
- ✅ 移动端适配

---

## 📝 任务2：处方创建表单开发

### **功能目标**
创建完整的处方创建界面，集成药品搜索、处方信息填写和提交功能。

### **界面要求**

#### 2.1 药品搜索区域
**必需元素**：
- 搜索输入框（支持中文/拼音）
- 搜索建议下拉列表
- 药品分类筛选
- 热门药品快速选择
- 已选药品清单

**交互要求**：
- 300ms防抖搜索
- 实时搜索建议
- 搜索结果高亮
- 药品快速添加/删除
- 数量调整组件

#### 2.2 处方信息区域
**必需元素**：
- 帖数输入框（1-30范围）
- 总克重显示（自动计算）
- 总价格显示（实时计算）
- 医嘱文本域
- 常用医嘱模板选择
- 处方预览功能

#### 2.3 表单操作区域
**必需元素**：
- 保存草稿按钮
- 提交处方按钮
- 清空重置按钮
- 表单验证提示
- 提交确认弹窗

### **API集成**

#### 药品搜索集成
```typescript
// 搜索药品
GET /public/medicines?search=${query}&page=1&limit=20

// 搜索建议
GET /public/medicines/search/suggestions?q=${query}&limit=5

// 药品分类
GET /public/medicines/categories

// 热门药品
GET /public/medicines/popular?limit=10
```

#### 处方创建集成
```typescript
// POST /api/v1/prescriptions
const prescriptionRequest = {
  medicines: [
    {
      medicineId: string,
      weight: number,    // 克重
      notes: string      // 用法说明
    }
  ],
  copies: number,        // 帖数
  notes: string         // 医嘱
}

const prescriptionResponse = {
  success: boolean,
  data: {
    id: string,
    prescriptionId: string,  // RX-YYYYMMDD-序号
    doctorId: string,
    copies: number,
    grossWeight: number,     // 总克重
    netPrice: number,        // 总价格
    status: 'DRAFT',
    medicines: Array,
    qrCodeData: null,
    createdAt: Date
  }
}
```

### **前端集成Hook示例**

#### 药品搜索Hook
```typescript
const useMedicineSearch = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const searchMedicines = async (params) => {
    setLoading(true);
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/public/medicines?${queryString}`);
      const data = await response.json();
      
      if (data.success) {
        setMedicines(data.data.medicines);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestions = async (query) => {
    if (query.length > 0) {
      const response = await fetch(`/public/medicines/search/suggestions?q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      if (data.success) {
        setSuggestions(data.data.suggestions);
      }
    }
  };

  return { medicines, loading, suggestions, searchMedicines, getSuggestions };
};
```

#### 处方创建Hook
```typescript
const usePrescriptionCreate = () => {
  const [prescription, setPrescription] = useState({
    medicines: [],
    copies: 1,
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const addMedicine = (medicine) => {
    setPrescription(prev => ({
      ...prev,
      medicines: [...prev.medicines, { 
        medicineId: medicine.id,
        weight: 15, // 默认15g
        notes: ''
      }]
    }));
  };

  const removeMedicine = (index) => {
    setPrescription(prev => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  };

  const submitPrescription = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/prescriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(prescription)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('提交失败:', error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return { 
    prescription, 
    setPrescription, 
    addMedicine, 
    removeMedicine, 
    submitPrescription, 
    submitting 
  };
};
```

### **测试用例**
- ✅ 药品搜索功能
- ✅ 搜索建议准确性
- ✅ 药品添加/删除
- ✅ 金额计算正确性
- ✅ 表单验证完整性
- ✅ 处方提交流程

---

## 💰 任务3：余额支付流程开发

### **功能目标**
创建完整的支付流程界面，支持余额支付和Stripe充值。

### **界面要求**

#### 3.1 余额支付界面
**必需元素**：
- 处方信息摘要
- 当前余额显示
- 支付金额显示
- 余额充足状态指示
- 支付确认按钮
- 支付密码输入（如需要）

#### 3.2 支付状态界面
**必需元素**：
- 支付处理中动画
- 支付结果展示
- 处方状态更新
- 二维码生成显示
- 操作按钮（返回/打印）

#### 3.3 充值界面
**必需元素**：
- 充值金额选择/输入
- Stripe支付表单
- 充值记录查看
- 安全提示信息

### **API集成**

#### 余额查询
```typescript
// GET /api/v1/practitioner-account/balance
const balanceResponse = {
  success: boolean,
  data: {
    availableBalance: number,
    totalBalance: number,
    currency: 'NZD'
  }
}
```

#### 余额支付
```typescript
// POST /api/v1/prescriptions/:id/pay-with-balance
const paymentRequest = {
  prescriptionId: string,
  amount: number
}

const paymentResponse = {
  success: boolean,
  data: {
    transactionId: string,
    status: 'COMPLETED' | 'FAILED',
    prescription: {
      id: string,
      status: 'PAID',
      qrCodeData: string
    }
  }
}
```

#### Stripe充值
```typescript
// POST /api/v1/payments/stripe/create-intent
const rechargeRequest = {
  amount: number,  // 充值金额（分）
  currency: 'nzd'
}

const rechargeResponse = {
  success: boolean,
  data: {
    clientSecret: string,
    paymentIntentId: string
  }
}
```

### **支付流程状态管理**
```typescript
const usePaymentFlow = () => {
  const [paymentState, setPaymentState] = useState({
    step: 'SELECT', // SELECT | CONFIRM | PROCESSING | SUCCESS | FAILED
    prescription: null,
    balance: null,
    isProcessing: false
  });

  const checkBalance = async () => {
    const response = await fetch('/api/v1/practitioner-account/balance', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    if (data.success) {
      setPaymentState(prev => ({ ...prev, balance: data.data }));
    }
  };

  const payWithBalance = async (prescriptionId, amount) => {
    setPaymentState(prev => ({ ...prev, step: 'PROCESSING', isProcessing: true }));
    
    try {
      const response = await fetch(`/api/v1/prescriptions/${prescriptionId}/pay-with-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ prescriptionId, amount })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPaymentState(prev => ({ 
          ...prev, 
          step: 'SUCCESS', 
          prescription: data.data.prescription 
        }));
      } else {
        setPaymentState(prev => ({ ...prev, step: 'FAILED' }));
      }
    } catch (error) {
      setPaymentState(prev => ({ ...prev, step: 'FAILED' }));
    } finally {
      setPaymentState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  return { paymentState, checkBalance, payWithBalance };
};
```

### **WebSocket实时通知集成**
```typescript
const usePaymentNotifications = () => {
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:4000/websocket');
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // 余额更新通知
      if (data.type === 'balance.updated') {
        // 更新余额显示
        updateBalance(data.data.newBalance);
      }
      
      // 处方支付完成通知
      if (data.type === 'prescription.paid') {
        // 更新处方状态
        updatePrescriptionStatus(data.data.prescriptionId, 'PAID');
      }
    };

    return () => socket.close();
  }, []);
};
```

### **测试用例**
- ✅ 余额查询正确性
- ✅ 余额不足提示
- ✅ 支付流程完整性
- ✅ Stripe充值集成
- ✅ 实时状态更新
- ✅ 错误处理机制

---

## 🎨 UI/UX设计要求

### **响应式设计**
- **桌面端**：1920×1080为主要设计尺寸
- **平板端**：768-1024px适配
- **移动端**：基础功能可用（创建处方可能需要桌面端）

### **性能指标**
- 首屏加载时间：< 3秒
- 路由切换：< 300ms
- API调用响应：< 500ms（含加载状态）
- 药品搜索响应：< 200ms

### **用户体验要求**
- **加载状态**：所有异步操作显示加载动画
- **错误处理**：友好的错误提示，避免技术术语
- **操作反馈**：按钮点击、表单提交有即时反馈
- **数据保护**：表单自动保存草稿，防止数据丢失

### **无障碍设计**
- 键盘导航支持
- ARIA标签完善
- 色彩对比度符合WCAG 2.1 AA标准
- 字体大小支持浏览器缩放

---

## 📊 技术集成规范

### **认证Token管理**
```typescript
// Token存储
const TokenService = {
  setToken: (token: string) => localStorage.setItem('auth_token', token),
  getToken: () => localStorage.getItem('auth_token'),
  removeToken: () => localStorage.removeItem('auth_token'),
  
  // 自动刷新Token
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refreshToken}` }
    });
    const data = await response.json();
    if (data.success) {
      TokenService.setToken(data.data.token);
    }
  }
};
```

### **API请求拦截器**
```typescript
// 统一API请求配置
const apiClient = {
  request: async (url: string, options: RequestInit = {}) => {
    const token = TokenService.getToken();
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    };

    try {
      const response = await fetch(`/api/v1${url}`, config);
      
      // Token过期自动刷新
      if (response.status === 401) {
        await TokenService.refreshToken();
        const newToken = TokenService.getToken();
        config.headers['Authorization'] = `Bearer ${newToken}`;
        return fetch(`/api/v1${url}`, config);
      }
      
      return response;
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  }
};
```

### **错误处理规范**
```typescript
// 统一错误处理
const handleApiError = (error: any) => {
  if (error.response) {
    const { status, data } = error.response;
    switch (status) {
      case 400:
        showToast(data.message || '请求参数错误', 'error');
        break;
      case 401:
        showToast('登录已过期，请重新登录', 'error');
        // 跳转到登录页
        break;
      case 403:
        showToast('权限不足', 'error');
        break;
      case 500:
        showToast('服务器错误，请稍后重试', 'error');
        break;
      default:
        showToast('操作失败，请重试', 'error');
    }
  } else {
    showToast('网络连接失败，请检查网络', 'error');
  }
};
```

---

## 🧪 测试要求

### **单元测试覆盖**
- **组件测试**：每个主要组件 > 80%覆盖率
- **Hook测试**：所有自定义Hook 100%覆盖
- **工具函数**：API调用、数据处理函数 100%覆盖

### **集成测试要求**
- 登录/注册完整流程
- 处方创建完整流程
- 支付完整流程
- API错误处理测试

### **E2E测试场景**
- 医师登录 → 创建处方 → 余额支付 → 查看二维码
- 医师注册 → 首次登录 → 充值 → 创建处方
- 网络中断 → 恢复 → 数据同步

---

## 📅 第1周开发里程碑

### **Day 1-2：项目基础设置**
- 项目架构搭建
- 路由配置
- 状态管理设置
- API请求封装
- 基础组件开发

### **Day 3-4：核心功能开发**
- 登录/注册界面完成
- 处方创建表单开发
- 药品搜索集成

### **Day 5-7：支付功能与优化**
- 余额支付流程完成
- Stripe充值集成
- 单元测试编写
- 功能联调测试

---

## 🔗 后端联调支持

### **后端服务信息**
- **服务地址**：`http://localhost:4000`
- **API文档**：`http://localhost:4000/api/docs`
- **WebSocket**：`ws://localhost:4000/websocket`
- **启动命令**：`npm run start:dev`

### **测试数据支持**
- 测试医师账号：由后端团队提供
- 测试药品数据：441种药品已准备
- 测试支付数据：模拟充值和支付环境

### **技术支持渠道**
- **实时沟通**：开发期间实时技术答疑
- **API调试**：提供详细请求/响应日志
- **数据同步**：协助解决数据一致性问题

---

## 🎯 交付标准

### **功能完整性检查**
- [ ] 登录/注册流程100%可用
- [ ] 处方创建表单完整功能
- [ ] 药品搜索准确快速
- [ ] 余额支付流程顺畅
- [ ] Stripe充值集成成功
- [ ] 实时通知正常工作

### **性能标准验证**
- [ ] 首屏加载 < 3秒
- [ ] API响应处理 < 500ms
- [ ] 搜索响应 < 200ms
- [ ] 移动端适配良好

### **代码质量标准**
- [ ] ESLint/Prettier检查通过
- [ ] TypeScript类型覆盖100%
- [ ] 单元测试覆盖率 > 80%
- [ ] 代码注释完整

---

## 📚 参考资源

### **API文档**
- **完整API文档**：`docs/Developer-Portal.md`
- **Swagger在线文档**：`http://localhost:4000/api/docs`
- **数据模型参考**：便签中的TypeScript接口定义

### **集成示例**
- **React Hook示例**：上述文档中的useMedicineSearch等
- **Vue Composition API**：可参考Developer-Portal.md
- **WebSocket集成**：实时通知系统示例

### **最佳实践**
- **错误处理模式**：统一的API错误处理
- **状态管理模式**：认证状态、支付状态管理
- **性能优化**：缓存、防抖、懒加载策略

---

**🎯 MVP 2.2开发目标：在第1周内完成医师端核心功能，为第2周药房端开发做好准备！**

本文档提供了MVP 2.2开发的完整指导，前端团队可立即基于稳定的后端API开始开发工作。如有技术问题，后端团队提供实时支持。