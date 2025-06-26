# 处方创建API数据格式分析报告

## 问题概述

前端在调用处方创建API (`POST /api/v1/prescriptions`) 时收到 400 错误，错误信息为 "Validation failed"。

## 错误原因分析

### 1. 数据格式不匹配

#### 后端期望的数据格式（根据 CreatePrescriptionDto）：

```typescript
{
  clinicId: string;              // 必需 - 诊所ID
  patientInfo: {
    name: string;                // 必需 - 患者姓名
    age?: number;                // 可选 - 患者年龄
    gender?: string;             // 可选 - 患者性别
    phone?: string;              // 可选 - 患者电话
    symptoms?: string;           // 可选 - 症状描述
    diagnosis?: string;          // 可选 - 诊断信息
  };
  medicines: [{
    medicineId: string;          // 必需 - 药品ID
    quantity: number;            // 必需 - 药品数量（最小值：1）
    dosageInstructions: string;  // 必需 - 用药说明
    notes?: string;              // 可选 - 药品备注
  }];
  notes?: string;                // 可选 - 处方备注
}
```

#### 前端实际发送的数据：

```json
{
  "patientInfo": {
    "name": "测试患者",
    "gender": "male",
    "age": 30
  },
  "medicines": [{
    "medicineId": "cmc1bzk5x0004ugr4vxh8p7h7",
    "medicineName": "人参",      // ❌ 后端不需要此字段
    "quantity": 15
    // ❌ 缺少必需的 dosageInstructions 字段
  }],
  // ❌ 缺少必需的 clinicId 字段
  "instructions": "水煎服，每次1剂，每日2次，温服",  // ❌ 后端不识别此字段
  "copies": 1,                    // ❌ 后端不识别此字段
  "prescriptionFee": 10,          // ❌ 后端不识别此字段
  "priority": "normal"            // ❌ 后端不识别此字段
}
```

### 2. 关键问题

1. **缺少必需字段**：
   - `clinicId`: 诊所ID（必需）
   - `medicines[].dosageInstructions`: 每个药品的用药说明（必需）

2. **多余字段**：
   - 前端发送了 `instructions`、`copies`、`prescriptionFee`、`priority` 等后端不识别的字段
   - 药品数组中包含了 `medicineName` 字段，后端不需要

## 解决方案

### 前端需要调整的地方：

1. **添加 clinicId 字段**：
   - 从当前登录用户的信息中获取关联的诊所ID
   - 或者从诊所选择组件中获取

2. **调整药品数据结构**：
   - 将 `instructions` 字段的值移到每个药品的 `dosageInstructions` 字段
   - 移除 `medicineName` 字段（后端会根据 medicineId 查询药品信息）

3. **移除不必要的字段**：
   - 移除 `instructions`、`copies`、`prescriptionFee`、`priority` 等字段

### 正确的请求示例：

```json
{
  "clinicId": "clinic_id_from_current_user",
  "patientInfo": {
    "name": "测试患者",
    "gender": "male",
    "age": 30
  },
  "medicines": [{
    "medicineId": "cmc1bzk5x0004ugr4vxh8p7h7",
    "quantity": 15,
    "dosageInstructions": "水煎服，每次1剂，每日2次，温服"
  }],
  "notes": "处方备注信息（可选）"
}
```

## 登录记录问题

关于"后端小组说没法在数据库查询到相关的登录记录"的问题：

1. **可能原因**：
   - 系统可能没有专门的登录日志表
   - 登录成功后只返回JWT token，但不记录登录事件
   - `users` 表中的 `refreshToken` 和 `refreshTokenExp` 字段可能在登录时更新

2. **验证方法**：
   - 检查用户表中的 `refreshToken` 字段是否在登录后被更新
   - 查看是否有专门的登录日志表或审计表

## 建议的协作流程

1. **前端调整**：
   - 根据上述格式要求调整请求数据结构
   - 确保从用户上下文中获取 `clinicId`

2. **后端确认**：
   - 确认 DTO 定义是否需要调整
   - 提供更详细的错误信息（如具体哪个字段验证失败）

3. **联调测试**：
   - 使用正确格式的数据进行测试
   - 确认所有必需字段都已提供

## 其他API端点参考

如需了解其他API的数据格式要求，可以访问 Swagger 文档：
- URL: http://localhost:4000/api/docs
- 包含所有API的详细参数说明和示例 