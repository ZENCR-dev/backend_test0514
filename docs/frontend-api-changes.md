# 前端API变更报告 - Clinic依赖移除

## 📋 变更概述

**项目**: 新西兰中医药电子处方平台  
**变更类型**: Breaking Changes  
**影响范围**: 订单相关API接口  
**生效时间**: 2025-06-28  
**版本**: v2.0.0

---

## 🚨 重要提醒

本次更新包含**破坏性变更**，所有涉及订单创建和查询的前端代码都需要更新。

---

## 📊 API接口变更详情

### 1. 创建订单 API

**端点**: `POST /api/v1/orders`

#### ❌ 旧版本 (已废弃)
```typescript
interface CreateOrderRequest {
  clinicId: string;        // ❌ 已移除
  practitionerId: string;
  patientInfo: PatientInfo;
  totalAmount: number;
  items: OrderItem[];
  notes?: string;
  idempotencyKey?: string;
}
```

#### ✅ 新版本 (当前)
```typescript
interface CreateOrderRequest {
  // clinicId 字段已完全移除
  practitionerId: string;  // ✅ 保持不变
  items: OrderItem[];      // ✅ 包含 medicineId, quantity, unitPrice, dosageInstructions(可选)
  notes?: string;
  idempotencyKey?: string;
  // 注意：MVP阶段不使用以下字段
  // patientInfo?: PatientInfo;  // 代码中存在但MVP不使用
  // totalAmount?: number;       // 后端自动计算，前端无需传递
}
```

#### 📝 迁移示例
```typescript
// ❌ 旧代码
const createOrder = async (orderData) => {
  return await api.post('/orders', {
    clinicId: user.clinicId,  // ❌ 移除此行
    practitionerId: user.id,
    patientInfo: orderData.patientInfo,  // ❌ MVP阶段不使用
    totalAmount: orderData.totalAmount,  // ❌ 后端自动计算
    // ... 其他字段
  });
};

// ✅ 新代码 (MVP版本)
const createOrder = async (orderData) => {
  return await api.post('/orders', {
    practitionerId: user.id,  // ✅ 直接使用医生ID
    items: orderData.items.map(item => ({
      medicineId: item.medicineId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      dosageInstructions: item.dosageInstructions, // 可选字段
    })),
    notes: orderData.notes,
    idempotencyKey: orderData.idempotencyKey,
    // 注意：MVP阶段不传递 patientInfo 和 totalAmount
  });
};
```

### 2. 查询订单 API

**端点**: `GET /api/v1/orders`

#### ❌ 旧版本查询参数
```typescript
interface OrderQueryParams {
  clinicId?: string;      // ❌ 已移除
  practitionerId?: string;
  status?: OrderStatus;
  page?: number;
  limit?: number;
}
```

#### ✅ 新版本查询参数
```typescript
interface OrderQueryParams {
  // clinicId 参数已完全移除
  practitionerId?: string; // ✅ 保持不变
  status?: OrderStatus;
  page?: number;
  limit?: number;
}
```

### 3. 订单响应数据结构

#### ❌ 旧版本响应
```typescript
interface OrderResponse {
  id: string;
  platformOrderId: string;
  clinicId: string;        // ❌ 已移除
  practitionerId: string;
  patientInfo: PatientInfo;
  // ... 其他字段
}
```

#### ✅ 新版本响应
```typescript
interface OrderResponse {
  id: string;
  platformOrderId: string;
  // clinicId 字段已完全移除
  practitionerId: string;  // ✅ 保持不变
  patientInfo: PatientInfo;
  status: OrderStatus;
  totalAmount: number;     // 📝 系统自动计算的订单总金额
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔧 前端代码迁移指南

### Step 1: 更新类型定义

```typescript
// 文件: types/order.ts

// ❌ 删除这些类型定义
interface OldCreateOrderRequest {
  clinicId: string;  // 删除
  // ...
}

// ✅ 更新为新的类型定义 (MVP版本)
interface CreateOrderRequest {
  practitionerId: string;
  items: OrderItem[];      // 详细结构见下方
  notes?: string;
  idempotencyKey?: string;
  // MVP阶段不使用的字段：
  // patientInfo?: PatientInfo;  // 代码存在但不使用
  // totalAmount?: number;       // 后端自动计算
}

interface OrderItem {
  medicineId: string;
  quantity: number;
  unitPrice: number;
  dosageInstructions?: string;  // MVP阶段可用的可选字段
}

interface OrderResponse {
  id: string;
  platformOrderId: string;
  practitionerId: string;  // 保留
  status: OrderStatus;
  totalAmount: number;     // 📝 系统自动计算的订单总金额
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}
```

### Step 2: 更新API调用

```typescript
// 文件: services/orderService.ts

class OrderService {
  // ✅ 更新创建订单方法 (MVP版本)
  async createOrder(orderData: CreateOrderRequest) {
    // 移除 clinicId 相关逻辑
    return await this.api.post('/orders', {
      practitionerId: orderData.practitionerId,
      items: orderData.items.map(item => ({
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        dosageInstructions: item.dosageInstructions, // 可选
      })),
      notes: orderData.notes,
      idempotencyKey: orderData.idempotencyKey,
      // MVP阶段注意事项：
      // - 不传递 patientInfo（代码存在但MVP不使用）
      // - 不传递 totalAmount（后端根据items自动计算）
    });
  }

  // ✅ 更新查询订单方法
  async getOrders(params: OrderQueryParams) {
    // 移除 clinicId 查询参数
    const queryParams = {
      practitionerId: params.practitionerId,
      status: params.status,
      page: params.page,
      limit: params.limit,
    };
    
    return await this.api.get('/orders', { params: queryParams });
  }
}
```

### Step 3: 更新组件代码

```typescript
// 文件: components/CreateOrderForm.tsx

const CreateOrderForm = () => {
  const { user } = useAuth();
  
  const handleSubmit = async (formData) => {
    const orderData = {
      // ❌ 移除 clinicId
      // clinicId: user.clinicId,
      
      // ✅ 直接使用医生ID (MVP版本)
      practitionerId: user.id,
      items: formData.items.map(item => ({
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        dosageInstructions: item.dosageInstructions, // 可选字段
      })),
      notes: formData.notes,
      idempotencyKey: `order_${Date.now()}_${user.id}`,
      // MVP阶段注意：
      // - 不传递 patientInfo（后续版本使用）
      // - 不传递 totalAmount（后端自动计算）
    };
    
    await orderService.createOrder(orderData);
  };
  
  // ... 组件渲染逻辑
};
```

### Step 4: 更新状态管理

```typescript
// 文件: store/orderStore.ts

interface OrderState {
  orders: OrderResponse[];
  // ❌ 移除 clinic 相关状态
  // selectedClinicId: string;
  
  // ✅ 保留 practitioner 相关状态
  selectedPractitionerId: string;
}

const orderStore = {
  // ✅ 更新获取订单的action
  async fetchOrders(practitionerId: string) {
    const response = await orderService.getOrders({
      practitionerId,  // 使用医生ID而非诊所ID
    });
    
    this.orders = response.data;
  },
};
```

---

## 🎯 MVP阶段特殊说明

### 字段使用状态

| 字段 | 状态 | 说明 |
|------|------|------|
| `practitionerId` | ✅ 使用 | 必填，医师执业ID |
| `items[]` | ✅ 使用 | 必填，订单药品清单 |
| `items[].medicineId` | ✅ 使用 | 必填，药品ID |
| `items[].quantity` | ✅ 使用 | 必填，数量 |
| `items[].unitPrice` | ✅ 使用 | 必填，单价 |
| `items[].dosageInstructions` | ✅ 可用 | 可选，用药说明 |
| `notes` | ✅ 使用 | 可选，备注信息 |
| `idempotencyKey` | ✅ 使用 | 必填，防重复提交 |
| `patientInfo` | ❌ MVP不用 | 代码存在但MVP阶段不使用 |
| `totalAmount` | ❌ 后端计算 | 后端根据items自动计算 |

### MVP版本API调用示例

```typescript
// ✅ MVP阶段的正确API调用
const orderData = {
  practitionerId: "practitioner_123",
  items: [
    {
      medicineId: "medicine_001",
      quantity: 30,
      unitPrice: 0.2,
      dosageInstructions: "每日三次，饭后服用" // 可选
    },
    {
      medicineId: "medicine_002", 
      quantity: 15,
      unitPrice: 0.15
      // dosageInstructions 可以省略
    }
  ],
  notes: "急需配送",
  idempotencyKey: "order_20250628_123456"
  // 注意：不包含 patientInfo 和 totalAmount
};

const response = await api.post('/api/v1/orders', orderData);
// 响应中会包含后端计算的 totalAmount
```

---

## ⚠️ 注意事项

### 1. 权限控制变更
- **医生用户**: 现在只能访问自己创建的订单
- **管理员用户**: 可以访问所有医生的订单
- **前端需要相应调整权限检查逻辑**

### 2. 数据过滤逻辑
```typescript
// ❌ 旧的过滤逻辑
const filterOrdersByClinic = (orders, clinicId) => {
  return orders.filter(order => order.clinicId === clinicId);
};

// ✅ 新的过滤逻辑
const filterOrdersByPractitioner = (orders, practitionerId) => {
  return orders.filter(order => order.practitionerId === practitionerId);
};
```

### 3. 缓存键更新
```typescript
// ❌ 旧的缓存键
const cacheKey = `orders_clinic_${clinicId}`;

// ✅ 新的缓存键
const cacheKey = `orders_practitioner_${practitionerId}`;
```

---

## 🧪 测试要求

### 1. 单元测试更新
```typescript
// 更新所有涉及 clinicId 的测试用例
describe('OrderService', () => {
  it('should create order without clinicId', async () => {
    const orderData = {
      practitionerId: 'practitioner-123',
      // 确保不包含 clinicId
      patientInfo: mockPatientInfo,
      totalAmount: 100,
      items: mockItems,
    };
    
    const result = await orderService.createOrder(orderData);
    expect(result.practitionerId).toBe('practitioner-123');
    expect(result.clinicId).toBeUndefined(); // 确保没有 clinicId
  });
});
```

### 2. 集成测试检查点
- ✅ 订单创建流程无 clinicId 参数
- ✅ 订单查询结果不包含 clinicId 字段
- ✅ 权限控制基于 practitionerId
- ✅ 数据过滤逻辑正确

---

## 📅 迁移时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| Phase 1 | 更新类型定义 | 1小时 | 前端团队 |
| Phase 2 | 更新API服务层 | 2小时 | 前端团队 |
| Phase 3 | 更新组件代码 | 3小时 | 前端团队 |
| Phase 4 | 更新测试用例 | 2小时 | 前端团队 |
| Phase 5 | 集成测试验证 | 1小时 | 前端+后端 |

**总计**: 约 9 小时

---

## 🆘 技术支持

如有任何问题，请联系：
- **后端技术支持**: 后端开发团队
- **API文档**: [API文档链接]
- **问题反馈**: 通过项目Issue系统

---

## ✅ 迁移检查清单

### 核心变更
- [ ] 更新所有订单相关的TypeScript类型定义
- [ ] 移除所有 `clinicId` 相关的API调用
- [ ] 更新订单创建表单组件
- [ ] 更新订单列表查询逻辑
- [ ] 更新权限检查逻辑
- [ ] 更新状态管理store
- [ ] 更新缓存键策略

### MVP阶段特殊检查
- [ ] 确认前端不传递 `patientInfo` 字段
- [ ] 确认前端不传递 `totalAmount` 字段
- [ ] 验证 `dosageInstructions` 作为可选字段正确处理
- [ ] 确认 `idempotencyKey` 生成逻辑正确
- [ ] 验证后端返回的 `totalAmount` 正确显示

### 测试验证
- [ ] 更新单元测试
- [ ] 执行集成测试
- [ ] 验证MVP功能完整性
- [ ] 验证生产环境兼容性

---

**文档版本**: v1.0  
**最后更新**: 2025-06-28  
**维护者**: 后端开发团队 