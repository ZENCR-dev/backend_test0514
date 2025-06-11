# MVP 1.0 部署架构设计

## 整体部署拓扑

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │  (CDN + WAF)    │
                    └─────────┬───────┘
                              │
                    ┌─────────▼───────┐
                    │  Load Balancer  │
                    │   (Render/Fly)  │
                    └─────────┬───────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼─────────┐ ┌──▼──┐ ┌─────────▼─────────┐
    │   Backend API     │ │     │ │   Admin Portal    │
    │  (NestJS + Node)  │ │     │ │    (React SPA)    │
    │                   │ │     │ │                   │
    │  - Core Service   │ │     │ │  - User Mgmt      │
    │  - Auth Service   │ │     │ │  - Order Review   │
    │  - File Service   │ │     │ │  - Analytics      │
    └─────────┬─────────┘ │     │ └───────────────────┘
              │           │     │
              │           │     │
    ┌─────────▼─────────┐ │     │ ┌─────────────────────┐
    │    Supabase       │ │     │ │   External APIs     │
    │                   │ │     │ │                     │
    │  - PostgreSQL     │ │     │ │  - Payment Gateway  │
    │  - Auth Service   │ │     │ │  - SMS/Email        │
    │  - File Storage   │ │     │ │  - Maps API         │
    │  - Edge Functions │ │     │ │  - Analytics        │
    └───────────────────┘ │     │ └─────────────────────┘
                          │     │
                          │     │
              ┌───────────▼─────▼─────────────┐
              │      Monitoring Suite        │
              │                              │
              │  - Sentry (Error Tracking)   │
              │  - DataDog (APM)            │
              │  - LogRocket (Session)       │
              │  - Uptime Monitoring        │
              └──────────────────────────────┘
```

## 环境配置策略

### 1. 开发环境 (Development)

```yaml
Backend:
  - Local Docker Compose
  - Supabase Local Development
  - Mock External Services
  
Database:
  - Local PostgreSQL via Supabase CLI
  - Test Data Seeding
  
File Storage:
  - Local Minio (S3 Compatible)
```

### 2. 预发布环境 (Staging)

```yaml
Backend:
  - Render.com Shared Instance
  - Environment Variables via Render
  - Real Supabase Project (Staging)
  
Database:
  - Supabase Staging Project
  - Production-like Data Volume
  
Monitoring:
  - Basic Health Checks
  - Error Reporting
```

### 3. 生产环境 (Production)

```yaml
Backend:
  - Render.com Professional/Enterprise
  - Auto-scaling enabled
  - Multiple regions (考虑延迟)
  
Database:
  - Supabase Pro Plan
  - Connection Pooling
  - Read Replicas (如需要)
  
Security:
  - WAF via Cloudflare
  - DDoS Protection
  - SSL/TLS Termination
  
Monitoring:
  - Full APM Stack
  - Real-time Alerts
  - Performance Monitoring
```

## 容器化策略 (Docker)

### Dockerfile优化

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs . .

USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Docker Compose (开发环境)

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: prescriptchain_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## CI/CD 流水线

### GitHub Actions配置

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker Image
        run: docker build -t prescriptchain-api .
      
      - name: Deploy to Render
        uses: render-deploy-action@v1
        with:
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}
          
      - name: Run Database Migrations
        run: |
          curl -X POST "${{ secrets.DEPLOY_HOOK_URL }}/migrate" \
            -H "Authorization: Bearer ${{ secrets.API_TOKEN }}"
            
      - name: Health Check
        run: |
          sleep 30
          curl -f "${{ secrets.API_URL }}/health" || exit 1
```

## 监控和告警策略

### 1. 应用性能监控 (APM)

```typescript
// 关键指标监控
const criticalMetrics = {
  response_time: {
    api_endpoints: "< 500ms (P95)",
    database_queries: "< 100ms (P95)",
    external_apis: "< 2s (P95)"
  },
  
  error_rates: {
    total_errors: "< 1%",
    critical_errors: "0%",
    user_facing_errors: "< 0.5%"
  },
  
  throughput: {
    requests_per_second: "Monitor baseline",
    concurrent_users: "Track peak usage",
    database_connections: "< 80% of limit"
  }
}
```

### 2. 业务指标监控

```typescript
const businessMetrics = {
  order_funnel: {
    order_creation_rate: "订单创建成功率",
    payment_success_rate: "支付成功率", 
    fulfillment_rate: "履约完成率"
  },
  
  user_experience: {
    registration_success: "注册成功率",
    login_success: "登录成功率",
    search_response_time: "搜索响应时间"
  }
}
```

### 3. 告警规则

```yaml
Critical Alerts (立即响应):
  - API响应时间 > 2s 持续5分钟
  - 错误率 > 5% 持续2分钟  
  - 数据库连接数 > 90%
  - 支付处理失败率 > 10%

Warning Alerts (工作时间响应):
  - API响应时间 > 1s 持续10分钟
  - 错误率 > 2% 持续5分钟
  - 磁盘使用率 > 80%
  - 内存使用率 > 85%
```

## 安全配置

### 1. 网络安全

- WAF规则配置 (SQL注入、XSS防护)
- DDoS保护和流量限制
- IP白名单管理 (管理后台)
- SSL/TLS配置和证书管理

### 2. 应用安全

- 环境变量加密存储
- API密钥轮换策略
- 数据库连接加密
- 日志敏感信息脱敏

### 3. 合规要求

- 医疗数据传输加密
- 审计日志完整性
- 备份数据安全存储
- 数据保留策略执行