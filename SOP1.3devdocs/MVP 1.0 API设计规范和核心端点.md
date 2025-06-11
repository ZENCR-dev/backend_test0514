## API设计原则

### 1. 统一响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": T, // 实际数据
  "meta"?: {
    "pagination"?: PaginationMeta,
    "timestamp": string
  }
}

// 错误响应  
{
  "success": false,
  "error": {
    "code": string, // 业务错误码
    "message": string, // 用户友好的错误信息
    "details"?: any, // 详细错误信息(开发环境)
    "timestamp": string
  }
}
```

### 2. 认证机制

- 所有API使用Bearer Token认证
- Token格式：`Authorization: Bearer <jwt_token>`
- 公开接口除外：登录、注册、药品搜索等

### 3. 分页标准

```typescript
// 请求参数
{
  "page": number, // 页码，从1开始
  "limit": number, // 每页条数，默认20，最大100
  "sort"?: string, // 排序字段，如"created_at:desc"
}

// 响应元数据
{
  "pagination": {
    "page": number,
    "limit": number, 
    "total": number,
    "totalPages": number,
    "hasNext": boolean,
    "hasPrev": boolean
  }
}
```

## 核心API端点定义

### 认证模块

```yaml
POST /api/v1/auth/register
  - 用户注册
  - Body: {email, password, role, fullName, ...roleSpecificData}
  - Response: {userId, message}

POST /api/v1/auth/login  
  - 用户登录
  - Body: {email, password}
  - Response: {accessToken, refreshToken, user}

POST /api/v1/auth/refresh
  - Token刷新
  - Body: {refreshToken}
  - Response: {accessToken}

GET /api/v1/auth/me
  - 获取当前用户信息
  - Response: UserProfile
```

### 药品管理模块

```yaml
GET /api/v1/medicines
  - 药品搜索/列表
  - Query: {search?, category?, page?, limit?, sort?}
  - Response: {medicines: Medicine[], meta}

GET /api/v1/medicines/:id
  - 药品详情
  - Response: Medicine

POST /api/v1/medicines (Admin only)
  - 创建药品
  - Body: MedicineCreateDto
  - Response: Medicine
```

### 订单管理模块

```yaml
POST /api/v1/orders
  - 创建订单(处方)
  - Body: {patientInfo, clinicId, items: OrderItemDto[]}
  - Response: Order

GET /api/v1/orders
  - 订单列表(基于用户角色返回不同数据)
  - Query: {status?, patientId?, page?, limit?, sort?}
  - Response: {orders: Order[], meta}

GET /api/v1/orders/:id
  - 订单详情
  - Response: OrderDetail

PUT /api/v1/orders/:id
  - 更新订单
  - Body: OrderUpdateDto
  - Response: Order

POST /api/v1/orders/:id/generate-credential
  - 生成订单凭证(QR码和PDF)
  - Response: {qrCodeData, pdfUrl, platformOrderId}
```

### 药房模块

```yaml
GET /api/v1/pharmacies/nearby
  - 查找附近药房
  - Query: {lat, lng, radius?, limit?}
  - Response: {pharmacies: Pharmacy[]}

POST /api/v1/pharmacies/scan-credential
  - 药房扫描订单凭证
  - Body: {qrCodeData | platformOrderId}  
  - Response: {order: OrderDetail, estimatedPayout}

POST /api/v1/fulfillment-proofs
  - 提交履约证明
  - Body: {orderId, proofFiles: string[], notes?}
  - Response: FulfillmentProof
```

### 支付模块

```yaml
POST /api/v1/payments/create-intent
  - 创建支付意图
  - Body: {orderId, paymentMethod}
  - Response: {clientSecret, paymentIntentId}

POST /api/v1/payments/confirm
  - 确认支付
  - Body: {paymentIntentId, orderId}
  - Response: Payment

GET /api/v1/payments/status/:orderId
  - 查询支付状态
  - Response: PaymentStatus
```

### 文件管理模块

```yaml
POST /api/v1/files/upload-url
  - 获取文件上传签名URL
  - Body: {fileName, fileType, bucket}
  - Response: {uploadUrl, downloadUrl, fileId}

POST /api/v1/files/confirm-upload
  - 确认文件上传完成
  - Body: {fileId, metadata?}
  - Response: FileRecord
```

## 错误码规范

### HTTP状态码使用

- 200: 成功
- 201: 创建成功
- 400: 请求参数错误
- 401: 未认证
- 403: 权限不足
- 404: 资源不存在
- 409: 资源冲突
- 422: 数据验证失败
- 500: 服务器内部错误

### 业务错误码

```typescript
enum ErrorCodes {
  // 认证相关 (1xxx)
  INVALID_CREDENTIALS = "1001",
  TOKEN_EXPIRED = "1002", 
  INSUFFICIENT_PERMISSIONS = "1003",
  
  // 订单相关 (2xxx)
  ORDER_NOT_FOUND = "2001",
  ORDER_CANNOT_BE_MODIFIED = "2002",
  INVALID_ORDER_STATUS = "2003",
  
  // 支付相关 (3xxx)
  PAYMENT_FAILED = "3001",
  INSUFFICIENT_FUNDS = "3002",
  PAYMENT_ALREADY_PROCESSED = "3003",
  
  // 药房相关 (4xxx)
  PHARMACY_NOT_AVAILABLE = "4001",
  INVALID_CREDENTIAL = "4002",
  
  // 系统相关 (5xxx)
  EXTERNAL_SERVICE_ERROR = "5001",
  RATE_LIMIT_EXCEEDED = "5002"
}
```

## 性能和安全要求

### 1. 请求限制

- 认证接口: 5次/分钟/IP
- 搜索接口: 100次/分钟/用户
- 创建订单: 10次/分钟/用户
- 文件上传: 20次/小时/用户

### 2. 数据验证

- 所有输入使用DTO类进行验证
- 敏感操作需要二次验证
- SQL注入防护
- XSS防护

### 3. 日志记录

- 所有API调用记录访问日志
- 敏感操作记录审计日志
- 错误日志包含足够的调试信息
- 个人信息脱敏处理