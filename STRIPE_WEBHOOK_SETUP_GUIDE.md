# Stripe Webhook配置指南

## 🎯 概述

本指南提供了两种Stripe Webhook配置方法：
1. **本地开发** - 使用Stripe CLI（推荐）
2. **生产环境** - 使用Stripe Dashboard

## 🔧 方法1：本地开发 - Stripe CLI（已配置完成）

### ✅ 当前状态
- Stripe CLI已下载并配置在项目目录
- Webhook监听器正在运行
- 测试事件触发成功

### 使用的命令
```bash
# 启动webhook监听（已在后台运行）
.\stripe-cli\stripe.exe listen --forward-to localhost:3000/api/v1/payments/webhook --api-key YOUR_STRIPE_SECRET_KEY

# 测试webhook事件
.\stripe-cli\stripe.exe trigger payment_intent.succeeded --api-key YOUR_STRIPE_SECRET_KEY
```

### 优势
- ✅ 无需外部配置
- ✅ 实时事件转发
- ✅ 本地开发友好
- ✅ 自动处理签名验证

## 🌐 方法2：生产环境 - Stripe Dashboard

### 配置步骤

1. **访问Stripe Dashboard**
   - 登录：https://dashboard.stripe.com
   - 导航到：开发者 → Webhooks

2. **创建Webhook端点**
   - 点击"添加端点"
   - 端点URL：`https://your-domain.com/api/v1/payments/webhook`
   - 描述：TCM Platform Payment Webhooks

3. **选择监听事件**
   ```
   ✅ payment_intent.succeeded
   ✅ payment_intent.payment_failed
   ✅ invoice.payment_succeeded
   ✅ invoice.payment_failed
   ✅ customer.subscription.created
   ✅ customer.subscription.updated
   ✅ customer.subscription.deleted
   ```

4. **获取Webhook签名密钥**
   - 创建端点后，点击端点名称
   - 复制"签名密钥"（以`whsec_`开头）
   - 更新`.env`文件中的`STRIPE_WEBHOOK_SECRET`

## 🔍 验证配置

### 检查Webhook监听器状态
```bash
# 检查进程
Get-Process -Name "stripe" -ErrorAction SilentlyContinue

# 触发测试事件
.\stripe-cli\stripe.exe trigger payment_intent.succeeded --api-key YOUR_API_KEY
```

### 检查应用端点
```bash
# 测试webhook端点
curl -X POST http://localhost:3000/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'
```

## 📊 当前配置状态

### ✅ 已完成
- Stripe CLI下载和配置
- Webhook监听器启动
- 本地端点映射：`localhost:3000/api/v1/payments/webhook`
- 测试事件触发成功

### 🔄 运行中的服务
- **NestJS应用**：http://localhost:3000
- **Stripe Webhook监听器**：转发到本地端点
- **API文档**：http://localhost:3000/api/docs

## 🚀 下一步

1. **开发阶段**：继续使用当前的Stripe CLI配置
2. **测试阶段**：验证webhook事件处理逻辑
3. **部署阶段**：配置生产环境的Dashboard Webhook

## 🛠️ 故障排除

### 常见问题

**问题1：Stripe CLI命令不识别**
```bash
# 解决方案：使用完整路径
.\stripe-cli\stripe.exe [command]
```

**问题2：Webhook事件未收到**
```bash
# 检查监听器状态
Get-Process -Name "stripe"

# 重启监听器
.\stripe-cli\stripe.exe listen --forward-to localhost:3000/api/v1/payments/webhook --api-key YOUR_STRIPE_SECRET_KEY
```

**问题3：签名验证失败**
- 确保`.env`中的`STRIPE_WEBHOOK_SECRET`正确
- 本地开发时，Stripe CLI会自动处理签名

## 📝 注意事项

1. **安全性**：生产环境必须使用HTTPS
2. **签名验证**：始终验证webhook签名
3. **幂等性**：webhook处理应该是幂等的
4. **错误处理**：实现适当的错误处理和重试机制

---

**配置完成！** 🎉

您的Stripe Webhook配置已完成，可以开始开发和测试支付功能了。 