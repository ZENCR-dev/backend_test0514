# CLAUDE.md - 医师药房系统开发规范

## 📁 .claude/目录结构
```
.claude/
├── CLAUDE.md                 # 主配置文件（本文档）
├── configs/
│   ├── riper5-stages.md      # RIPER-5阶段白名单
│   ├── task-tree.md          # 四层任务树规则
│   └── context/
│       ├── INITIAL.md        # 项目上下文
│       └── prp-base.md       # PRP模板
└── prps/                     # 项目级基石文档
```

## 🤖 AI协作规范

### RIPER-5模式管理
- AI响应以`[MODE: 模式名]`开头，声明当前RIPER-5模式
- 支持"ENTER [MODE] MODE"强制切换模式
- 阶段能力白名单：@configs/riper5-stages.md

### 四层任务树管理
- PRPs（项目级）：@prps/ - 项目级基石文档
- Checklist（阶段级）：根目录 - 阶段性任务清单
- 进度日志（记录级）：根目录 - 高频进度记录
- Todos（临时级）：Claude Code CLI内置工具

详细规则：@configs/task-tree.md

#### 当前项目四层任务树指导

**第1层：PRP（项目级基石）**
- 文档：`docs/PRDSOPMVP2.0.md`
- 功能：新西兰中医药电子处方平台的完整商业模式和业务流程
- 更新频率：重大架构决策时

**第2层：Checklist（阶段级基石）**  
- 文档：`docs/MVP2.5-DEVELOPMENT-PLAN.md`
- 功能：当前Phase 3.2财务操作增强的详细任务分解
- 更新频率：每个开发阶段开始时

**第3层：Progress Log（记录级日志）**
- 文档：`MVP2.5-PROGRESS-LOG.md`
- 功能：每日开发进展、问题解决、技术债务跟踪
- 更新频率：每次开发会话结束时

**第4层：Todos（临时级任务）**
- 工具：Claude Code CLI TodoWrite
- 功能：当前具体执行任务的实时管理
- 更新频率：实时更新

### SuperClaude集成
全局配置已可用，直接使用/命令语法：
- `/build --nest --prisma --persona-backend` - 后端开发
- `/analyze --api --ddd --persona-architect` - 架构分析
- `/test --coverage --e2e --persona-qa` - 质量保证
- `/scan --security --owasp --persona-security` - 安全扫描

---

## 📋 项目概述

新西兰中医药电子处方平台后端系统开发指导规则。

**项目类型**：医疗健康平台后端API
**开发模式**：螺旋式敏捷开发
**架构模式**：医师个人账户架构（移除clinic依赖）
**技术栈**：NestJS + TypeScript + Prisma + PostgreSQL/Supabase

---

## 🎯 项目感知规则

### 必读文档优先级
1. **CLAUDE.md** - 当前开发规范
2. **MVP2.5.md** - 当前开发目标
3. **docs/api/UNIFIED_API_DOCUMENTATION.md** - API规范
4. **prisma/schema.prisma** - 数据模型
5. **src/modules/** - 核心业务模块

### 任务检查规则
- 每次开发前查看TodoWrite任务状态
- 优先处理高优先级任务
- 完成任务后立即标记为completed
- 使用四层任务树路径追踪

---

## 🏗️ 代码结构规则

### 当前模块组织架构
```typescript
src/
├── admin/                    # 管理员模块
├── auth/                     # 认证授权
├── common/                   # 通用工具
│   ├── controllers/          # 公共控制器
│   ├── decorators/           # 装饰器
│   ├── dto/                  # 数据传输对象
│   ├── events/               # 事件定义
│   ├── middleware/           # 中间件
│   ├── services/             # 公共服务
│   ├── utils/                # 工具函数
│   └── validators/           # 验证器
├── config/                   # 配置模块
├── medicines/                # 药品管理
│   ├── __tests__/            # 测试文件
│   └── public-medicines.controller.ts
├── modules/
│   └── prescriptions/        # 处方管理
│       ├── dto/              # 数据传输对象
│       ├── services/         # 业务服务
│       └── prescriptions.controller.ts
├── orchestration/            # 事件编排
│   ├── __tests__/            # 测试文件
│   └── services/             # 编排服务
├── orders/                   # 订单系统
│   ├── __tests__/            # 测试文件
│   ├── controllers/          # 控制器
│   ├── dto/                  # 数据传输对象
│   ├── interfaces/           # 接口定义
│   └── services/             # 业务服务
├── payment/                  # 支付集成
│   ├── dto/                  # 数据传输对象
│   └── services/             # 支付服务
├── pharmacy/                 # 药房模块
├── practitioner-account/     # 医师账户
│   ├── __tests__/            # 测试文件
│   └── dto/                  # 数据传输对象
├── prisma/                   # 数据库服务
└── user/                     # 用户管理
```

### MVP2.0架构扩展规划
基于MVP2.0规划，待完善的模块架构：
```typescript
src/
├── modules/
│   ├── prescriptions/        # ✅ 已完成 - 处方管理
│   ├── pdf-signature/        # 🔄 规划中 - 电子签名系统
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── certificate.service.ts
│   │   │   ├── pdf-generation.service.ts
│   │   │   └── digital-signature.service.ts
│   │   └── dto/
│   ├── ai-fulfillment/       # 🔄 规划中 - AI履约审核
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── image-recognition.service.ts
│   │   │   ├── weight-validation.service.ts
│   │   │   └── auto-audit.service.ts
│   │   └── dto/
│   ├── geo-location/         # 🔄 规划中 - 地理位置服务
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── pharmacy-location.service.ts
│   │   │   └── distance-calculation.service.ts
│   │   └── dto/
│   └── patient-portal/       # 🔄 规划中 - 患者端服务
│       ├── controllers/
│       ├── services/
│       │   ├── patient-registration.service.ts
│       │   ├── prescription-inquiry.service.ts
│       │   └── feedback.service.ts
│       └── dto/
├── payment/                  # ✅ 已完成 - 支付集成
├── pharmacy/                 # ✅ 已完成 - 药房模块
└── practitioner-account/     # ✅ 已完成 - 医师账户
```

### 文件大小限制
- 单个文件最大500行
- 超过限制需要拆分模块
- 复杂逻辑需要注释说明

---

## 🔒 隐私保护强制规则

### 应用层加密 (ALE)
- 处方数据严格权限控制
- 患者敏感信息应用层加密存储
- 密钥管理服务 (KMS) 独立部署
- 审计日志不能包含隐私数据

### 统一患者身份模型
- 患者数据统一管理，避免重复
- 医师只能访问自己创建的患者记录
- 严格的基于数据归属的 RBAC
- 符合医疗数据保护法规

---

## 🧪 测试要求

### 测试模式
- 遵循TDD开发模式
- 先写测试，后写实现
- 测试覆盖率必须>80%

### 测试类型
- 单元测试：每个Service方法
- 集成测试：每个API端点
- E2E测试：核心业务流程

### 测试命名
```typescript
describe('PrescriptionService', () => {
  it('should create prescription successfully', () => {})
  it('should throw error when invalid medicine', () => {})
  it('should update prescription status correctly', () => {})
})
```

---

## 📝 编码规范

### 语言偏好
- 后端：TypeScript (严格模式)
- 数据库：PostgreSQL + Prisma ORM
- 实时通信：WebSocket (Socket.io)
- 支付：Stripe集成

### 命名约定
- 变量：camelCase
- 函数：camelCase
- 类：PascalCase
- 接口：PascalCase (I前缀)
- 枚举：PascalCase
- 常量：UPPER_SNAKE_CASE

### API设计规范
```typescript
// 标准API响应格式
{
  "success": boolean,
  "data": any,
  "meta": {
    "timestamp": string,
    "pagination": {...}
  },
  "error": {
    "code": string,
    "message": string
  }
}
```

---

## 📚 文档标准

### 代码注释
- 所有公共接口必须有JSDoc
- 复杂算法必须有行内注释
- 业务逻辑必须说明用途

### API文档
- 使用Swagger/OpenAPI 3.0
- 每个端点必须有完整示例
- 错误码必须标准化

### 文档格式
```typescript
/**
 * 创建处方
 * @param createPrescriptionDto 处方创建数据
 * @returns 创建的处方信息
 * @throws BadRequestException 当药品信息无效时
 * @throws UnauthorizedException 当用户无权限时
 */
async createPrescription(createPrescriptionDto: CreatePrescriptionDto): Promise<PrescriptionDto>
```

---

## 🔒 安全要求

### 认证授权
- 所有API必须验证JWT
- 角色权限严格控制（医师、药房、管理员）
- 敏感操作需要二次验证

### 数据保护
- 密码必须加密存储
- 支付信息使用Stripe托管
- 数据传输强制HTTPS
- 医疗数据符合HIPAA标准

### 输入验证
- 所有用户输入必须验证
- 使用DTO进行数据验证
- 防止SQL注入和XSS攻击

---

## 🎨 性能要求

### 响应时间
- API响应：P95 < 300ms
- 数据库查询：< 100ms
- WebSocket事件：< 50ms

### 错误处理
- 友好的错误提示
- 网络异常的优雅降级
- 详细的错误日志记录

### 数据库优化
- 关键查询必须有索引
- 避免N+1查询问题
- 使用连接池管理

---

## 🔄 开发流程

### 螺旋式开发
1. 数据模型设计
2. API端点实现
3. 业务逻辑开发
4. 测试验证
5. 性能优化

### 代码审查
- 所有PR必须审查
- 重点检查安全性
- 确保测试覆盖
- 验证API文档

### 持续集成
- 每次提交运行测试
- 自动化代码质量检查
- 部署前完整验证

---

## 📊 质量标准

### 代码质量
- ESLint零错误
- TypeScript严格检查
- 测试覆盖率>80%
- 无安全漏洞

### 性能标准
- 数据库查询优化
- 内存使用合理
- 并发处理能力
- WebSocket连接稳定

### 可维护性
- 模块化设计
- 代码复用
- 文档完整
- 日志规范

---

## 💡 医疗平台特殊要求

### 合规要求
- 医疗数据隐私保护
- 处方数据审计追踪
- 药品信息准确性验证
- 支付数据安全处理

### 业务规则
- 处方有效期管理
- 药品库存实时同步
- 医师资质验证
- 药房许可证检查

---

## 🚀 MVP2.0开发目标

### 核心商业模式
**B2B2C差价盈利平台**：连接医师、药房和患者，通过处方流程实现差价收益

### 完整业务流程
```
医师开处方 → 计算总价(net_price) → 医师账户支付 → 生成QR码 
    ↓
药房扫码 → 配药履约 → 上传凭证 → 自动生成PO → 平台审核 → 药房收款
    ↓
平台收益 = net_price(医师支付) - PO_amount(药房成本) = 差价利润
```

### 四端架构目标
- **医师端**：处方创建、支付、状态跟踪
- **药房端**：扫码、履约、结算
- **患者端**：药房导航、反馈评价
- **管理员端**：审核、监控、财务管理

---

这些规则确保项目质量，提高开发效率，保护用户隐私，符合医疗行业标准。所有开发必须严格遵循。