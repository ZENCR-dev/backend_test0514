# 移除Clinic依赖 - 执行TodoList

**开始时间**: 2025-06-28 20:00  
**预计完成**: 2025-06-28 23:00  
**执行原则**: 测试优先，每步验证

## 阶段1：准备工作 [开始时间: 20:00]

### 1.1 测试用例设计
- [ ] 创建 `tests/clinic-removal/` 目录
- [ ] 编写 `order-without-clinic.test.ts` - 测试订单创建不需要clinicId
- [ ] 编写 `practitioner-permission.test.ts` - 测试基于practitioner的权限
- [ ] 编写 `websocket-connection.test.ts` - 测试不依赖clinic的连接

### 1.2 进度追踪
- [ ] 创建 `clinic-removal-progress.md`
- [ ] 记录开始时间和初始状态
- [ ] 设置每30分钟的检查点

## 阶段2：Schema更新 [目标时间: 20:30]

### 2.1 测试先行
- [ ] 编写测试：`schema-validation.test.ts`
  ```typescript
  // 验证Order模型不包含clinicId
  // 验证Clinic模型不存在
  // 验证PractitionerAccount是唯一的账户模型
  ```

### 2.2 Schema修改
- [ ] 备份当前 `schema.prisma`
- [ ] 移除 Order 模型中的:
  - [ ] `clinicId String @map("clinic_id")`
  - [ ] `clinic Clinic @relation(...)`
  - [ ] `@@index([clinicId])`
- [ ] 移除 Clinic 模型完整定义
- [ ] 运行 `npx prisma validate`

### 2.3 生成迁移
- [ ] `npx prisma migrate dev --create-only --name remove_clinic_dependency`
- [ ] 检查生成的SQL文件
- [ ] 运行测试验证

## 阶段3：DTO和接口更新 [目标时间: 21:00]

### 3.1 DTO测试
- [ ] 编写 `dto-validation.test.ts`
  ```typescript
  // 测试CreateOrderDto不接受clinicId
  // 测试OrderResponseDto不返回clinicId
  ```

### 3.2 DTO更新
- [ ] 更新 `src/orders/dto/create-order.dto.ts`
  - [ ] 移除 clinicId 字段
  - [ ] 移除相关验证装饰器
- [ ] 更新 `src/orders/dto/order-response.dto.ts`
  - [ ] 移除 clinicId 字段
- [ ] 更新 `src/orders/interfaces/order-management.interface.ts`
  - [ ] 移除所有clinicId引用

### 3.3 Prescription DTO更新
- [ ] 更新 `src/modules/prescriptions/dto/create-prescription.dto.ts`
- [ ] 移除 clinicId 相关字段

## 阶段4：Service层重构 [目标时间: 21:45]

### 4.1 Service测试
- [ ] 编写 `order-service-refactor.test.ts`
  ```typescript
  // 测试创建订单不需要clinicId
  // 测试查询不依赖clinicId
  // 测试权限基于practitionerId
  ```

### 4.2 OrderService更新
- [ ] 更新 `src/orders/services/order.service.ts`
  - [ ] 移除 Line 107: `clinicId: createOrderDto.clinicId`
  - [ ] 移除 Line 372-373: clinicId查询条件
  - [ ] 移除 Line 540-543: clinic查找逻辑
  - [ ] 移除 Line 673-677: clinic验证
  - [ ] 移除 Line 875: clinicId参数

### 4.3 权限系统更新
- [ ] 更新 `src/auth/services/permission.service.ts`
  - [ ] 移除 Line 286-295: clinic相关权限检查
  - [ ] 实现基于practitioner的权限逻辑

### 4.4 WebSocket更新
- [ ] 更新 `src/orchestration/gateways/orchestration.gateway.ts`
  - [ ] 移除 `sendToClinic` 方法
  - [ ] 移除 `getClinicConnectionCount` 方法
  - [ ] 更新连接信息，移除clinicId

## 阶段5：测试用例更新 [目标时间: 22:30]

### 5.1 批量更新Mock数据
- [ ] 创建脚本 `scripts/remove-clinic-from-tests.js`
- [ ] 扫描所有 `.spec.ts` 文件
- [ ] 移除mock数据中的clinicId

### 5.2 更新具体测试文件
- [ ] `src/orders/__tests__/order.service.spec.ts`
- [ ] `src/payment/__tests__/payment.service.spec.ts`
- [ ] `src/orchestration/tests/*.spec.ts`
- [ ] `src/auth/services/permission.service.spec.ts`

### 5.3 运行所有测试
- [ ] `npm test`
- [ ] 修复失败的测试
- [ ] 确保100%通过

## 阶段6：CI验证和文档 [目标时间: 22:45]

### 6.1 CI检查
- [ ] 运行 `npm run build`
- [ ] 运行 `npm run lint`
- [ ] 运行 `npm test -- --coverage`

### 6.2 数据库迁移
- [ ] 应用迁移到本地数据库
- [ ] 使用Supabase MCP应用到远端

### 6.3 文档更新
- [ ] 更新 `API文档.md`
- [ ] 创建 `BREAKING_CHANGES.md`
- [ ] 更新前端通知文档

## 检查点记录

| 时间 | 阶段 | 状态 | 备注 |
|:-----|:-----|:-----|:-----|
| 20:00 | 开始 | - | Git checkpoint: 513df8d |
| 20:30 | 阶段2 | [ ] | Schema更新 |
| 21:00 | 阶段3 | [ ] | DTO更新 |
| 21:45 | 阶段4 | [ ] | Service重构 |
| 22:30 | 阶段5 | [ ] | 测试更新 |
| 22:45 | 阶段6 | [ ] | CI验证 |
| 23:00 | 完成 | [ ] | 最终验证 |

## 回滚命令

```bash
# 如需回滚
git reset --hard 513df8d
```

## 成功标准

1. ✅ 所有测试通过
2. ✅ 编译无错误
3. ✅ 无clinic相关引用
4. ✅ 数据库迁移成功
5. ✅ 文档更新完成 