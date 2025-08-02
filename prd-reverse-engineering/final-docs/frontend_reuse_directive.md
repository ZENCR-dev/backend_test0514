# 🚨 前端代码复用准备指令 - Supabase适配清单

**发布方**: 项目架构委员会  
**接收方**: 前端技术团队  
**指令类型**: 组件复用准备 + Supabase适配  
**发布日期**: 2025年8月2日  
**截止时间**: 48小时内完成  

---

## 📋 复用资产确认清单

基于审核报告确认，以下**11个高价值组件**需要提取到复用资产包中，按Supabase适配优先级分级处理。

---

## 🎯 一级复用组件 (直接迁移) - 7个组件

### 1. 认证和权限组件 (2个)

#### **GuestModeGuard.tsx** - Guest模式路由守卫
```typescript
/**
 * 🔄 一级复用组件 - 路由守卫
 * 复用价值: 24个测试用例验证，稳定性高
 * 适配要求: 集成Supabase Auth状态检查
 * 迁移路径: recycle/auth/GuestModeGuard.tsx
 */

// 🚨 需要适配的关键点
// 原: JWT token检查 → 新: Supabase Auth状态
// 原: 自定义权限 → 新: RLS策略权限
```

**复用准备要求**:
- [ ] 保留完整的测试用例 (24个)
- [ ] 添加Supabase Auth适配说明
- [ ] 标记需要修改的认证检查逻辑
- [ ] 提供路由守卫迁移示例

#### **withAuth.tsx** - 认证HOC组件
```typescript
/**
 * 🔄 一级复用组件 - 高阶组件
 * 复用价值: 认证逻辑封装完善
 * 适配要求: 完全重写为Supabase Auth HOC
 * 迁移路径: recycle/auth/withAuth.tsx
 */

// 🚨 核心适配点
// 原: JWT解析和验证 → 新: Supabase getUser()
// 原: token刷新机制 → 新: Supabase自动会话管理
```

### 2. 业务工具函数 (3个)

#### **prescriptionCalculator.ts** - 处方计算逻辑
```typescript
/**
 * 🔄 一级复用组件 - 计算引擎
 * 复用价值: 95% (纯算法逻辑)
 * 适配要求: 无需修改，直接复用
 * 迁移路径: recycle/utils/prescriptionCalculator.ts
 */

// ✅ 无需适配 - 纯业务逻辑
export class PrescriptionCalculator {
  // NZD cents精度计算 - 100%复用
  calculateTotalAmount(medicines: Medicine[]): number
  calculatePlatformProfit(basePrice: number, pharmacyPrice: number): number
}
```

#### **guestDataManager.ts** - Guest模式数据管理
```typescript
/**
 * 🔄 一级复用组件 - 数据管理
 * 复用价值: Guest模式核心逻辑
 * 适配要求: localStorage → Supabase Guest存储
 * 迁移路径: recycle/utils/guestDataManager.ts
 */

// 🚨 适配要求
// 原: localStorage存储 → 新: Supabase Guest表或临时存储
// 原: 本地数据管理 → 新: 云端临时数据同步
```

#### **qrParser.ts** - QR码解析工具
```typescript
/**
 * 🔄 一级复用组件 - 工具函数
 * 复用价值: 90% (成熟的解析逻辑)
 * 适配要求: 无需修改，直接复用
 * 迁移路径: recycle/utils/qrParser.ts
 */

// ✅ 无需适配 - 纯工具函数
export class QRParser {
  parseQRCode(qrData: string): ParsedQRData
  validateQRFormat(qrData: string): boolean
}
```

### 3. 核心业务组件 (2个)

#### **MedicineSearch.tsx** - 药品搜索组件
```typescript
/**
 * 🔄 一级复用组件 - 搜索组件
 * 复用价值: 95% (搜索逻辑完善)
 * 适配要求: API调用 → Supabase Client查询
 * 迁移路径: recycle/components/MedicineSearch.tsx
 */

// 🚨 适配要求
// 原: axios API调用 → 新: supabase.from('medicines').select()
// 原: JWT认证头 → 新: RLS策略自动权限控制
```

#### **PrescriptionDetailModal.tsx** - 处方详情展示
```typescript
/**
 * 🔄 一级复用组件 - 展示组件
 * 复用价值: 80% (UI逻辑稳定)
 * 适配要求: 移除患者隐私信息字段
 * 迁移路径: recycle/components/PrescriptionDetailModal.tsx
 */

// 🚨 关键适配 - 隐私合规
// ❌ 移除: patientName, patientAge, patientPhone显示
// ✅ 保留: prescriptionCode, medicines, practitioner信息
```

---

## ⚠️ 二级复用组件 (优化迁移) - 3个组件

### **LoginPromptModal.tsx** - 登录提示模态框
```typescript
/**
 * 🔄 二级复用组件 - 登录模态框
 * 复用价值: 需要清理测试代码
 * 适配要求: 集成Supabase Auth登录流程
 * 迁移路径: recycle/components/LoginPromptModal.tsx
 */

// 🚨 适配和清理要求
// 清理: 删除开发测试代码和console.log
// 适配: supabase.auth.signInWithPassword()集成
// 优化: 错误处理和用户体验提升
```

### **PrescriptionCreator.tsx** - 处方创建组件
```typescript
/**
 * 🔄 二级复用组件 - 创建组件
 * 复用价值: 核心业务组件，需要简化依赖
 * 适配要求: 移除患者字段 + Supabase数据提交
 * 迁移路径: recycle/components/PrescriptionCreator.tsx
 */

// 🚨 重大适配要求
// ❌ 移除: 所有患者信息输入字段 (patientName等)
// ✅ 适配: supabase.from('prescriptions').insert()
// ✅ 集成: Supabase Realtime状态更新
```

### **PrescriptionDashboard.tsx** - 处方仪表盘
```typescript
/**
 * 🔄 二级复用组件 - 仪表盘组件
 * 复用价值: 需要Mock数据替代和优化
 * 适配要求: Supabase实时数据订阅
 * 迁移路径: recycle/components/PrescriptionDashboard.tsx
 */

// 🚨 适配要求
// 原: 静态Mock数据 → 新: Supabase实时订阅
// 集成: supabase.from('prescriptions').on('*', callback)
// 优化: 实时状态更新和数据同步
```

---

## 🔧 三级复用组件 (重构迁移) - 1个组件

### **medicineService.ts + prescriptionService.ts** - 服务层
```typescript
/**
 * 🔄 三级复用组件 - 服务层重构
 * 复用价值: 需要API抽象层重构
 * 适配要求: 完全重写为Supabase Client封装
 * 迁移路径: recycle/services/
 */

// 🚨 重构要求 - API抽象层
// 原: axios HTTP客户端 → 新: Supabase Client SDK
// 原: RESTful API调用 → 新: 数据库直接查询
// 新增: RLS策略权限管理
// 新增: 实时订阅数据同步
```

---

## 📦 复用资产包目录结构 (强制要求)

```bash
recycle/
├── components/                      # 核心业务组件
│   ├── PrescriptionCreator.tsx      # 二级复用 - 需要适配
│   ├── PrescriptionDashboard.tsx    # 二级复用 - 需要优化
│   ├── MedicineSearch.tsx           # 一级复用 - API适配
│   ├── PrescriptionDetailModal.tsx  # 一级复用 - 隐私合规
│   └── LoginPromptModal.tsx         # 二级复用 - 清理优化
├── auth/                           # 认证权限组件
│   ├── GuestModeGuard.tsx          # 一级复用 - Auth适配
│   └── withAuth.tsx                # 一级复用 - HOC重写
├── utils/                          # 工具函数库
│   ├── prescriptionCalculator.ts   # 一级复用 - 直接迁移
│   ├── guestDataManager.ts         # 一级复用 - 存储适配
│   └── qrParser.ts                 # 一级复用 - 直接迁移
├── services/                       # 服务层 (重构)
│   ├── medicineService.ts          # 三级复用 - 完全重写
│   └── prescriptionService.ts      # 三级复用 - 完全重写
├── types/                          # TypeScript类型定义
│   ├── prescription.types.ts       # 适配Supabase Schema
│   ├── medicine.types.ts           # 对接后端类型定义
│   └── auth.types.ts               # Supabase Auth类型
├── hooks/                          # React Hooks (如有)
│   └── useSupabaseAuth.ts          # 新增Supabase Auth Hook
├── tests/                          # 测试文件
│   ├── components/                 # 组件测试
│   ├── utils/                      # 工具函数测试
│   └── integration/                # 集成测试
├── docs/                           # 文档和指南
│   ├── README.md                   # 前端复用指南
│   ├── supabase-migration.md       # Supabase迁移指南
│   └── component-adaptation.md     # 组件适配说明
└── package.json                    # 依赖配置
```

---

## 🚨 Supabase适配标准 (强制要求)

### 1. 认证系统适配

**原认证模式** (废弃):
```typescript
// ❌ 废弃的JWT模式
const token = localStorage.getItem('jwt_token');
const user = jwt.decode(token);
if (user.exp < Date.now()) {
  // 手动token刷新逻辑
}
```

**新认证模式** (强制要求):
```typescript
// ✅ Supabase Auth模式
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// 自动会话管理
const { data: { user } } = await supabase.auth.getUser()
const { data: { session } } = await supabase.auth.getSession()

// 实时认证状态监听
supabase.auth.onAuthStateChange((event, session) => {
  // 自动处理登录/登出状态
})
```

### 2. 数据访问适配

**原API调用模式** (废弃):
```typescript
// ❌ 废弃的HTTP API模式
const response = await axios.get('/api/prescriptions', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**新数据访问模式** (强制要求):
```typescript
// ✅ Supabase直接数据库访问
const { data: prescriptions, error } = await supabase
  .from('prescriptions')
  .select(`
    id, prescriptionCode, status, totalAmount,
    prescription_medicines (
      id, medicineId, quantity, usage,
      medicines (name, basePrice)
    )
  `)
  .eq('practitionerId', user.id); // RLS策略自动生效
```

### 3. 实时数据同步

**新实时订阅模式** (强制添加):
```typescript
// ✅ Supabase Realtime订阅
const subscription = supabase
  .channel('prescription-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'prescriptions',
    filter: `practitionerId=eq.${user.id}`
  }, (payload) => {
    // 实时处理数据变更
    updateLocalState(payload);
  })
  .subscribe();
```

### 4. 隐私合规适配 (法律要求)

**数据模型清理** (强制执行):
```typescript
// ❌ 违反隐私合规的字段 - 必须移除
interface OldPrescription {
  patientName: string;        // GDPR违规 - 删除
  patientAge: number;         // 隐私敏感 - 删除  
  patientPhone: string;       // PII信息 - 删除
  patientAddress: string;     // 地址信息 - 删除
}

// ✅ 隐私合规的匿名模型
interface NewPrescription {
  id: string;
  prescriptionCode: string;   // 匿名处方编号
  practitionerId: string;     // 仅保留医师信息
  status: PrescriptionStatus;
  totalAmount: number;        // NZD cents精度
  medicines: PrescriptionMedicine[];
  createdAt: string;
  // ❌ 完全不包含患者个人信息
}
```

---

## ✅ 复用文件标准注释 (强制格式)

**每个复用文件必须包含以下注释**:
```typescript
/**
 * 🔄 前端代码复用资产
 * 
 * @title [组件/工具名称]
 * @original B2B2C中医处方履约平台
 * @reuse_level [一级/二级/三级]复用
 * @reuse_value [复用价值百分比]%
 * @adaptation [Supabase适配要求描述]
 * @privacy_compliance [GDPR/HIPAA合规性说明]
 * @test_coverage [测试覆盖情况]
 * 
 * @migration_notes
 * - 原技术栈: [原始技术依赖]
 * - 新技术栈: [Supabase适配技术]
 * - 关键修改: [主要适配点]
 * - 风险评估: [迁移风险和缓解措施]
 * 
 * @usage_example
 * ```typescript
 * // 原用法示例
 * const old = oldFunction(params);
 * 
 * // 新用法示例  
 * const new = await supabaseFunction(params);
 * ```
 * 
 * @author [原作者]
 * @migrated_by [迁移负责人]
 * @migration_date [迁移准备日期]
 */
```

---

## 📋 质量验收清单 (强制检查)

### 1. 代码质量检查
- [ ] ✅ TypeScript类型定义完整，严格模式通过
- [ ] ✅ ESLint检查零错误，代码风格统一
- [ ] ✅ React Hooks规则合规，无副作用
- [ ] ✅ 组件Props和State类型安全
- [ ] ✅ 错误边界和异常处理完善

### 2. Supabase适配检查
- [ ] 🚨 认证系统完全迁移到Supabase Auth
- [ ] 🚨 数据访问使用Supabase Client SDK
- [ ] 🚨 实时功能集成Supabase Realtime
- [ ] 🚨 文件上传适配Supabase Storage (如适用)
- [ ] 🚨 环境变量配置正确

### 3. 隐私合规检查
- [ ] ❌ 患者姓名字段完全移除
- [ ] ❌ 患者年龄信息完全删除
- [ ] ❌ 患者联系方式完全清除
- [ ] ❌ 患者地址信息完全移除
- [ ] ✅ 匿名处方编号机制实现
- [ ] ✅ GDPR/HIPAA合规性验证通过

### 4. 测试完整性检查
- [ ] 🧪 保留原有单元测试文件
- [ ] 🧪 添加Supabase集成测试
- [ ] 🧪 隐私合规测试用例
- [ ] 🧪 错误处理测试覆盖
- [ ] 🧪 性能基准测试

### 5. 文档完整性检查
- [ ] 📚 每个组件包含适配说明
- [ ] 📚 Supabase迁移指南完整
- [ ] 📚 API变更对比文档
- [ ] 📚 测试用例说明文档
- [ ] 📚 故障排查指南

---

## 📅 交付时间节点 (不可延期)

### Phase 1: 文件准备