# 🚀 前端契约测试集成指南

**交付日期**: 2025-06-19 20:45 NZST  
**后端团队**: 新西兰中医处方平台后端组  
**目标**: 前端团队独立运行API契约测试  

## 📦 **交付包内容**

```
delivery-package/
├── FRONTEND_INTEGRATION_GUIDE.md          # 本集成指南
├── api-response-samples.json              # API响应样本数据
├── contract-tests/                        # 契约测试套件
│   ├── response-format.contract.spec.ts   # 响应格式验证 (核心)
│   ├── endpoints.contract.spec.ts         # 端点连通性测试
│   ├── endpoints-demo.contract.spec.ts    # 端点测试演示版
│   ├── jest.config.js                     # Jest配置文件
│   ├── setup.ts                          # 测试环境设置
│   └── README.md                          # 详细使用说明
├── package-scripts.json                   # npm脚本片段
└── DELIVERY_REPORT_契约测试_20250619.md    # 完整交付报告
```

## 🔧 **前端项目集成步骤**

### 步骤1: 复制文件到前端项目

```bash
# 在前端项目根目录执行
mkdir -p test/contract
mkdir -p output

# 复制测试文件
cp ../backend_test0514/delivery-package/contract-tests/* test/contract/
cp ../backend_test0514/delivery-package/api-response-samples.json output/

# 复制集成指南
cp ../backend_test0514/delivery-package/FRONTEND_INTEGRATION_GUIDE.md .
```

### 步骤2: 安装依赖

```bash
# 安装契约测试所需依赖
npm install --save-dev supertest @types/supertest

# 验证Jest是否已安装 (通常前端项目已有)
npm list jest
```

### 步骤3: 更新package.json

将以下脚本添加到前端项目的`package.json`中：

```json
{
  "scripts": {
    "test:contract": "jest --config=test/contract/jest.config.js",
    "test:contract:format": "jest --config=test/contract/jest.config.js test/contract/response-format.contract.spec.ts",
    "test:contract:endpoints": "jest --config=test/contract/jest.config.js test/contract/endpoints.contract.spec.ts",
    "test:contract:demo": "jest --config=test/contract/jest.config.js test/contract/endpoints-demo.contract.spec.ts"
  }
}
```

### 步骤4: 立即验证 (P0级)

```bash
# 核心验收测试 - 必须100%通过
npm run test:contract:format

# 查看端点测试逻辑演示
npm run test:contract:demo
```

## 🎯 **验收标准**

### ✅ **核心验收 (必须通过)**
运行`npm run test:contract:format`应该显示：
```
✓ POST /auth/login - 登录成功响应格式
✓ POST /auth/login - 登录错误响应格式  
✓ POST /auth/refresh - Token刷新响应格式
✓ GET /auth/me - 用户信息响应格式
✓ GET /medicines - 药品列表响应格式
✓ GET /medicines?search= - 药品搜索响应格式
✓ GET /medicines - 分页信息响应格式
✓ 401 Unauthorized - 无效Token错误格式
✓ API 响应样本文件结构验证

Tests: 9 passed, 9 total ✅
```

### ⚠️ **环境依赖测试 (可选)**
如果需要测试实际端点连通性：
```bash
# 设置后端环境 (Staging)
export API_BASE_URL=https://staging-api.tcm.onrender.com
npm run test:contract:endpoints

# 或设置本地环境
export API_BASE_URL=http://localhost:3000
npm run test:contract:endpoints
```

## 📞 **反馈要求**

### 🔥 **立即行动 - 21:30前完成**

1. **运行核心测试**: `npm run test:contract:format`
2. **截图结果**: 包含完整的测试输出
3. **Slack反馈**: 在 #frontend-backend-integration 频道发布：
   - 截图
   - 明确状态："✅ 前端验证通过" 或 "❌ 前端验证失败，原因：..."

## 🚨 **常见问题解决**

### Q1: "找不到api-response-samples.json"
```bash
# 确保文件路径正确
ls -la output/api-response-samples.json
# 如果不存在，重新复制
cp ../backend_test0514/delivery-package/api-response-samples.json output/
```

### Q2: "supertest依赖问题"
```bash
# 重新安装
npm install --save-dev supertest@6.0.3 @types/supertest
```

### Q3: "Jest配置冲突"
```bash
# 使用独立配置
npx jest --config=test/contract/jest.config.js test/contract/response-format.contract.spec.ts
```

## ⚡ **紧急联系**

如遇任何问题，立即联系：
- **Slack**: #frontend-backend-integration 频道 @后端团队
- **紧急情况**: 核心小组群组

---

**🎯 目标：确保明日09:00联调成功启动！**

后端团队已完成任务，现在靠前端团队最后验证！🚀 