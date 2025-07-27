# MVP 2.5 - 管理员端后端和API开发指导

## 📋 文档概述

本文档为管理员端后端开发团队提供功能需求、API规范和测试要求。实现全局数据管理、审核功能、财务操作和系统监控等核心功能。

**文档版本**：2.0  
**创建日期**：2025年1月9日  
**最后更新**：2025年7月13日  
**所属模块**：MVP 2.5 - 管理员端后端  
**预计工期**：2-3周（简化版）

---

## 🔧 MVP 2.5 开发原则

### 🗃️ 数据库验证原则
**核心要求**: 每次涉及到API路由相关的开发动作，都需要增加一个确认路由指向的远端数据库相关表和字段是否真实存在的验证步骤。

**具体实施规范**:
1. **API开发前验证**：
   ```bash
   # 必须执行数据库Schema检查
   npx prisma db pull --preview-feature  # 同步远端Schema
   npx prisma generate                   # 重新生成Prisma客户端
   ```

2. **字段存在性验证**：
   - 确认API中引用的所有数据库字段在Prisma Schema中存在
   - 验证字段类型与API DTO定义一致
   - 检查必填字段约束与业务逻辑匹配

3. **表关系验证**：
   - 确认外键关系在数据库中正确建立
   - 验证JOIN查询涉及的关联表存在
   - 检查索引是否支持查询性能要求

4. **迁移决策流程**：
   ```typescript
   // 开发前必须回答以下问题：
   // 1. 需要创建新表吗？ → 创建Prisma migration
   // 2. 需要添加新字段吗？ → 更新Schema + migration  
   // 3. 需要修改现有字段吗？ → 考虑数据兼容性
   // 4. 需要添加索引吗？ → 性能优化migration
   ```

5. **API开发检查清单**：
   - [ ] 数据库Schema已同步
   - [ ] 所有引用字段已验证存在
   - [ ] 外键关系已确认
   - [ ] 必要的索引已创建
   - [ ] 数据类型匹配API定义
   - [ ] 迁移脚本已测试

**违规检查机制**：
- API开发完成后必须运行数据库一致性检查
- 发现Schema不匹配立即停止开发，先修复数据库
- 所有API测试必须针对真实数据库Schema执行

---

## 🎯 核心功能需求

### 1. 认证与权限

#### 1.1 简化管理员认证系统
**功能描述**：基于用户指定邮箱的简单管理员认证 + 登录成功邮件提醒

**API定义**：
- 端点：`POST /api/v1/admin/auth/login`
- 请求体：`{ email, password }`
- 响应：`{ success, data: { token, adminInfo }, message }`

**业务规则**：
- 管理员邮箱和密码通过环境变量配置
- 登录成功后立即发送邮件通知
- 生成JWT token
- 记录登录日志和安全审计

**管理员账户配置**：
- 环境变量配置管理员凭据
- 密码强度验证要求
- 自动账户创建/更新机制
- 登录失败限制保护

**安全邮件通知**：
- 登录成功邮件提醒 (包含时间、IP、设备信息)
- 可疑登录警告邮件
- 登录失败过多警告邮件
- 支持多种邮件服务商 (SMTP/SendGrid/AWS SES)

**测试用例**：
- ✅ 配置的管理员账号登录成功
- ✅ 错误邮箱/密码登录失败
- ✅ 登录成功邮件发送验证
- ✅ Token生成和验证
- ✅ 登录失败限制验证
- ✅ 安全审计日志记录

#### 1.2 统一管理员权限
**功能描述**：简化的管理员权限系统

**权限设计**：
- 管理员：完整操作权限（查看、审核、财务操作）
- 临时访客：仅查看权限（可选，用于展示）

**简化验证**：
- JWT基础验证
- 简单权限检查
- 基础操作记录

**测试用例**：
- ✅ 管理员权限验证
- ✅ 访客权限限制
- ✅ 基础安全验证

### 2. 全局数据查询

#### 2.1 处方全局查询
**功能描述**：查看所有医师的处方

**API定义**：
- 端点：`GET /api/v1/admin/prescriptions`
- 认证：需要JWT（管理员）
- 查询参数：
  - doctorId: 医师ID筛选
  - status: 状态筛选
  - dateRange: 日期范围
  - page/limit: 分页

**返回数据增强**：
- 包含医师信息
- 包含药房信息（如已配药）
- 状态变更历史
- 关联的PO信息

**测试用例**：
- ✅ 全局数据访问
- ✅ 复杂筛选组合
- ✅ 大数据量分页
- ✅ 数据完整性

#### 2.2 PO管理查询
**功能描述**：查看和管理所有采购订单

**API定义**：
- 端点：`GET /api/v1/admin/purchase-orders`
- 查询参数：
  - pharmacyId: 药房筛选
  - status: 状态筛选
  - amountRange: 金额范围
  - 其他分页排序参数

**聚合统计**：
- 待审核数量
- 总金额统计
- 药房分布
- 时间趋势

**测试用例**：
- ✅ 数据聚合准确性
- ✅ 筛选功能完整性
- ✅ 统计计算正确性

#### 2.3 Invoice查询
**功能描述**：查看所有提现Invoice

**API定义**：
- 端点：`GET /api/v1/admin/invoices`
- 查询参数：
  - withdrawalId: 提现申请ID
  - pharmacyId: 药房筛选
  - statusFilter: 状态筛选

**关联查询**：
- 关联的提现申请
- 包含的处方明细
- 药房账户信息

**测试用例**：
- ✅ 关联数据完整性
- ✅ 查询性能优化
- ✅ 导出功能

### 3. 审核功能

#### 3.1 PO审核
**功能描述**：审核通过或拒绝采购订单

**API定义**：
- 端点：`PATCH /api/v1/admin/purchase-orders/:id/review`
- 认证：需要审核权限
- 请求体：
  - action: "approve" | "reject"
  - reason: 审核意见
  - adjustedAmount: 调整金额（可选）

**业务规则**：
- 审核通过后自动转账到药房余额
- 记录审核人和时间
- 支持金额调整
- 发送通知给药房

**批量审核**：
- 端点：`POST /api/v1/admin/purchase-orders/batch-review`
- 支持批量通过
- 原子性保证

**测试用例**：
- ✅ 单个审核流程
- ✅ 批量审核原子性
- ✅ 余额更新准确性
- ✅ 通知发送验证
- ✅ 审核日志完整性

#### 3.2 价目表利润率控制
**功能描述**：审核药房价目表，确保平台利润率

**API定义**：
- 端点：`PATCH /api/v1/admin/price-lists/:id/review`
- 请求体：
  - action: "approve" | "reject"
  - marginFeedback: 利润率评估
  - adjustmentNotes: 价格调整建议

**利润率控制**：
- 目标利润率：15-30%
- 价格对比：与市场价格比较
- 手动调整：管理员手动调整不合理价格
- 历史记录：保留价格变更历史

**测试用例**：
- ✅ 利润率计算准确性
- ✅ 价格合理性验证
- ✅ 手动调整功能

### 4. 财务操作

#### 4.1 手动转账
**功能描述**：处理药房提现请求

**API定义**：
- 端点：`POST /api/v1/admin/transfers`
- 认证：需要财务权限
- 请求体：
  - withdrawalId: 提现申请ID
  - amount: 转账金额
  - transactionRef: 转账凭证
  - notes: 备注

**业务规则**：
- 验证提现申请状态
- 记录转账凭证
- 更新提现状态
- 发送完成通知

**安全要求**：
- 二次验证（可选）
- 操作日限额
- 敏感操作告警

**测试用例**：
- ✅ 转账流程完整性
- ✅ 金额验证
- ✅ 状态更新原子性
- ✅ 安全限制验证

#### 4.2 余额调整
**功能描述**：手动调整账户余额

**API定义**：
- 端点：`POST /api/v1/admin/balance-adjustments`
- 请求体：
  - accountId: 账户ID
  - amount: 调整金额（正负）
  - reason: 调整原因
  - relatedOrderId: 关联订单（可选）

**业务规则**：
- 详细的原因说明
- 创建调整记录
- 发送余额变动通知
- 月度对账支持

**测试用例**：
- ✅ 余额计算准确性
- ✅ 调整记录完整性
- ✅ 通知发送验证

#### 4.3 用户账户创建和管理系统
**功能描述**：管理员创建和维护医师、药房账户，实现MVP2.0闭环用户控制系统

#### 4.3.1 医师账户管理
**创建医师账户 API**：
```http
POST /api/v1/admin/practitioners
Content-Type: application/json
Authorization: Bearer <admin_jwt_token>
```

**请求体结构**：
```json
{
  "email": "doctor@example.com",
  "password": "TempPass123!",
  "fullName": "张医生",
  "phone": "+64-21-1234567",
  "licenseNumber": "DOC2025001",
  "specialization": "中医内科",
  "clinic": "新西兰中医诊所",
  "qualifications": ["中医执业医师", "针灸师资格"],
  "apcExpiryDate": "2025-12-31",
  "initialBalance": 100.00,
  "creditLimit": 500.00,
  "status": "active",
  "sendWelcomeEmail": true,
  "notes": "创建备注"
}
```

**业务逻辑**：
1. **邮箱唯一性验证**：检查邮箱是否已存在于User表
2. **执照信息验证**：验证医师执照号码格式和唯一性
3. **密码生成策略**：
   - 支持管理员指定密码
   - 自动生成强密码（包含大小写字母、数字、特殊字符）
   - 密码复杂度：最少8位，包含3种字符类型
4. **多表同步创建**：
   ```typescript
   // 事务性创建
   await prisma.$transaction(async (tx) => {
     // 1. 创建User记录
     const user = await tx.user.create({
       data: {
         email,
         password: hashedPassword,
         role: UserRole.practitioner,
         status: 'approved',
       }
     });
     
     // 2. 创建UserProfile记录
     await tx.userProfile.create({
       data: {
         userId: user.id,
         fullName,
         phone,
         licenseNumber,
         specialization,  // 新增字段
         clinic,          // 新增字段
         qualifications,  // 新增字段
         apcExpiryDate,   // 新增字段
       }
     });
     
     // 3. 创建PractitionerAccount记录
     await tx.practitionerAccount.create({
       data: {
         practitionerId: user.id,
         balance: initialBalance,
         creditLimit: creditLimit,
       }
     });
   });
   ```

**查询医师账户 API**：
```http
GET /api/v1/admin/practitioners?page=1&limit=20&status=active&search=张医生
```

**查询参数**：
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `status`: 账户状态筛选（active/inactive/suspended）
- `search`: 按姓名或邮箱搜索
- `licenseNumber`: 按执照号查询
- `createdAfter`: 创建时间筛选

**更新医师信息 API**：
```http
PATCH /api/v1/admin/practitioners/:id
```

**状态管理 API**：
```http
PATCH /api/v1/admin/practitioners/:id/status
{
  "status": "suspended",
  "reason": "违规操作",
  "suspendUntil": "2025-08-01",
  "notifyUser": true
}
```

**APC文件上传管理 API**：
```http
POST /api/v1/admin/practitioners/:id/apc
Content-Type: multipart/form-data
Authorization: Bearer <admin_jwt_token>
```

**文件上传请求**：
- 支持格式：PDF, JPG, PNG
- 文件大小限制：10MB
- 自动更新UserProfile表的apcFileUrl和apcUploadDate字段

**APC有效期监控**：
- 系统定期检查APC过期状态（每日任务）
- 过期前30天自动发送提醒邮件
- 过期后自动将医师状态设为suspended

**密码重置 API**：
```http
POST /api/v1/admin/practitioners/:id/reset-password
{
  "newPassword": "NewPass123!",
  "forceChangeOnLogin": true,
  "sendNotification": true
}
```

#### 4.3.2 药房账户管理
**创建药房账户 API**：
```http
POST /api/v1/admin/pharmacies
Content-Type: application/json
Authorization: Bearer <admin_jwt_token>
```

**请求体结构**：
```json
{
  "email": "pharmacy@example.com",
  "password": "PharmPass123!",
  "pharmacyName": "新西兰中药房",
  "licenseNumber": "PHARM2025001",
  "contactPerson": "李药师",
  "phone": "+64-9-1234567",
  "address": {
    "street": "123 Queen Street",
    "city": "Auckland",
    "postcode": "1010",
    "country": "New Zealand"
  },
  "contact": {
    "email": "pharmacy@example.com",
    "phone": "+64-9-1234567",
    "fax": "+64-9-1234568"
  },
  "licenseInfo": {
    "number": "PHARM2025001",
    "issueDate": "2025-01-01",
    "expiryDate": "2026-01-01",
    "issuingAuthority": "Ministry of Health"
  },
  "serviceHours": {
    "monday": "09:00-18:00",
    "tuesday": "09:00-18:00",
    "wednesday": "09:00-18:00",
    "thursday": "09:00-18:00",
    "friday": "09:00-18:00",
    "saturday": "09:00-17:00",
    "sunday": "closed"
  },
  "status": "active",
  "sendWelcomeEmail": true,
  "initialSettings": {
    "autoApproveOrders": false,
    "notificationPreferences": ["email", "sms"]
  },
  "notes": "创建备注"
}
```

**业务逻辑**：
1. **药房信息验证**：验证药房执照、地址格式
2. **邮箱唯一性验证**：检查邮箱是否已存在
3. **多表同步创建**：
   ```typescript
   await prisma.$transaction(async (tx) => {
     // 1. 创建User记录（药房操作员）
     const user = await tx.user.create({
       data: {
         email,
         password: hashedPassword,
         role: UserRole.pharmacy_operator,
         status: 'approved'
       }
     });
     
     // 2. 创建Pharmacy记录
     const pharmacy = await tx.pharmacy.create({
       data: {
         name: pharmacyName,
         address: address,  // JSON格式
         contact: contact,  // JSON格式
         licenseInfo: licenseInfo,  // JSON格式
         operatorId: user.id,
         serviceHours: serviceHours,  // JSON格式
         status: status,
         metadata: initialSettings
       }
     });
     
     // 3. 创建PharmacyAccount记录
     await tx.pharmacyAccount.create({
       data: {
         pharmacyId: pharmacy.id,
         balance: 0.00,
         pendingAmount: 0.00,
         status: 'active'
       }
     });
   });
   ```

#### 4.3.3 数据库Schema扩展
**UserProfile表扩展字段**：
为支持医师专属信息和APC管理，需要扩展UserProfile表：
```sql
-- 医师专业信息
ALTER TABLE user_profiles ADD COLUMN specialization VARCHAR(100);
ALTER TABLE user_profiles ADD COLUMN clinic VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN qualifications JSON;

-- APC文件管理
ALTER TABLE user_profiles ADD COLUMN apc_expiry_date DATE;
ALTER TABLE user_profiles ADD COLUMN apc_file_url VARCHAR(500);
ALTER TABLE user_profiles ADD COLUMN apc_upload_date TIMESTAMP;
```

**现有表结构说明**：
- **User表**：存储所有用户类型（practitioner, pharmacy_operator, admin）
- **UserProfile表**：存储用户详细信息，扩展后支持医师专属字段
- **PractitionerAccount表**：存储医师账户财务信息  
- **Pharmacy表**：存储药房基本信息（JSON字段存储复杂结构）
- **PharmacyAccount表**：存储药房账户财务信息

#### 4.3.4 权限和路由系统
**API权限控制**：
```typescript
@Controller('admin/practitioners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@ApiTags('管理员-医师管理')
export class AdminPractitionerController {
  // 管理员医师账户管理端点
}

@Controller('admin/pharmacies')  
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@ApiTags('管理员-药房管理')
export class AdminPharmacyController {
  // 管理员药房账户管理端点
}
```

**现有用户端API保持不变**：
- `/practitioner-accounts` - 医师自用账户管理
- `/pharmacy/account` - 药房操作员自用账户管理

#### 4.3.5 账户状态管理系统
**状态类型定义**：
```typescript
enum AccountStatus {
  ACTIVE = 'active',           // 正常活跃
  INACTIVE = 'inactive',       // 暂时不活跃
  SUSPENDED = 'suspended',     // 被暂停
  PENDING_APPROVAL = 'pending_approval', // 等待审批
  REJECTED = 'rejected',       // 被拒绝
  ARCHIVED = 'archived'        // 已归档
}
```

**状态转换规则**：
- `PENDING_APPROVAL` → `ACTIVE`: 管理员审批通过
- `ACTIVE` → `SUSPENDED`: 违规操作暂停
- `SUSPENDED` → `ACTIVE`: 暂停期满或管理员恢复
- `ACTIVE` → `INACTIVE`: 长期未使用自动设置
- `任何状态` → `ARCHIVED`: 账户永久关闭

**批量操作 API**：
```http
POST /api/v1/admin/users/batch-operations
{
  "action": "updateStatus",
  "userIds": ["user1", "user2", "user3"],
  "status": "suspended",
  "reason": "批量暂停操作",
  "notifyUsers": true
}
```

#### 4.3.4 安全和审计机制
**密码安全策略**：
```typescript
interface PasswordPolicy {
  minLength: 8;
  requireUppercase: true;
  requireLowercase: true;
  requireNumbers: true;
  requireSpecialChars: true;
  forbidCommonPasswords: true;
  expiryDays: 90; // 密码过期天数
  historyCount: 5; // 不能重复使用的历史密码数
}
```

**操作审计日志**：
```typescript
interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: 'CREATE_USER' | 'UPDATE_USER' | 'DELETE_USER' | 'RESET_PASSWORD' | 'CHANGE_STATUS';
  targetUserId: string;
  targetUserType: 'practitioner' | 'pharmacy';
  details: object; // 操作详细信息
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}
```

**数据验证规则**：
```typescript
// 邮箱验证
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 新西兰手机号验证
const nzPhoneRegex = /^(\+64|0)(2[0-9]|3[0-9]|4[0-9]|6[0-9]|7[0-9]|9[0-9])[0-9]{6,7}$/;

// 执照号验证（医师）
const doctorLicenseRegex = /^DOC[0-9]{7}$/;

// 执照号验证（药房）
const pharmacyLicenseRegex = /^PHARM[0-9]{7}$/;
```

#### 4.3.5 通知和欢迎流程
**欢迎邮件模板**：
- 医师欢迎邮件：包含登录凭据、首次登录指南、系统功能介绍
- 药房欢迎邮件：包含登录凭据、配药流程指南、PO系统说明

**短信通知集成**：
- 账户创建成功通知
- 密码重置通知
- 账户状态变更通知

**API测试用例增强**：
- ✅ 完整的账户创建流程测试（医师+药房）
- ✅ 邮箱唯一性验证测试
- ✅ 密码强度和安全性测试
- ✅ 多表事务同步测试（User + UserProfile + Account表）
- ✅ 权限验证测试（仅管理员可访问）
- ✅ 状态管理和转换测试
- ✅ APC文件上传和有效期监控测试
- ✅ 批量操作原子性测试
- ✅ 审计日志完整性测试
- ✅ 数据验证规则测试（邮箱格式、手机号格式等）
- ✅ 错误处理和回滚测试
- ✅ 通知发送机制测试（欢迎邮件、APC过期提醒）
- ✅ 现有API兼容性测试（确保不影响医师和药房自用端点）

### 5. 药品管理

#### 5.1 批量导入药品
**功能描述**：通过Excel批量导入药品数据

**API定义**：
- 端点：`POST /api/v1/admin/medicines/import`
- 请求体：multipart/form-data
  - file: Excel文件

**文件处理**：
- 支持.xlsx/.xls格式
- 模板验证
- 数据校验
- 错误报告生成

**导入规则**：
- 重复SKU更新策略
- 必填字段验证
- 数据格式转换
- 事务处理

**测试用例**：
- ✅ 文件格式验证
- ✅ 数据完整性检查
- ✅ 大文件处理性能
- ✅ 错误数据处理
- ✅ 部分成功场景

#### 5.2 药品信息维护
**功能描述**：增删改查药品信息

**API定义**：
- 创建：`POST /api/v1/admin/medicines`
- 更新：`PUT /api/v1/admin/medicines/:id`
- 删除：`DELETE /api/v1/admin/medicines/:id`
- 批量操作：`POST /api/v1/admin/medicines/batch`

**业务规则**：
- SKU唯一性验证
- 关联处方检查（删除时）
- 价格变更历史
- 操作日志记录

**测试用例**：
- ✅ CRUD操作完整性
- ✅ 数据验证规则
- ✅ 关联数据保护
- ✅ 批量操作性能

### 6. 简化系统监控

#### 6.1 基础仪表板
**功能描述**：简化的系统数据概览

**API定义**：
- 端点：`GET /api/v1/admin/dashboard`
- 返回数据：
  - 基本统计数据
  - 简单图表数据
  - 关键待办事项

**简化指标**：
- 今日处方数量和金额
- 待审核PO数量
- 系统基本状态
- 手动汇总的关键数据

**缓存策略**：
- 简单缓存实现
- 手动刷新机制
- 基础降级方案

**测试用例**：
- ✅ 基础数据准确性
- ✅ 简单缓存有效性
- ✅ 手动操作流程

#### 6.2 简化操作日志
**功能描述**：基础的管理操作记录

**API定义**：
- 端点：`GET /api/v1/admin/audit-logs`
- 查询参数：
  - dateRange: 时间范围
  - action: 操作类型
  - 基础分页参数

**简化日志**：
- 操作人信息
- 操作时间
- 基本操作描述
- 操作结果

**测试用例**：
- ✅ 日志基础完整性
- ✅ 简单查询功能
- ✅ 基础信息记录

#### 6.3 API调用日志查询
**功能描述**：查看所有数据库接口调用的详细日志记录

**API定义**：
- 端点：`GET /api/v1/admin/api-logs`
- 实时监控：`GET /api/v1/admin/api-logs/realtime`
- 统计分析：`GET /api/v1/admin/api-logs/statistics`
- 导出功能：`POST /api/v1/admin/api-logs/export`

**查询参数**：
- startDate/endDate: 时间范围
- endpoint: API端点筛选
- method: HTTP方法筛选
- statusCode: 状态码筛选
- userId: 用户ID筛选
- userRole: 用户角色筛选
- responseTime: 响应时间范围筛选
- page/limit: 分页参数

**日志数据结构**：
- 请求基本信息：timestamp, method, endpoint, fullUrl
- 用户信息：userId, userRole, userEmail（脱敏）
- 性能指标：statusCode, responseTime, requestSize, responseSize
- 安全信息：userAgent, ipAddress（脱敏）
- 错误信息：errorMessage, operationType

**日志收集机制**：
- NestJS拦截器自动收集所有API调用
- 异步写入数据库，不影响API性能
- 敏感信息自动脱敏处理
- 定期归档历史数据

**测试用例**：
- ✅ 日志收集完整性100%验证
- ✅ 大数据量查询性能<2秒
- ✅ 敏感信息脱敏安全性
- ✅ 实时监控延迟<5秒

---

## 🧪 测试要求

### 单元测试
- 权限验证逻辑100%覆盖
- 财务计算100%准确
- 审核流程完整测试

### 集成测试
- 简化管理员认证流程
- 批量操作事务性
- 通知发送机制
- 文件处理功能

### 性能测试
- 大数据量查询优化
- 并发审核处理
- 文件导入性能
- 仪表板加载速度

### 安全测试
- 权限越界测试
- SQL注入防护
- 文件上传安全
- 敏感操作审计

---

## 📊 交付标准

### API完整性
- 所有端点实现
- 权限控制完善
- 错误处理规范
- 文档自动生成

### 数据安全
- 敏感操作日志
- 数据备份机制
- 权限最小化原则
- 加密存储实施

### 性能指标
- 查询响应 < 1秒
- 批量操作 < 30秒
- 文件上传 < 2分钟（10MB）

---

## 🔧 技术建议（可选参考）

### OAuth集成
- Passport.js Google策略
- 官方Google Auth库
- JWT + Refresh Token

### 文件处理
- ExcelJS（Node.js）
- Multer文件上传
- 流式处理大文件

### 任务队列
- Bull Queue
- Redis Queue
- 异步任务处理

### 监控工具
- Prometheus + Grafana
- ELK Stack
- 自定义指标收集

---

## 📅 简化开发里程碑

### 第1周：核心基础功能
- Google OAuth基础集成
- 简化权限系统实现
- 基础查询API开发
- 简单数据展示功能

### 第2周：审核、财务和用户管理功能
- 手动审核功能完成
- 价目表利润率控制
- 基础财务操作实现
- 用户账户创建和管理功能
- 药品管理简化功能

### 第3周：完善和优化（可选）
- 简化监控功能实现
- 基础性能优化
- 简单安全验证
- 核心功能测试

---

本文档为管理员端后端开发的简化指导原则，重点关注核心功能实现和基础权限控制。开发团队可根据实际需求选择技术方案，但必须满足基本功能需求和测试要求。