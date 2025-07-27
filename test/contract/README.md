# API 契约测试脚本

## 📋 概述

本目录包含新西兰中医处方平台的 API 契约测试脚本，用于验证前后端 API 接口的兼容性和连通性。

## 🚀 快速运行

### 前端团队验证步骤

```bash
# 1. 安装依赖（如果尚未安装）
npm install

# 2. 运行契约测试
npm run test:contract

# 或者直接使用 Jest
npx jest --config=test/contract/jest.config.js

# 3. 运行特定测试文件
npx jest test/contract/response-format.contract.spec.ts
npx jest test/contract/endpoints.contract.spec.ts
```

### 环境配置

```bash
# 设置 API 基础地址（可选，默认为 Staging 环境）
export API_BASE_URL=https://staging-api.tcm.onrender.com

# 运行测试
npm run test:contract
```

## 📁 文件结构

```
test/contract/
├── README.md                           # 本说明文档
├── jest.config.js                      # Jest 配置文件
├── setup.ts                           # 测试环境设置
├── response-format.contract.spec.ts    # 响应格式静态验证
└── endpoints.contract.spec.ts          # 端点连通性验证
```

## 🧪 测试内容

### 1. 响应格式静态验证 (`response-format.contract.spec.ts`)

验证 `output/api-response-samples.json` 中的响应样本：

- ✅ 认证模块响应格式（登录、刷新、用户信息）
- ✅ 药品模块响应格式（列表、搜索、分页）
- ✅ 错误响应格式（401、404等）
- ✅ v1.2 规范compliance

### 2. 端点连通性验证 (`endpoints.contract.spec.ts`)

对 Staging 环境进行真实请求测试：

- 🌐 认证端点：`/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/refresh`
- 🌐 药品端点：`/api/v1/medicines` (列表、搜索、分页)
- 🌐 健康检查：`/health`
- 🌐 错误处理：404、无效数据处理
- 🌐 CORS 配置验证

## ✅ 验收标准

契约测试通过的标准：

1. **响应格式测试**: 100% 通过
2. **端点连通性测试**: 核心端点返回预期状态码
3. **无服务器错误**: 不应出现 500、502、503 错误
4. **测试执行时间**: < 2 分钟

## 🔧 故障排查

### 常见问题

**问题 1**: 测试超时
```bash
# 解决方案：增加环境变量或检查网络连接
export API_BASE_URL=https://staging-api.tcm.onrender.com
```

**问题 2**: 认证失败
```bash
# 解决方案：确认 Staging 环境用户存在
# 默认测试凭据: admin@example.com / password123
```

**问题 3**: 依赖缺失
```bash
# 解决方案：重新安装依赖
npm install --save-dev supertest @types/supertest
```

### 调试模式

```bash
# 启用详细日志
DEBUG=* npm run test:contract

# 只运行单个测试
npx jest --testNamePattern="登录端点连通性" test/contract/
```

## 📊 测试报告

测试完成后，将显示：

```
API Contract Tests
  ✓ 响应格式静态验证 (8 个测试)
  ✓ 端点连通性验证 (12 个测试)
  
总计: 20 个测试用例
通过率: 100%
执行时间: < 2 分钟
```

## 🚨 紧急联系

如果契约测试失败：

1. **立即通知**: 在 Slack #frontend-backend-integration 频道 @后端团队
2. **提供信息**: 粘贴完整的错误日志
3. **阻塞决策**: 如果测试未 100% 通过，联调暂停

## 📝 开发说明

本契约测试基于：
- **技术栈**: Jest + Supertest + TypeScript
- **设计原则**: 黑盒测试，专注连通性和格式验证
- **覆盖范围**: 认证模块 + 药品模块（第一阶段联调范围）

最后更新：2025年6月19日 20:35 NZST 