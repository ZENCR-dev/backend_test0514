# MVP 2.3 药房端后端开发 SubSOP

## 📋 文档概述

**基于**: Context Engineering + SuperClaude + RIPER-5 最佳实践  
**创建日期**: 2025年7月10日  
**最后更新**: 2025年7月11日  
**开发方法**: 严格按照RIPER-5五阶段执行  
**质量标准**: 每个阶段必须通过验证才能进入下一阶段

---

## 🎯 项目真实状态分析 (2025年7月11日更新)

### ❌ 当前问题清单
1. **数据库迁移未运行**: 5个迁移文件未应用，pharmacy相关表不存在
2. **API路由404**: 所有pharmacy端点返回404错误
3. **功能未经测试**: 没有测试文件验证功能完整性
4. **依赖已安装**: ✅ aws-sdk, sharp等依赖已正确安装
5. **模块已注册**: ✅ PharmacyModule已在app.module.ts中导入

### ✅ 已有基础
1. **文件结构**: 药房模块所有文件已创建（控制器、服务、模块）
2. **业务逻辑**: 核心业务逻辑代码已实现
3. **Prisma模型**: schema.prisma包含所有必需模型
4. **架构设计**: 模块化设计符合NestJS最佳实践

**真实完成度**: 40% (代码存在但无法运行)

---

## 🔄 RIPER-5 开发流程 (修订版)

### Phase 1: RESEARCH - 深度需求分析 ✅ 已完成

#### 1.1 技术栈验证 ✅
- [x] NestJS架构兼容性确认
- [x] Prisma ORM集成状态检查
- [x] 现有模块依赖关系分析
- [x] 第三方依赖需求清单
- [x] 数据库表结构设计验证

#### 1.2 功能需求细化 ✅
**核心业务流程**:
```
扫码验证 → 履约上传 → 自动生成PO → 管理员审核 → 余额充值 → 申请提现
```

**必需API端点** (15个):
1. `POST /api/v1/pharmacy/prescriptions/scan` - 扫码验证
2. `GET /api/v1/pharmacy/prescriptions/pending` - 待履约列表
3. `POST /api/v1/pharmacy/fulfillments` - 上传履约凭证
4. `GET /api/v1/pharmacy/fulfillments` - 履约记录列表
5. `GET /api/v1/pharmacy/fulfillments/:id` - 履约详情
6. `GET /api/v1/pharmacy/purchase-orders` - PO列表
7. `GET /api/v1/pharmacy/purchase-orders/:id` - PO详情
8. `GET /api/v1/pharmacy/purchase-orders/withdrawable` - 可提现PO
9. `POST /api/v1/pharmacy/price-lists` - 上传价目表
10. `GET /api/v1/pharmacy/price-lists/current` - 当前价目表
11. `GET /api/v1/pharmacy/price-lists/history` - 价目表历史
12. `PATCH /api/v1/pharmacy/price-lists/items/:medicineId` - 更新库存
13. `GET /api/v1/pharmacy/account/balance` - 余额信息
14. `GET /api/v1/pharmacy/account/transactions` - 交易记录
15. `POST /api/v1/pharmacy/account/withdrawals` - 申请提现

#### 1.3 技术依赖分析
**必需依赖**:
- `@nestjs/platform-express` - 文件上传
- `multer` - 多文件处理
- `aws-sdk` - 云存储
- `sharp` - 图片处理
- `uuid` - 唯一ID生成

---

### Phase 2: INNOVATE - 技术方案设计

#### 2.1 架构设计原则
- **模块化**: 按业务领域分离关注点
- **事务一致性**: 关键操作使用数据库事务
- **错误处理**: 统一异常处理机制
- **类型安全**: 完整的TypeScript类型定义

#### 2.2 数据库设计
**新增表结构**:
```sql
-- 药房账户表
model PharmacyAccount {
  id          String   @id @default(cuid())
  pharmacyId  String   @unique
  balance     Decimal  @default(0)
  pendingAmount Decimal @default(0)
  status      String   @default("active")
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  pharmacy    Pharmacy @relation(fields: [pharmacyId], references: [id])
  transactions PharmacyAccountTransaction[]
}

-- 采购订单表
model PurchaseOrder {
  id                String   @id @default(cuid())
  poNumber          String   @unique
  pharmacyId        String
  orderId           String
  fulfillmentProofId String  @unique
  items             Json
  totalAmount       Decimal
  status            String   @default("pending_review")
  reviewNotes       String?
  reviewedBy        String?
  reviewedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  pharmacy          Pharmacy @relation(fields: [pharmacyId], references: [id])
  order             Order @relation(fields: [orderId], references: [id])
  fulfillmentProof  FulfillmentProof @relation(fields: [fulfillmentProofId], references: [id])
}

-- 其他模型...
```

#### 2.3 服务层设计
**核心服务**:
1. `PrescriptionScanService` - 处方扫码验证
2. `FulfillmentService` - 履约凭证管理
3. `PurchaseOrderService` - 采购订单生成
4. `PriceListService` - 价目表管理
5. `PharmacyAccountService` - 账户余额管理
6. `FileUploadService` - 文件上传处理

---

### Phase 3: PLAN - 详细实施计划 (2025年7月11日更新)

#### 3.1 开发阶段划分 (基于真实状态)

**Stage 1: 数据库安全迁移** (预计2小时) 🚨 高风险操作
- [ ] 备份现有数据库（使用backup-database.js）
- [ ] 检查迁移文件内容，确保不会删除数据
- [ ] 在测试环境验证迁移效果
- [ ] 执行生产环境迁移
- [ ] 验证所有表格创建成功

**Stage 2: 修复API路由问题** (预计1小时)
- [ ] 检查pharmacy路由注册情况
- [ ] 修复404错误的根本原因
- [ ] 验证所有15个端点可访问
- [ ] 创建测试用户（pharmacy_operator角色）

**Stage 3: 功能验证与完善** (预计4小时)
- [ ] 逐个测试15个API端点
- [ ] 修复发现的业务逻辑问题
- [ ] 完善错误处理和响应格式
- [ ] 验证文件上传功能

**Stage 4: 测试驱动开发** (预计3小时)
- [ ] 编写单元测试（每个服务）
- [ ] 编写集成测试（端到端流程）
- [ ] 性能测试（文件上传、并发）
- [ ] 安全测试（权限、注入）

#### 3.2 详细任务清单 (最小化任务单元)

**数据库迁移任务**:
```bash
# 1. 备份数据
node scripts/backup-database.js

# 2. 检查迁移状态
npx prisma migrate status

# 3. 预览迁移效果
npx prisma migrate dev --create-only

# 4. 执行迁移
npx prisma migrate dev

# 5. 验证结果
node check-database-detailed.js
```

**路由修复任务**:
```typescript
// 1. 验证路由注册
// 检查 app.module.ts 中 PharmacyModule 导入
// 检查控制器装饰器路径

// 2. 测试具体端点
GET /api/v1/pharmacy/account/balance
POST /api/v1/pharmacy/prescriptions/scan

// 3. 创建测试用户
{
  email: "pharmacy@test.com",
  password: "Test123!",
  role: "pharmacy_operator"
}
```

---

### Phase 4: EXECUTE - 严格按计划执行

#### 4.1 执行原则
- **安全第一**: 每个数据库操作前必须备份
- **逐步验证**: 每个任务完成后立即测试
- **错误记录**: 详细记录遇到的问题和解决方案
- **进度跟踪**: 实时更新任务完成状态
- **用户沟通**: 重要操作前获取用户确认

#### 4.2 质量检查点
1. **数据库安全**: 迁移前后数据完整性验证
2. **路由可访问**: 所有15个端点返回正确状态码
3. **功能完整**: 核心业务流程端到端测试通过
4. **测试覆盖**: 关键路径测试覆盖率>80%
5. **性能达标**: 文件上传<10秒，API响应<500ms

---

### Phase 5: REVIEW - 严格验证与交付

#### 5.1 验证清单
- [ ] 数据库迁移成功，无数据丢失
- [ ] 所有15个API端点正常工作
- [ ] 文件上传到云存储成功
- [ ] 事务一致性验证通过
- [ ] 权限控制测试通过
- [ ] 测试覆盖率达标

#### 5.2 交付标准
- **数据安全**: 无任何数据丢失或损坏
- **功能可用**: 所有API端点可正常调用
- **测试完整**: 核心功能有测试保护
- **文档准确**: 文档反映真实实现状态

---

## 🎯 成功标准 (修订版)

### 最小可行产品 (MVP) - Stage 1-2完成
1. **数据库就绪**: 所有表格创建成功
2. **路由可访问**: 15个端点无404错误
3. **基础认证**: pharmacy_operator可登录
4. **错误处理**: 统一错误响应格式

### 完整功能目标 - Stage 3-4完成
1. **业务流程**: 扫码→履约→PO完整流程
2. **文件上传**: 云存储集成正常工作
3. **测试保护**: 关键功能有测试覆盖
4. **性能达标**: 满足性能指标要求

---

## ⚠️ 风险控制 (基于CLAUDE.md教训)

### 数据库操作风险 🚨
- **风险**: 误删数据导致系统瘫痪
- **预防**: 
  - 所有删除操作前必须备份
  - 使用--dry-run预览效果
  - 保持恢复脚本随时可用
  - 重要操作需用户确认

### 技术风险
- **迁移失败**: 准备回滚脚本
- **路由冲突**: 检查其他模块路由
- **文件权限**: 确保云存储配置正确

### 时间风险
- **原计划**: 2-3小时（过于乐观）
- **修订计划**: 10小时（分2天执行）
- **缓冲时间**: 预留20%处理意外

---

## 📝 执行记录

**开始时间**: 2025年7月11日  
**当前阶段**: PLAN完成，准备进入EXECUTE  
**完成进度**: 0% (实际可运行功能)

**下一步行动**: 
1. 执行数据库备份
2. 检查迁移文件内容
3. 获得用户批准后执行迁移

---

## 🛡️ 安全操作检查清单

- [ ] 备份脚本已准备: `scripts/backup-database.js`
- [ ] 恢复脚本已准备: `scripts/restore-database.js`  
- [ ] 状态检查脚本已准备: `check-database-detailed.js`
- [ ] 用户已知晓风险并批准操作
- [ ] 测试环境验证完成

---

*本SubSOP严格遵循RIPER-5方法论，并吸取了数据库误删的教训，确保开发过程的安全性和可控性。*