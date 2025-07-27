# 🔔 前端团队通知：医师个人账户架构API变更

**发布日期**: 2025-06-28  
**重要程度**: 🔴 高  
**影响范围**: 支付相关API、账户管理API

---

## 📢 重要通知

后端已完成从"诊所账户"到"医师个人账户"的架构重构。所有支付相关API已更新，请前端团队相应调整。

## 🔄 API变更详情

### 1. 账户余额查询API

**旧API** (已废弃):
```
GET /api/v1/clinic-accounts/:clinicId/balance
```

**新API**:
```
GET /api/v1/payment/practitioner-balance/:practitionerId
```

**响应格式**:
```json
{
  "balance": "1000.00",
  "availableCredit": "500.00",
  "creditLimit": "2000.00",
  "usedCredit": "1500.00"
}
```

### 2. 支付扣款API

**旧API** (已废弃):
```
POST /api/v1/payments/deduct-clinic
```

**新API**:
```
POST /api/v1/payment/deduct-practitioner
```

**请求体变更**:
```json
{
  "practitionerId": "string",  // 原为 clinicId
  "amount": "number",
  "orderId": "string"
}
```

### 3. 账户交易历史API

**新增API**:
```
GET /api/v1/payment/practitioner-transactions/:practitionerId
```

**查询参数**:
- `limit`: 返回记录数（默认50，最大200）
- `offset`: 偏移量（默认0）

## 🚨 重要变更点

1. **主体变更**: 所有支付操作的主体从"诊所"改为"医师个人"
2. **字段名变更**: 
   - `clinicId` → `practitionerId`
   - `clinicAccountId` → `practitionerAccountId`
3. **新增功能**: 
   - 支持个人信用额度管理
   - 交易历史查询
   - 并发安全保证（乐观锁）

## 📅 迁移时间表

- **2025-06-28**: API变更生效
- **2025-06-30**: 旧API标记为废弃（仍可用）
- **2025-07-07**: 旧API完全停用

## 🔧 前端需要的调整

1. **用户界面**:
   - 将"诊所余额"改为"个人账户余额"
   - 添加信用额度显示
   - 添加交易历史查看功能

2. **API调用**:
   - 更新所有支付相关的API端点
   - 更新请求参数中的ID字段
   - 处理新的响应格式

3. **错误处理**:
   - 新增错误码：`INSUFFICIENT_BALANCE_AND_CREDIT`
   - 并发冲突错误：`ACCOUNT_UPDATE_CONFLICT`

## 📞 联系支持

如有任何问题，请联系后端团队：
- 技术负责人：核心开发小组
- 紧急联系：通过Slack #backend-support频道

## 📎 相关文档

- [完整API文档](./API文档.md)
- [架构设计文档](./improved_micro_sop.md)
- [测试环境信息](./delivery-package/FRONTEND_INTEGRATION_GUIDE.md)

---

**请前端团队在收到通知后24小时内确认，并制定相应的更新计划。** 