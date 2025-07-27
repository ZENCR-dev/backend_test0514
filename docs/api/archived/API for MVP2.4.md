# 药房端后端API文档 - MVP 2.4

## 📋 文档概述

本文档为药房端后端开发提供完整的API规范，包括处方扫码、履约凭证上传、采购订单生成、价目表管理和余额系统。

**文档版本**：1.0  
**创建日期**：2025年1月9日  
**基础URL**：`http://localhost:4000`  
**API前缀**：`/api/v1`

---

## 🔐 认证说明

所有API需要JWT认证，请在请求头中添加：
```
Authorization: Bearer <jwt_token>
```

用户角色要求：`pharmacy_operator`

---

## 📱 1. 处方扫码与验证

### 1.1 扫码获取处方信息
**端点**：`POST /api/v1/pharmacy/prescriptions/scan`  
**描述**：通过QR码扫描获取处方详细信息

**请求体**：
```json
{
  "qrCodeString": "PRESCRIPTION_QR_CODE_DATA",
  "pharmacyId": "pharmacy_id_here"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "prescription": {
      "id": "prescription_123",
      "practitionerId": "doctor_456",
      "patientInfo": {
        "name": "张三",
        "age": 35,
        "gender": "male"
      },
      "medicines": [
        {
          "medicineId": "med_001",
          "name": "当归",
          "quantity": 30,
          "unit": "克",
          "dosageInstructions": "每日三次，每次10克",
          "basePrice": 2.5
        }
      ],
      "status": "PAID",
      "totalAmount": 75.00,
      "createdAt": "2025-01-09T10:00:00Z"
    },
    "canFulfill": true,
    "message": "处方验证成功，可以履约"
  },
  "meta": {
    "timestamp": "2025-01-09T10:00:00Z"
  }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": {
    "code": "PRESCRIPTION_NOT_PAID",
    "message": "处方未支付，无法履约",
    "timestamp": "2025-01-09T10:00:00Z"
  }
}
```

### 1.2 获取待履约处方列表
**端点**：`GET /api/v1/pharmacy/prescriptions/pending`  
**描述**：获取所有已支付待履约的处方列表

**查询参数**：
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `timeRange`: 时间范围（today, week, month）

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "prescription_123",
      "patientName": "张三",
      "totalAmount": 75.00,
      "medicineCount": 3,
      "paidAt": "2025-01-09T09:30:00Z",
      "status": "PAID"
    }
  ],
  "meta": {
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "timestamp": "2025-01-09T10:00:00Z"
  }
}
```

---

## 📸 2. 履约凭证管理

### 2.1 上传履约凭证
**端点**：`POST /api/v1/pharmacy/fulfillments`  
**描述**：上传药包和电子秤照片作为履约凭证

**请求体**（multipart/form-data）：
- `orderId`: 订单ID
- `packagePhoto`: 药包照片文件
- `scalePhoto`: 电子秤照片文件
- `actualWeight`: 实际重量（克）
- `notes`: 备注（可选）

**响应示例**：
```json
{
  "success": true,
  "data": {
    "fulfillmentProof": {
      "id": "fulfillment_789",
      "orderId": "order_123",
      "pharmacyId": "pharmacy_456",
      "proofFiles": {
        "packagePhoto": "https://storage.example.com/package_photo.jpg",
        "scalePhoto": "https://storage.example.com/scale_photo.jpg"
      },
      "actualWeight": 285.5,
      "reviewStatus": "pending",
      "createdAt": "2025-01-09T10:15:00Z"
    },
    "orderStatus": "FULFILLED",
    "purchaseOrder": {
      "id": "po_001",
      "poNumber": "PO-20250109-001",
      "status": "pending_review"
    }
  },
  "meta": {
    "timestamp": "2025-01-09T10:15:00Z"
  }
}
```

### 2.2 获取履约记录列表
**端点**：`GET /api/v1/pharmacy/fulfillments`  
**描述**：获取药房的履约记录列表

**查询参数**：
- `status`: 审核状态（pending, approved, rejected）
- `page`: 页码
- `limit`: 每页数量

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "fulfillment_789",
      "orderId": "order_123",
      "patientName": "张三",
      "reviewStatus": "approved",
      "amount": 75.00,
      "createdAt": "2025-01-09T10:15:00Z",
      "reviewedAt": "2025-01-09T11:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    },
    "timestamp": "2025-01-09T10:30:00Z"
  }
}
```

---

## 📋 3. 采购订单管理

### 3.1 获取采购订单列表
**端点**：`GET /api/v1/pharmacy/purchase-orders`  
**描述**：获取药房的采购订单列表

**查询参数**：
- `status`: 状态筛选（pending_review, approved, rejected, paid）
- `startDate`: 开始日期
- `endDate`: 结束日期
- `page`: 页码
- `limit`: 每页数量

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "po_001",
      "poNumber": "PO-20250109-001",
      "orderId": "order_123",
      "items": [
        {
          "medicineId": "med_001",
          "medicineName": "当归",
          "quantity": 30,
          "unitPrice": 3.5,
          "totalPrice": 105.00
        }
      ],
      "totalAmount": 105.00,
      "status": "approved",
      "createdAt": "2025-01-09T10:15:00Z",
      "approvedAt": "2025-01-09T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    },
    "timestamp": "2025-01-09T15:00:00Z"
  }
}
```

### 3.2 获取采购订单详情
**端点**：`GET /api/v1/pharmacy/purchase-orders/:id`  
**描述**：获取特定采购订单的详细信息

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "po_001",
    "poNumber": "PO-20250109-001",
    "orderId": "order_123",
    "fulfillmentProofId": "fulfillment_789",
    "items": [
      {
        "medicineId": "med_001",
        "medicineName": "当归",
        "quantity": 30,
        "doses": 7,
        "unitPrice": 3.5,
        "totalPrice": 105.00,
        "priceSource": "pharmacy_price_list"
      }
    ],
    "totalAmount": 105.00,
    "status": "approved",
    "reviewNotes": "审核通过，价格合理",
    "createdAt": "2025-01-09T10:15:00Z",
    "approvedAt": "2025-01-09T14:30:00Z"
  },
  "meta": {
    "timestamp": "2025-01-09T15:00:00Z"
  }
}
```

---

## 💰 4. 价目表管理

### 4.1 上传价目表
**端点**：`POST /api/v1/pharmacy/price-lists`  
**描述**：上传或更新药房价目表

**请求体**：
```json
{
  "effectiveDate": "2025-01-16",
  "items": [
    {
      "medicineId": "med_001",
      "unitPrice": 3.5,
      "inStock": true
    },
    {
      "medicineId": "med_002",
      "unitPrice": 2.8,
      "inStock": false
    }
  ],
  "notes": "2025年第一季度价目表"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "priceListId": "pl_001",
    "version": 1,
    "effectiveDate": "2025-01-16",
    "status": "pending_approval",
    "itemCount": 150,
    "createdAt": "2025-01-09T15:30:00Z"
  },
  "meta": {
    "timestamp": "2025-01-09T15:30:00Z"
  }
}
```

### 4.2 获取当前价目表
**端点**：`GET /api/v1/pharmacy/price-lists/current`  
**描述**：获取当前生效的价目表

**响应示例**：
```json
{
  "success": true,
  "data": {
    "priceListId": "pl_001",
    "version": 1,
    "effectiveDate": "2025-01-01",
    "status": "active",
    "items": [
      {
        "medicineId": "med_001",
        "medicineName": "当归",
        "unitPrice": 3.5,
        "inStock": true,
        "lastUpdated": "2025-01-09T10:00:00Z"
      }
    ],
    "totalItems": 150,
    "lastUpdated": "2025-01-09T10:00:00Z"
  },
  "meta": {
    "timestamp": "2025-01-09T15:45:00Z"
  }
}
```

### 4.3 更新单个药品库存状态
**端点**：`PATCH /api/v1/pharmacy/price-lists/items/:medicineId`  
**描述**：更新特定药品的有货状态

**请求体**：
```json
{
  "inStock": false,
  "notes": "暂时缺货"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "medicineId": "med_001",
    "medicineName": "当归",
    "inStock": false,
    "updatedAt": "2025-01-09T16:00:00Z"
  },
  "meta": {
    "timestamp": "2025-01-09T16:00:00Z"
  }
}
```

---

## 💳 5. 药房余额系统

### 5.1 获取余额信息
**端点**：`GET /api/v1/pharmacy/account/balance`  
**描述**：获取药房账户余额信息

**响应示例**：
```json
{
  "success": true,
  "data": {
    "accountId": "pharmacy_account_456",
    "balance": 1250.75,
    "currency": "NZD",
    "pendingAmount": 315.50,
    "availableForWithdrawal": 935.25,
    "lastTransactionAt": "2025-01-09T14:30:00Z",
    "status": "active"
  },
  "meta": {
    "timestamp": "2025-01-09T16:15:00Z"
  }
}
```

### 5.2 获取交易记录
**端点**：`GET /api/v1/pharmacy/account/transactions`  
**描述**：获取药房账户交易记录

**查询参数**：
- `type`: 交易类型（CREDIT, DEBIT）
- `startDate`: 开始日期
- `endDate`: 结束日期
- `page`: 页码
- `limit`: 每页数量

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "txn_001",
      "type": "CREDIT",
      "amount": 105.00,
      "balanceBefore": 1145.75,
      "balanceAfter": 1250.75,
      "referenceType": "PURCHASE_ORDER",
      "referenceId": "po_001",
      "description": "采购订单结算 - PO-20250109-001",
      "createdAt": "2025-01-09T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "timestamp": "2025-01-09T16:20:00Z"
  }
}
```

### 5.3 申请提现
**端点**：`POST /api/v1/pharmacy/account/withdrawals`  
**描述**：申请提现，基于已审核通过的采购订单

**请求体**：
```json
{
  "purchaseOrderIds": ["po_001", "po_002", "po_003"],
  "bankDetails": {
    "accountName": "ABC药房有限公司",
    "accountNumber": "12-3456-7890123-00",
    "bankName": "ANZ Bank"
  },
  "notes": "第一季度结算申请"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "withdrawalId": "withdrawal_001",
    "invoiceNumber": "INV-20250109-001",
    "totalAmount": 315.50,
    "purchaseOrderCount": 3,
    "status": "pending_review",
    "estimatedProcessingDays": 3,
    "createdAt": "2025-01-09T16:30:00Z"
  },
  "meta": {
    "timestamp": "2025-01-09T16:30:00Z"
  }
}
```

### 5.4 获取提现记录
**端点**：`GET /api/v1/pharmacy/account/withdrawals`  
**描述**：获取提现申请记录

**查询参数**：
- `status`: 状态筛选（pending_review, approved, rejected, completed）
- `page`: 页码
- `limit`: 每页数量

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "withdrawal_001",
      "invoiceNumber": "INV-20250109-001",
      "totalAmount": 315.50,
      "status": "completed",
      "purchaseOrderCount": 3,
      "processedAt": "2025-01-10T10:00:00Z",
      "createdAt": "2025-01-09T16:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    },
    "timestamp": "2025-01-09T16:45:00Z"
  }
}
```

---

## 🔔 6. 实时通知 (WebSocket)

### 6.1 连接建立
**WebSocket端点**：`wss://api.nztcm.co.nz/pharmacy`  
**认证**：通过查询参数传递JWT token

### 6.2 事件类型

#### 采购订单审核通过
```json
{
  "eventType": "purchase_order.approved",
  "data": {
    "purchaseOrderId": "po_001",
    "amount": 105.00,
    "approvedAt": "2025-01-09T14:30:00Z"
  },
  "timestamp": "2025-01-09T14:30:00Z"
}
```

#### 提现处理完成
```json
{
  "eventType": "withdrawal.completed",
  "data": {
    "withdrawalId": "withdrawal_001",
    "amount": 315.50,
    "processedAt": "2025-01-10T10:00:00Z"
  },
  "timestamp": "2025-01-10T10:00:00Z"
}
```

#### 余额更新
```json
{
  "eventType": "balance.updated",
  "data": {
    "newBalance": 1250.75,
    "changeAmount": 105.00,
    "changeType": "CREDIT",
    "reason": "purchase_order_settlement"
  },
  "timestamp": "2025-01-09T14:30:00Z"
}
```

---

## 📊 7. 错误码说明

| 错误码 | HTTP状态码 | 描述 |
|--------|-----------|------|
| PRESCRIPTION_NOT_FOUND | 404 | 处方不存在 |
| PRESCRIPTION_NOT_PAID | 400 | 处方未支付 |
| PRESCRIPTION_ALREADY_FULFILLED | 400 | 处方已履约 |
| INVALID_QR_CODE | 400 | 无效的QR码 |
| FILE_TOO_LARGE | 400 | 文件过大 |
| INVALID_FILE_FORMAT | 400 | 不支持的文件格式 |
| PRICE_LIST_PENDING | 400 | 价目表待审核中 |
| INSUFFICIENT_BALANCE | 400 | 余额不足 |
| WITHDRAWAL_LIMIT_EXCEEDED | 400 | 超出提现限额 |
| UNAUTHORIZED_PHARMACY | 403 | 无权限访问 |

---

## 🔧 8. 开发注意事项

### 8.1 文件上传限制
- 单个文件最大5MB
- 支持格式：JPEG, PNG
- 自动生成缩略图
- 文件存储使用云服务

### 8.2 数据一致性
- 履约凭证上传使用事务处理
- 采购订单生成原子操作
- 余额变更记录完整审计日志

### 8.3 安全考虑
- 所有文件上传进行安全扫描
- 价格计算服务端验证
- 敏感操作需要二次确认

### 8.4 性能优化
- 图片异步处理
- 分页查询优化
- 缓存价目表数据

---

**文档维护者**：后端开发团队  
**最后更新**：2025年1月9日  
**版本**：1.0