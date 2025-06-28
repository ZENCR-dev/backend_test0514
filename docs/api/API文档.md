# 新西兰中医药电子处方平台 API 文档

## API 概述

本文档详细说明了新西兰中医药电子处方平台的API接口，供前端开发团队参考。所有API均遵循RESTful设计原则，使用JSON格式进行数据交换。

### 基本信息

- **基础URL**: `http://localhost:4001`
- **API版本**: v1
- **API前缀**: `/api/v1`
- **内容类型**: `application/json`
- **Swagger文档**: `http://localhost:4001/api/docs`

### 认证方式

大部分API需要JWT令牌认证，请在HTTP请求头中添加：

```
Authorization: Bearer <your_jwt_token>
```

JWT令牌可通过登录API获取。

### 响应格式

所有API响应均使用以下标准格式：

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-06-22T10:00:00.000Z",
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

错误响应格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述信息",
    "details": { ... },
    "timestamp": "2025-06-22T10:00:00.000Z"
  }
}
```

## 认证API

### 登录

- **URL**: `/api/v1/auth/login`
- **方法**: POST
- **认证**: 不需要
- **描述**: 用户登录并获取JWT令牌

**请求体**:

```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_id",
      "email": "test@example.com",
      "role": "practitioner",
      "profile": {
        "fullName": "医生姓名",
        "licenseNumber": "TCM12345"
      }
    }
  }
}
```

### 注册

- **URL**: `/api/v1/auth/register`
- **方法**: POST
- **认证**: 不需要
- **描述**: 注册新用户

**请求体**:

```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "role": "practitioner",
  "profile": {
    "fullName": "新医生",
    "licenseNumber": "TCM67890"
  }
}
```

**响应**: 与登录API相同

### 获取当前用户信息

- **URL**: `/api/v1/auth/me`
- **方法**: GET
- **认证**: 需要JWT令牌
- **描述**: 获取当前登录用户信息

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "test@example.com",
    "role": "practitioner",
    "profile": {
      "fullName": "医生姓名",
      "licenseNumber": "TCM12345"
    }
  }
}
```

## 药品API

### 查询药品列表

- **URL**: `/api/v1/medicines`
- **方法**: GET
- **认证**: 不需要
- **描述**: 获取药品列表，支持搜索、分页和排序

**查询参数**:

- `search`: 搜索关键词（可选，支持中文名、拼音名、英文名搜索）
- `page`: 页码，默认为1
- `limit`: 每页记录数，默认为20，最大100
- `sortBy`: 排序字段，可选值：name, pinyinName, category, createdAt, updatedAt, basePrice
- `sortOrder`: 排序方向，可选值：asc, desc

**示例请求**:
```
GET /api/v1/medicines?search=五指毛桃&page=1&limit=15
```

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "medicine_id",
      "name": "五指毛桃",
      "chineseName": "五指毛桃",
      "englishName": "Radix Fici Simplicissimae",
      "pinyinName": "wuzhimoutao",
      "sku": "WZMT001",
      "description": "五指毛桃，中药材名，为桑科植物构树的根皮。",
      "category": "根类",
      "unit": "克",
      "requiresPrescription": true,
      "basePrice": 0.15,
      "status": "active",
      "createdAt": "2025-06-01T00:00:00.000Z",
      "updatedAt": "2025-06-01T00:00:00.000Z"
    }
    // 更多药品...
  ],
  "meta": {
    "timestamp": "2025-06-22T10:00:00.000Z",
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 15,
      "totalPages": 7
    }
  }
}
```

### 获取药品详情

- **URL**: `/api/v1/medicines/:id`
- **方法**: GET
- **认证**: 不需要
- **描述**: 获取单个药品的详细信息

**路径参数**:

- `id`: 药品ID

**示例请求**:
```
GET /api/v1/medicines/medicine_id
```

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "medicine_id",
    "name": "五指毛桃",
    "chineseName": "五指毛桃",
    "englishName": "Radix Fici Simplicissimae",
    "pinyinName": "wuzhimoutao",
    "sku": "WZMT001",
    "description": "五指毛桃，中药材名，为桑科植物构树的根皮。",
    "category": "根类",
    "unit": "克",
    "requiresPrescription": true,
    "basePrice": 0.15,
    "status": "active",
    "createdAt": "2025-06-01T00:00:00.000Z",
    "updatedAt": "2025-06-01T00:00:00.000Z"
  }
}
```

### 获取药品分类

- **URL**: `/api/v1/medicines/categories`
- **方法**: GET
- **认证**: 不需要
- **描述**: 获取所有药品分类及其数量

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "category": "根类",
      "count": 45
    },
    {
      "category": "叶类",
      "count": 32
    }
    // 更多分类...
  ]
}
```

## 处方API

> **重要提示**: 处方API的正确路径是 `/api/v1/prescriptions`，而不是 `/api/v1/api/v1/prescriptions`。请确保在控制器中使用正确的路径前缀。

### 创建处方

- **URL**: `/api/v1/prescriptions`
- **方法**: POST
- **认证**: 需要JWT令牌，仅限医生角色
- **描述**: 创建新处方

**请求体**:

```json
{
  "clinicId": "clinic_id",
  "patientInfo": {
    "name": "患者姓名",
    "age": 35,
    "gender": "female",
    "phone": "021-123-4567",
    "symptoms": "头痛、失眠",
    "diagnosis": "肝郁气滞"
  },
  "medicines": [
    {
      "medicineId": "medicine_id_1",
      "quantity": 30,
      "dosageInstructions": "水煎服，每日一剂"
    },
    {
      "medicineId": "medicine_id_2",
      "quantity": 15,
      "dosageInstructions": "研末，每次3克，每日两次",
      "notes": "饭后服用"
    }
  ],
  "notes": "忌辛辣刺激食物"
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "prescription_id",
    "prescriptionId": "TCM-2025-0001",
    "doctorId": "doctor_id",
    "clinicId": "clinic_id",
    "patientInfo": {
      "name": "患者姓名",
      "age": 35,
      "gender": "female",
      "phone": "021-123-4567",
      "symptoms": "头痛、失眠",
      "diagnosis": "肝郁气滞"
    },
    "medicines": [
      {
        "medicineId": "medicine_id_1",
        "medicineName": "当归",
        "chineseName": "当归",
        "quantity": 30,
        "unitPrice": 0.2,
        "totalPrice": 6.0,
        "dosageInstructions": "水煎服，每日一剂",
        "unit": "克"
      },
      {
        "medicineId": "medicine_id_2",
        "medicineName": "白芍",
        "chineseName": "白芍",
        "quantity": 15,
        "unitPrice": 0.15,
        "totalPrice": 2.25,
        "dosageInstructions": "研末，每次3克，每日两次",
        "notes": "饭后服用",
        "unit": "克"
      }
    ],
    "status": "created",
    "totalAmount": 8.25,
    "notes": "忌辛辣刺激食物",
    "qrCodeData": "data:image/png;base64,...",
    "createdAt": "2025-06-22T10:00:00.000Z",
    "updatedAt": "2025-06-22T10:00:00.000Z"
  },
  "message": "处方创建成功"
}
```

### 获取处方列表

- **URL**: `/api/v1/prescriptions`
- **方法**: GET
- **认证**: 需要JWT令牌
- **描述**: 获取当前医生的处方列表

**查询参数**:

- `page`: 页码，默认为1
- `limit`: 每页记录数，默认为20

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "prescription_id_1",
      "prescriptionId": "TCM-2025-0001",
      "patientInfo": {
        "name": "患者1"
      },
      "status": "created",
      "totalAmount": 8.25,
      "createdAt": "2025-06-22T10:00:00.000Z"
    },
    {
      "id": "prescription_id_2",
      "prescriptionId": "TCM-2025-0002",
      "patientInfo": {
        "name": "患者2"
      },
      "status": "issued",
      "totalAmount": 12.50,
      "createdAt": "2025-06-21T10:00:00.000Z"
    }
    // 更多处方...
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### 获取处方详情

- **URL**: `/api/v1/prescriptions/:id`
- **方法**: GET
- **认证**: 需要JWT令牌
- **描述**: 获取处方详情

**路径参数**:

- `id`: 处方ID

**响应**: 与创建处方API的响应格式相同

### 更新处方状态

- **URL**: `/api/v1/prescriptions/:id/status`
- **方法**: PATCH
- **认证**: 需要JWT令牌
- **描述**: 更新处方状态

**路径参数**:

- `id`: 处方ID

**请求体**:

```json
{
  "status": "issued"
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "prescription_id",
    "status": "issued",
    "updatedAt": "2025-06-22T11:00:00.000Z"
  },
  "message": "处方状态已更新"
}
```

### 签发处方

- **URL**: `/api/v1/prescriptions/:id/issue`
- **方法**: POST
- **认证**: 需要JWT令牌，仅限医生角色
- **描述**: 签发处方，生成处方二维码

**路径参数**:

- `id`: 处方ID

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "prescription_id",
    "status": "issued",
    "qrCodeData": "data:image/png;base64,...",
    "updatedAt": "2025-06-22T11:00:00.000Z"
  },
  "message": "处方已签发"
}
```

### 验证处方

- **URL**: `/api/v1/prescriptions/verify`
- **方法**: POST
- **认证**: 需要JWT令牌，仅限药房操作员角色
- **描述**: 验证处方的有效性

**请求体**:

```json
{
  "prescriptionId": "TCM-2025-0001"
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "prescription": {
      // 处方详细信息...
    }
  },
  "message": "处方有效"
}
```

## 订单API

### 创建订单

- **URL**: `/api/v1/orders`
- **方法**: POST
- **认证**: 需要JWT令牌
- **描述**: 创建新订单

**请求体**:

```json
{
  "practitionerId": "practitioner_id",
  "items": [
    {
      "medicineId": "medicine_id_1",
      "quantity": 30,
      "unitPrice": 0.2,
      "dosageInstructions": "每日三次，饭后服用"  // 可选字段
    },
    {
      "medicineId": "medicine_id_2",
      "quantity": 15,
      "unitPrice": 0.15,
      "dosageInstructions": "每日两次，睡前服用"  // 可选字段
    }
  ],
  "notes": "急需配送",
  "idempotencyKey": "order_20250628_123456"
}
```

**MVP阶段说明**:
- `patientInfo`: 代码中存在但MVP阶段不使用
- `totalAmount`: 代码中存在但由后端自动计算，前端无需传递
- `dosageInstructions`: 可选字段，MVP阶段可使用

### 字段说明

| 字段 | 类型 | 必填 | 说明 | MVP状态 |
|------|------|------|------|---------|
| practitionerId | string | 是 | 执业医师ID | ✅ 使用 |
| items | array | 是 | 药品清单 | ✅ 使用 |
| items[].medicineId | string | 是 | 药品ID | ✅ 使用 |
| items[].quantity | number | 是 | 数量 | ✅ 使用 |
| items[].unitPrice | number | 是 | 单价 | ✅ 使用 |
| items[].dosageInstructions | string | 否 | 用药说明 | ✅ 可用 |
| notes | string | 否 | 备注信息 | ✅ 使用 |
| idempotencyKey | string | 是 | 幂等性键，防止重复提交 | ✅ 使用 |
| patientInfo | object | 否 | 患者信息 | ❌ MVP不用 |
| totalAmount | number | 否 | 总金额 | ❌ 后端计算 |
```

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "order_id",
    "orderId": "ORD-2025-0001",
    "status": "created",
    "totalAmount": 8.25,
    "items": [
      // 订单项详情...
    ],
    "createdAt": "2025-06-22T10:00:00.000Z"
  },
  "message": "订单创建成功"
}
```

### 获取订单列表

- **URL**: `/api/v1/orders`
- **方法**: GET
- **认证**: 需要JWT令牌
- **描述**: 获取当前用户的订单列表

**查询参数**:

- `page`: 页码，默认为1
- `limit`: 每页记录数，默认为20
- `status`: 订单状态过滤（可选）

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "order_id_1",
      "orderId": "ORD-2025-0001",
      "status": "created",
      "totalAmount": 8.25,
      "createdAt": "2025-06-22T10:00:00.000Z"
    },
    // 更多订单...
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 35,
    "totalPages": 2
  }
}
```

### 获取订单详情

- **URL**: `/api/v1/orders/:id`
- **方法**: GET
- **认证**: 需要JWT令牌
- **描述**: 获取订单详情

**路径参数**:

- `id`: 订单ID

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "order_id",
    "orderId": "ORD-2025-0001",
    "clinicId": "clinic_id",
    "status": "created",
    "totalAmount": 8.25,
    "items": [
      {
        "medicineId": "medicine_id_1",
        "medicineName": "当归",
        "quantity": 30,
        "unitPrice": 0.2,
        "totalPrice": 6.0
      },
      {
        "medicineId": "medicine_id_2",
        "medicineName": "白芍",
        "quantity": 15,
        "unitPrice": 0.15,
        "totalPrice": 2.25
      }
    ],
    "paymentMethod": "clinic_account",
    "paymentStatus": "pending",
    "notes": "急需配送",
    "createdAt": "2025-06-22T10:00:00.000Z",
    "updatedAt": "2025-06-22T10:00:00.000Z"
  }
}
```

## 诊所账户API

### 获取诊所账户列表

- **URL**: `/api/v1/clinic-accounts`
- **方法**: GET
- **认证**: 需要JWT令牌，仅限管理员角色
- **描述**: 获取所有诊所账户列表

**查询参数**:

- `page`: 页码，默认为1
- `limit`: 每页记录数，默认为20

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "clinic_account_id_1",
      "name": "诊所1",
      "balance": 1000.00,
      "status": "active",
      "createdAt": "2025-06-01T00:00:00.000Z"
    },
    // 更多诊所账户...
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

### 获取诊所账户详情

- **URL**: `/api/v1/clinic-accounts/:id`
- **方法**: GET
- **认证**: 需要JWT令牌
- **描述**: 获取诊所账户详情

**路径参数**:

- `id`: 诊所账户ID

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "clinic_account_id",
    "name": "诊所名称",
    "licenseNumber": "CL12345",
    "address": "诊所地址",
    "contactPhone": "021-987-6543",
    "contactEmail": "clinic@example.com",
    "balance": 1000.00,
    "status": "active",
    "createdAt": "2025-06-01T00:00:00.000Z",
    "updatedAt": "2025-06-01T00:00:00.000Z"
  }
}
```

### 获取诊所账户余额

- **URL**: `/api/v1/clinic-accounts/:id/balance`
- **方法**: GET
- **认证**: 需要JWT令牌
- **描述**: 获取诊所账户余额

**路径参数**:

- `id`: 诊所账户ID

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "clinic_account_id",
    "balance": 1000.00,
    "updatedAt": "2025-06-22T10:00:00.000Z"
  }
}
```

## 常见问题解答

### 1. 处方API返回404错误

如果处方API（`/api/v1/prescriptions`）返回404错误，请检查控制器中的路由前缀。由于系统已经在全局配置了API版本前缀，处方控制器应使用 `@Controller("prescriptions")` 而不是 `@Controller("api/v1/prescriptions")`。

### 2. 药品搜索API参数问题

药品搜索API使用 `search` 参数，而不是 `q` 参数。正确的请求格式应为：

```
GET /api/v1/medicines?search=五指毛桃&page=1&limit=15
```

### 3. 前端调用API的正确路径

前端应使用完整的API路径，包括API版本前缀，例如：

```javascript
// 正确的API调用
const response = await apiClient.get('/api/v1/medicines', { search: term, limit: 15 });

// 错误的API调用
const response = await apiClient.get('/medicines', { search: term, limit: 15 });
```

### 4. 认证问题

确保在需要认证的API请求中包含正确的JWT令牌：

```javascript
const response = await fetch('/api/v1/prescriptions', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});
```

## 附录：API路径对照表

| 功能 | 正确路径 | 错误路径 |
|------|---------|---------|
| 药品搜索 | `/api/v1/medicines?search=关键词` | `/medicines?search=关键词` 或 `/api/v1/medicines?q=关键词` |
| 处方创建 | `/api/v1/prescriptions` | `/api/v1/api/v1/prescriptions` |
| 处方列表 | `/api/v1/prescriptions` | `/api/v1/api/v1/prescriptions` |
| 处方验证 | `/api/v1/prescriptions/verify` | `/api/v1/api/v1/prescriptions/verify` | 