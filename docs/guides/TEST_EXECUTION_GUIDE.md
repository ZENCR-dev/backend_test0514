# Phase 1 - Task 2: 基础用户认证系统测试执行指南

## 测试概览

本指南将帮助您执行 Phase 1 - Task 2 的所有测试用例，验证基础用户认证系统的功能完整性和安全性。

## 测试覆盖范围

### 单元测试
- **AuthService** (`src/auth/auth.service.spec.ts`)
  - 用户注册逻辑
  - 用户登录验证
  - 密码哈希和验证
  - JWT 生成
  - 用户状态检查

- **UserService** (`src/user/user.service.spec.ts`)
  - 用户创建 (CRUD)
  - 用户查找 (按邮箱/ID)
  - 用户状态更新
  - 数据库交互

- **RolesGuard** (`src/auth/guards/roles.guard.spec.ts`)
  - 角色权限检查
  - 多角色支持
  - 边界条件处理

### 集成测试
- **AuthController** (`src/auth/auth.controller.spec.ts`)
  - API 端点测试
  - HTTP 状态码验证
  - 输入验证
  - 认证和授权流程

## 执行步骤

### 1. 环境准备

确保您已完成以下步骤：

```bash
# 1. 确认 Node.js 和 npm 版本
node --version  # 应为 v22.14.0 或更高
npm --version   # 应为 v10.9.2 或更高

# 2. 确认项目目录
cd D:\develop\backend_test0514

# 3. 确认依赖已安装
npm list --depth=0
```

### 2. 环境变量检查

确认 `.env.development` 文件包含以下必要配置：

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YS$a!8yMy-jDxE2@db.ogfpdeaoknxpwzwmfnmp.supabase.co:5432/postgres
JWT_SECRET="73n1wkd7qp36pbmrmr12u6e4ln2lxkkb"
JWT_EXPIRES_IN="7d"
BCRYPT_SALT_ROUNDS="12"
```

### 3. 执行测试

#### 3.1 运行所有测试

```bash
# 运行所有测试用例
npm test

# 运行测试并生成覆盖率报告
npm run test:cov
```

#### 3.2 运行特定测试文件

```bash
# 运行 AuthService 单元测试
npm test -- src/auth/auth.service.spec.ts

# 运行 UserService 单元测试
npm test -- src/user/user.service.spec.ts

# 运行 RolesGuard 单元测试
npm test -- src/auth/guards/roles.guard.spec.ts

# 运行 AuthController 集成测试
npm test -- src/auth/auth.controller.spec.ts
```

#### 3.3 运行测试并监听文件变化

```bash
# 开发模式下运行测试（自动重新运行）
npm run test:watch
```

### 4. 预期测试结果

#### 4.1 成功标准

所有测试应该通过，预期输出类似：

```
Test Suites: 4 passed, 4 total
Tests:       XX passed, XX total
Snapshots:   0 total
Time:        X.XXXs
Ran all test suites.
```

#### 4.2 覆盖率目标

- **总体覆盖率**: ≥ 80%
- **核心业务逻辑**: ≥ 90%
- **关键安全功能**: 100%

#### 4.3 具体测试验证点

**AuthService 测试验证点：**
- ✅ 用户注册成功
- ✅ 重复邮箱注册失败
- ✅ 密码正确验证成功
- ✅ 密码错误验证失败
- ✅ 未批准用户登录失败
- ✅ JWT 生成正确

**UserService 测试验证点：**
- ✅ 用户创建包含档案信息
- ✅ 按邮箱查找用户
- ✅ 按 ID 查找用户
- ✅ 用户状态更新

**RolesGuard 测试验证点：**
- ✅ 无角色要求时允许访问
- ✅ 匹配角色时允许访问
- ✅ 不匹配角色时拒绝访问
- ✅ 无用户信息时拒绝访问

**AuthController 测试验证点：**
- ✅ POST /auth/register 成功注册
- ✅ POST /auth/register 重复邮箱返回 409
- ✅ POST /auth/register 无效输入返回 400
- ✅ POST /auth/login 成功登录
- ✅ POST /auth/login 无效凭据返回 401
- ✅ GET /auth/me 认证用户返回档案
- ✅ GET /auth/me 未认证返回 401
- ✅ GET /auth/admin-data 管理员访问成功
- ✅ GET /auth/admin-data 非管理员返回 403

## 故障排除

### 常见问题及解决方案

#### 1. 测试失败：模块导入错误

**错误信息：**
```
Cannot resolve dependency
```

**解决方案：**
```bash
# 重新安装依赖
npm ci

# 检查 TypeScript 编译
npx tsc --noEmit
```

#### 2. 测试失败：环境变量未找到

**错误信息：**
```
JWT_SECRET is not defined
```

**解决方案：**
- 确认 `.env.development` 文件存在且包含所有必要变量
- 检查文件路径和权限

#### 3. 测试失败：数据库连接问题

**错误信息：**
```
PrismaClientInitializationError
```

**解决方案：**
```bash
# 重新生成 Prisma 客户端
npx prisma generate

# 检查数据库连接
npx prisma db pull
```

#### 4. 测试超时

**解决方案：**
```bash
# 增加测试超时时间
npm test -- --testTimeout=10000
```

## 反馈结果格式

### 成功情况

请提供以下信息：

```
✅ 测试执行成功

📊 测试统计：
- 测试套件: X passed, X total
- 测试用例: X passed, X total
- 覆盖率: X%

🎯 关键验证点：
- [✅] 用户注册功能
- [✅] 用户登录功能
- [✅] JWT 认证功能
- [✅] 角色权限控制
- [✅] API 端点安全

💡 备注：[任何额外观察或建议]
```

### 失败情况

请提供以下信息：

```
❌ 测试执行失败

📋 失败详情：
- 失败的测试文件: [文件名]
- 失败的测试用例: [用例名]
- 错误信息: [完整错误信息]

🔧 已尝试的解决方案：
- [列出您尝试的解决步骤]

📝 环境信息：
- Node.js 版本: [版本号]
- npm 版本: [版本号]
- 操作系统: [系统信息]

❓ 需要协助：[具体需要帮助的问题]
```

## 下一步

测试通过后，我们将进入 Phase 1 的下一个任务：

- **Task 3**: 药品管理系统
- **Task 4**: 订单处理系统
- **Task 5**: 支付集成

每个任务都将遵循相同的测试驱动开发流程，确保代码质量和系统稳定性。 