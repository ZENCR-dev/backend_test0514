# 本地代码库自检流程 (提交前执行) - NestJS后端项目

## 📋 目的

此流程旨在确保在将代码推送到远程仓库并在 GitHub Actions 中触发正式 CI 构建之前，代码已在本地通过了关键的质量检查。遵循此流程有助于减少 CI 失败的次数，并提高代码库的整体质量。

**一旦完成本流程自检，则执行 `git commit` 和 `git push` 推送到远程仓库**

## 🔧 前置条件

- **Node.js 版本**：建议使用 Node.js 20.x 或 22.x LTS 版本（与 GitHub Actions CI 环境一致）
- **项目依赖**：已通过 `npm install` 或 `npm ci` 正确安装
- **数据库**：Prisma 客户端已生成（运行过 `npx prisma generate`）
- **Git钩子**：已安装 pre-push 钩子（可选但强烈推荐）

## 🚀 快速开始

### 自动安装Git钩子（推荐）

```bash
# 安装pre-push钩子，自动在每次推送前执行CI自检
node scripts/install-git-hooks.js
```

### 手动执行完整CI自检

```bash
# 执行完整的本地CI自检流程
npm run ci-check
```

### 快速检查（仅核心质量检查）

```bash
# 仅执行代码质量检查（不包含测试和构建）
npm run ci-check:quick
```

## 📝 检查步骤详解

在每次执行 `git commit` 和 `git push` 之前，请在项目根目录下按顺序执行以下所有检查步骤：

### 1. 依赖管理检查

确保您的本地依赖与 `package-lock.json` 文件同步。

```bash
# 清理安装依赖（推荐）
npm ci
```

或者，如果只是更新：

```bash
npm install
```

**目标**: 确保依赖的一致性，避免因依赖问题导致的构建或运行时错误。

### 2. 代码质量检查

#### 2.1 ESLint 代码检查

检查代码风格、潜在错误和最佳实践符合性。

```bash
npm run lint:check
```

**目标**:
- **必须修复所有 ESLint 报告的错误 (Errors)。**
- 强烈建议修复所有警告 (Warnings) 以保持代码整洁。
- 在此步骤完成后，不应有任何 ESLint 错误输出。

#### 2.2 TypeScript 类型检查

检查 TypeScript 类型错误和类型安全性。

```bash
npx tsc --noEmit
```

**目标**:
- **必须修复所有 TypeScript 类型错误。**
- 确保类型定义完整和准确。

#### 2.3 Prettier 格式检查

检查代码格式一致性。

```bash
npx prettier --check "src/**/*.{ts,js,json}"
```

**目标**:
- **代码格式必须符合 Prettier 规范。**
- 如有格式问题，运行 `npm run format` 自动修复。

#### 2.4 Prisma Schema 验证

验证数据库模式定义的正确性。

```bash
npx prisma validate
```

**目标**:
- **Prisma schema 文件必须语法正确。**
- 数据库关系和字段定义必须有效。

### 3. 测试检查

#### 3.1 Prisma 客户端生成

确保 Prisma 客户端与 schema 同步。

```bash
npx prisma generate
```

#### 3.2 单元测试执行

运行所有单元测试，确保功能正确性。

```bash
npm test
```

**目标**:
- **所有测试必须通过。**
- 新增功能必须有对应的测试覆盖。

#### 3.3 测试覆盖率检查

检查测试覆盖率是否达到项目要求。

```bash
npm run test:cov
```

**目标**:
- 保持合理的测试覆盖率（建议 >80%）。
- 核心业务逻辑必须有测试覆盖。

### 4. 构建检查

#### 4.1 应用构建

编译整个应用，检查构建时错误。

```bash
npm run build
```

**目标**:
- **构建过程必须成功完成，没有任何错误。**
- 生成的 `dist/` 目录必须包含完整的构建产物。

### 5. 安全检查

#### 5.1 依赖安全审计

检查项目依赖中的已知安全漏洞。

```bash
npm audit --audit-level=moderate
```

**目标**:
- 修复中等级别以上的安全漏洞。
- 定期更新依赖以获取安全补丁。

#### 5.2 依赖版本检查

检查过时的依赖包。

```bash
npm outdated
```

**目标**:
- 了解依赖更新情况。
- 考虑更新主要依赖到最新稳定版本。

## 🔒 强制执行规则

### Pre-push 钩子

安装 Git pre-push 钩子后，每次推送都会自动执行 CI 自检：

```bash
# 安装钩子
node scripts/install-git-hooks.js

# 正常推送（会自动触发CI自检）
git push origin your-branch
```

### 文档例外规则

**只有以下类型的文件修改可以绕过完整的CI自检**：
- `*.md` - Markdown文档
- `*.txt` - 文本文件
- `docs/` - 文档目录
- `README*` - README文件
- `CHANGELOG*` - 变更日志
- `LICENSE*` - 许可证文件

### 强制推送（不推荐）

如果必须绕过CI自检推送，可以使用：

```bash
git push --no-verify origin your-branch
```

**⚠️ 警告**: 仅在紧急情况下使用，可能导致CI失败。

## 📊 自检命令总览

| 命令 | 用途 | 执行时间 | 是否必需 |
|------|------|----------|----------|
| `npm run ci-check` | 完整CI自检流程 | 3-5分钟 | ✅ 推送前必需 |
| `npm run ci-check:quick` | 快速质量检查 | 30秒-1分钟 | 🔄 开发时推荐 |
| `npm run lint:check` | ESLint检查 | 10-20秒 | ✅ 必需 |
| `npm run format:check` | Prettier检查 | 5-10秒 | ✅ 必需 |
| `npm test` | 单元测试 | 1-2分钟 | ✅ 必需 |
| `npm run build` | 构建检查 | 30秒-1分钟 | ✅ 必需 |

## 🎯 最佳实践

### 开发工作流建议

1. **开发过程中**：定期运行 `npm run ci-check:quick` 进行快速检查
2. **提交前**：运行完整的 `npm run ci-check`
3. **推送前**：确保所有检查通过（自动通过pre-push钩子执行）

### 问题排查

#### 常见问题解决方案

**ESLint错误**：
```bash
# 自动修复大部分ESLint问题
npm run lint

# 手动检查剩余问题
npm run lint:check
```

**Prettier格式问题**：
```bash
# 自动修复格式问题
npm run format

# 验证修复结果
npm run format:check
```

**测试失败**：
```bash
# 监听模式运行测试，实时查看结果
npm run test:watch

# 调试模式运行特定测试
npm run test:debug -- --testPathPattern=your-test-file
```

**构建失败**：
```bash
# 检查TypeScript类型错误
npx tsc --noEmit

# 清理后重新构建
rm -rf dist node_modules
npm ci
npm run build
```

## 🤝 团队协作

### 提交指南

- **只有当上述核心检查步骤（特别是 ESLint、TypeScript类型检查、测试和构建）都成功通过并没有报告任何错误时，才可将代码提交到仓库。**
- 确认所有本地检查均已通过后，才可推送到远程仓库。
- GitHub Actions 中的 CI 工作流将作为最终的线上质量把关。

### 代码审查

- Pull Request 创建前，确保本地CI自检完全通过
- 代码审查者应验证CI状态为绿色
- 合并前再次确认所有检查通过

---

**遵循此本地自检流程，将有助于提升开发效率和代码质量，减少线上CI失败，保持代码库的健康状态。** 