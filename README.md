# TCM 处方平台后端服务 (Backend API)

**项目：** 新西兰中医药电子处方平台 MVP 1.0  
**技术栈：** NestJS + Prisma + TypeScript + Supabase PostgreSQL  
**版本：** 1.0.0  
**开发状态：** Phase 1 开发中 🚀  

---

## 🎯 项目概述

为新西兰中医师提供一个高效、便捷、合规的电子处方和草药调配协作平台，降低运营成本，提升患者服务体验，推动中医药在新西兰的现代化发展。

### 核心功能
- 🏥 **医生开方：** 电子处方创建与管理
- 💳 **诊所支付：** 预付/信用账户实时扣款
- 📱 **凭证生成：** QR码和PDF凭证系统
- 🏪 **药房履约：** 扫码验证与履约管理
- 👨‍💼 **管理审核：** 履约凭证审核流程
- 💰 **自动结算：** 平台与药房结算系统

---

## 🛠️ 技术栈

### 后端架构
- **框架：** [NestJS](https://nestjs.com/) (TypeScript)
- **数据库：** [Supabase PostgreSQL](https://supabase.com/)
- **ORM：** [Prisma](https://www.prisma.io/)
- **认证：** Supabase Auth + JWT
- **文件存储：** Supabase Storage
- **API规范：** OpenAPI 3.0 (Swagger)

### 开发工具
- **语言：** TypeScript 5.8+
- **包管理：** npm
- **测试：** Jest + Supertest
- **代码规范：** ESLint + Prettier
- **版本控制：** Git

---

## 📊 当前开发进度

### ✅ Phase 0: 技术决策与准备 (已完成)
- [x] 技术栈确认
- [x] 项目架构设计
- [x] 核心文档完成

### 🔄 Phase 1: 核心基础设施与服务搭建 (进行中 - 30%)
- [x] **Task 1:** Prisma Schema实现与数据库初始化 ✅
  - 18个关键业务索引优化
  - 数据完整性约束验证
  - 测试覆盖率验证通过
- [ ] **Task 2:** NestJS项目骨架与核心模块搭建 🔄
- [ ] **Task 3:** 用户与认证服务
- [ ] **Task 4:** 药品信息管理服务
- [ ] **Task 5:** 核心业务服务 ⭐ (重点攻关)
- [ ] **Task 6:** 支付与结算服务
- [ ] **Task 7:** 文件服务与药房服务
- [ ] **Task 8:** 通知服务

### 📈 预计时间线
- **Phase 1 完成：** 2025年2月初
- **MVP 1.0 上线：** 2025年3月

详细进度请查看：[DEVELOPMENT_PROGRESS_TRACKER.md](./DEVELOPMENT_PROGRESS_TRACKER.md)

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 9+
- PostgreSQL 15+ (或 Supabase 账户)

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/ZENCR-dev/backend_test0514.git
cd backend_test0514
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
# 设置数据库连接、Supabase配置等
```

4. **数据库设置**
```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移 (生产环境)
npx prisma migrate deploy

# 或推送 Schema 到数据库 (开发环境)
npx prisma db push
```

5. **启动开发服务器**
```bash
npm run start:dev
```

6. **访问API文档**
```
http://localhost:3000/api/docs
```

---

## 📁 项目结构

```
backend_test0514/
├── prisma/                 # 数据库Schema和迁移
│   ├── schema.prisma       # Prisma数据模型
│   └── migrations/         # 数据库迁移文件
├── src/                    # 源代码
│   ├── auth/              # 认证模块
│   ├── user/              # 用户管理
│   ├── config/            # 配置管理
│   ├── prisma/            # Prisma服务
│   └── main.ts            # 应用入口
├── test/                  # 测试文件
├── docs/                  # 文档目录
│   └── SOP1.3devdocs/     # 开发规范文档
├── DEVELOPMENT_PROGRESS_TRACKER.md  # 开发进度追踪
├── PrismaSchemav2.md      # 数据库设计文档
└── README.md              # 项目说明
```

---

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行测试并查看覆盖率
npm run test:cov

# 监听模式运行测试
npm run test:watch
```

### 测试覆盖率目标
- **核心业务逻辑：** ≥95%
- **支付相关功能：** 100%
- **认证授权：** ≥90%

---

## 📚 API 文档

### Swagger UI
开发环境访问：http://localhost:3000/api/docs

### 核心API端点
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/register` - 用户注册
- `GET /api/v1/users/profile` - 获取用户信息
- `POST /api/v1/orders` - 创建订单
- `GET /api/v1/medicines/search` - 药品搜索

详细API文档请查看：[API设计规范和核心端点.md](./SOP1.3devdocs/)

---

## 🔒 安全

### 安全特性
- JWT认证授权
- 基于角色的访问控制 (RBAC)
- 数据库行级安全 (RLS)
- 输入验证和净化
- SQL注入防护
- 敏感数据加密

### 环境变量
重要：请勿将 `.env` 文件提交到版本控制中。

---

## 🏗️ 部署

### 开发环境
```bash
npm run start:dev
```

### 生产环境
```bash
# 构建应用
npm run build

# 启动生产服务器
npm run start
```

### Docker部署
```bash
# 构建Docker镜像
docker build -t tcm-backend .

# 运行容器
docker run -p 3000:3000 tcm-backend
```

---

## 🤝 贡献指南

### 开发流程
1. 从 `develop` 分支创建功能分支
2. 遵循代码规范和提交信息规范
3. 确保测试通过
4. 提交Pull Request

### 代码规范
- 使用 ESLint 和 Prettier
- 遵循 TypeScript 严格模式
- 编写有意义的测试用例
- 添加适当的注释和文档

### 提交信息规范
```
feat: 添加用户认证功能
fix: 修复订单状态更新问题
docs: 更新API文档
test: 添加支付服务测试用例
```

---

## 📄 许可证

[MIT License](./LICENSE)

---

## 📞 联系方式

- **项目团队：** ZENCR-dev
- **技术支持：** [GitHub Issues](https://github.com/ZENCR-dev/backend_test0514/issues)
- **文档：** [项目文档](./SOP1.3devdocs/)

---

## 🎯 路线图

### Phase 1 (当前)
- [x] 数据库设计完成
- [ ] 认证授权系统
- [ ] 核心业务逻辑
- [ ] 支付结算系统

### Phase 2 (计划)
- [ ] 性能优化
- [ ] 监控告警
- [ ] 安全增强
- [ ] API扩展

---

*最后更新：2024年12月11日* 