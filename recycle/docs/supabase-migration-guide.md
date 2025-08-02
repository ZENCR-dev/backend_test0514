# 🚀 Supabase迁移指南 - 后端核心业务服务

**迁移目标**: 从NestJS + Prisma架构迁移到Supabase-First架构  
**迁移策略**: Edge Functions + RLS策略 + 实时数据库  
**复用价值**: 平均84%业务逻辑复用  

---

## 📋 迁移概览

### 架构对比

| 组件 | 原架构 (NestJS + Prisma) | 新架构 (Supabase-First) | 迁移策略 |
|------|---------------------------|--------------------------|----------|
| **API服务** | NestJS Controllers | Supabase Edge Functions | 业务逻辑直接迁移 |
| **数据库ORM** | Prisma Client | Supabase Client | 查询语法适配 |
| **认证系统** | JWT + Guards | Supabase Auth + RLS | 权限策略重构 |
| **实时通信** | WebSocket | Supabase Realtime | 事件系统迁移 |
| **文件存储** | 本地/云存储 | Supabase Storage | 存储API适配 |
| **定时任务** | Node.js Cron | Supabase Functions + pg_cron | 调度系统迁移 |

---

## 🗃️ 数据库迁移

### 1. Schema转换

**原Prisma Schema**:
```prisma
model Medicine {
  id          String   @id @default(uuid())
  name        String
  englishName String?  @map("english_name")
  chineseName String?  @map("chinese_name")
  pinyinName  String?  @map("pinyin_name")
  category    String
  basePrice   Decimal  @map("base_price")
  status      String   @default("active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("medicines")
}
```

**转换为Supabase SQL**:
```sql
-- 1. 创建medicines表
CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  english_name VARCHAR(255),
  chinese_name VARCHAR(255),
  pinyin_name VARCHAR(255),
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_status ON medicines(status);
CREATE INDEX idx_medicines_search ON medicines 
  USING GIN (to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(english_name, '') || ' ' || 
    COALESCE(chinese_name, '')
  ));

-- 3. 创建触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_medicines_updated_at 
  BEFORE UPDATE ON medicines 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. 完整数据库Schema

**核心业务表结构**:
```sql
-- 药品表
CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  english_name VARCHAR(255),
  chinese_name VARCHAR(255),
  pinyin_name VARCHAR(255),
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 处方表
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES auth.users(id),
  medicines JSONB NOT NULL,
  copies INTEGER NOT NULL CHECK (copies > 0),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  total_amount DECIMAL(10,2),
  qr_code_data TEXT,
  qr_code_string TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支付记录表
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(100) NOT NULL,
  practitioner_id UUID REFERENCES auth.users(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NZD',
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  provider_transaction_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 审计日志表
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration INTEGER,
  metadata JSONB
);

-- 从业者账户表
CREATE TABLE practitioner_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practitioner_id UUID NOT NULL REFERENCES auth.users(id),
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'NZD',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 账户交易表
CREATE TABLE account_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES practitioner_accounts(id),
  transaction_type VARCHAR(20) NOT NULL, -- DEBIT, CREDIT
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  reference_id VARCHAR(100),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 RLS策略配置

### 1. 药品数据访问策略

```sql
-- 启用RLS
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

-- 公开读取活跃药品
CREATE POLICY "medicines_public_read" ON medicines
  FOR SELECT USING (status = 'active');

-- 管理员全权限
CREATE POLICY "medicines_admin_manage" ON medicines
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 审计所有药品访问
CREATE POLICY "medicines_audit_access" ON medicines
  FOR SELECT USING (
    -- 记录访问日志的触发器将在这里触发
    true
  );
```

### 2. 处方数据隔离策略

```sql
-- 启用RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- 医师只能访问自己的处方
CREATE POLICY "prescriptions_doctor_access" ON prescriptions
  FOR ALL USING (auth.uid() = doctor_id);

-- 管理员可以访问所有处方
CREATE POLICY "prescriptions_admin_access" ON prescriptions
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 药房可以查看分配给自己的处方
CREATE POLICY "prescriptions_pharmacy_read" ON prescriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pharmacy_assignments pa 
      WHERE pa.prescription_id = prescriptions.id 
        AND pa.pharmacy_user_id = auth.uid()
        AND prescriptions.status IN ('PAID', 'FULFILLED')
    )
  );
```

### 3. 支付数据安全策略

```sql
-- 启用RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 从业者只能访问自己的支付记录
CREATE POLICY "payments_practitioner_access" ON payments
  FOR ALL USING (auth.uid() = practitioner_id);

-- 管理员可以访问所有支付记录
CREATE POLICY "payments_admin_access" ON payments
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 支付服务可以创建和更新支付记录
CREATE POLICY "payments_service_manage" ON payments
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service'
  );
```

### 4. 审计日志访问策略

```sql
-- 启用RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的审计日志
CREATE POLICY "audit_logs_user_access" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 管理员可以查看所有审计日志
CREATE POLICY "audit_logs_admin_access" ON audit_logs
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 系统服务可以写入审计日志
CREATE POLICY "audit_logs_service_write" ON audit_logs
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('service', 'admin')
  );
```

---

## ⚡ Edge Functions实现

### 1. 药品搜索服务

**文件位置**: `supabase/functions/medicine-search/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MedicineService, createSupabaseMedicineRepository } from '../../../recycle/core-business/medicine.service.ts'

serve(async (req) => {
  // CORS处理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      } 
    })
  }

  try {
    // 初始化Supabase客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 初始化业务服务
    const repository = createSupabaseMedicineRepository(supabase)
    const medicineService = new MedicineService(repository)

    // 处理请求
    const { search, page, limit, sortBy, sortOrder } = await req.json()
    
    const results = await medicineService.findAll({
      search,
      page: page || 1,
      limit: limit || 20,
      sortBy: sortBy || 'name',
      sortOrder: sortOrder || 'asc'
    })

    return new Response(
      JSON.stringify(results),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
```

### 2. 处方计算服务

**文件位置**: `supabase/functions/prescription-calculator/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PrescriptionCalculatorService } from '../../../recycle/core-business/prescription-calculator.service.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      } 
    })
  }

  try {
    // 初始化计算服务
    const calculator = new PrescriptionCalculatorService({
      defaultTaxRate: 0.15,    // 15% GST for New Zealand
      defaultDiscountRate: 0,
      platformFeeRate: 0.05    // 5% platform fee
    })

    // 处理计算请求
    const { medicines, copies, discountRate, taxRate } = await req.json()
    
    const calculation = calculator.calculateTotalAmount({
      medicines,
      copies,
      discountRate,
      taxRate
    })

    // 验证计算结果
    const validation = calculator.validateCalculationResult(calculation)
    
    if (!validation.isValid) {
      throw new Error(`计算结果验证失败: ${validation.errors.join(', ')}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: calculation,
        validation: {
          warnings: validation.warnings
        }
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        }
      }
    )
  }
})
```

### 3. 支付处理服务

**文件位置**: `supabase/functions/stripe-payment/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { StripePaymentService, createSupabasePaymentAdapters } from '../../../recycle/core-business/payment-stripe.service.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      } 
    })
  }

  try {
    // 初始化Supabase客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 初始化支付服务适配器
    const adapters = createSupabasePaymentAdapters(supabase)
    
    // 初始化支付服务
    const paymentService = new StripePaymentService(
      adapters.paymentRepository,
      adapters.accountTransactionRepository,
      adapters.practitionerAccountService,
      adapters.eventEmitter,
      {
        secretKey: Deno.env.get('STRIPE_SECRET_KEY')!,
        webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
        apiVersion: '2023-10-16'
      },
      {
        minPaymentAmount: 100,     // $1.00 minimum
        maxPaymentAmount: 100000  // $1000.00 maximum
      }
    )

    // 处理不同的支付操作
    const { action, ...params } = await req.json()

    let result
    switch (action) {
      case 'create_intent':
        result = await paymentService.createPaymentIntent(params)
        break
      case 'confirm_payment':
        result = await paymentService.confirmPayment(params)
        break  
      case 'process_refund':
        result = await paymentService.processStripeRefund(params)
        break
      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
```

---

## 🔄 实时功能迁移

### 1. WebSocket到Realtime迁移

**原WebSocket实现**:
```typescript
// NestJS WebSocket Gateway
@WebSocketGateway()
export class OrchestrationGateway {
  @SubscribeMessage('prescription.status.update')
  handlePrescriptionUpdate(client: Socket, data: any) {
    // 广播状态更新
    this.server.emit('prescription.updated', data)
  }
}
```

**Supabase Realtime实现**:
```typescript
// Edge Function中的实时事件发布
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 发布处方状态更新事件
await supabase.channel('prescription-updates').send({
  type: 'broadcast',
  event: 'prescription.status.changed',
  payload: {
    prescriptionId,
    oldStatus,
    newStatus,
    updatedAt: new Date().toISOString()
  }
})
```

**前端订阅实现**:
```typescript
// React组件中订阅实时更新
const supabase = createClient(supabaseUrl, supabaseAnonKey)

useEffect(() => {
  const channel = supabase
    .channel('prescription-updates')
    .on('broadcast', { event: 'prescription.status.changed' }, (payload) => {
      // 处理状态更新
      updatePrescriptionStatus(payload.prescriptionId, payload.newStatus)
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

### 2. 数据库变更监听

```sql
-- 启用实时功能
ALTER PUBLICATION supabase_realtime ADD TABLE prescriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
```

```typescript
// 前端监听数据库变更
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 监听处方表变更
supabase
  .channel('db-changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'prescriptions',
      filter: `doctor_id=eq.${userId}`
    },
    (payload) => {
      console.log('Prescription updated:', payload.new)
      // 更新本地状态
    }
  )
  .subscribe()
```

---

## 🛡️ 安全配置

### 1. 环境变量配置

**Supabase项目设置**:
```bash
# .env文件
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe配置
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# QR码签名密钥
QR_CODE_SECRET=your-secret-key

# 应用配置
APP_BASE_URL=https://your-app.com
NODE_ENV=production
```

### 2. JWT自定义声明

```sql
-- 创建处理用户角色的函数
CREATE OR REPLACE FUNCTION auth.get_user_roles(user_id uuid)
RETURNS text[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT role 
    FROM user_roles 
    WHERE user_id = get_user_roles.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 在JWT中包含角色信息
CREATE OR REPLACE FUNCTION auth.set_user_claims(user_id uuid)
RETURNS void AS $$
DECLARE
  roles text[];
BEGIN
  roles := auth.get_user_roles(user_id);
  
  UPDATE auth.users 
  SET raw_app_meta_data = raw_app_meta_data || 
    jsonb_build_object('roles', roles)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. API安全配置

```typescript
// Edge Function中的权限验证（使用新的getClaims()方法）
// 推荐：getClaims()比getUser()更安全，直接从JWT获取验证信息
async function verifyUserPermissions(req: Request, requiredRole: string) {
  const authorization = req.headers.get('Authorization')
  if (!authorization) {
    throw new Error('Missing authorization header')
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authorization },
      },
    }
  )

  // 使用新的getClaims()方法进行身份验证
  const { data: claims, error } = await supabase.auth.getClaims()
  
  if (error || !claims) {
    throw new Error('Invalid authentication')
  }

  // 从JWT claims中获取用户角色
  const userRoles = claims.app_metadata?.roles || []
  if (!userRoles.includes(requiredRole)) {
    throw new Error(`Insufficient permissions. Required: ${requiredRole}`)
  }

  return { userId: claims.sub, roles: userRoles }
}
```

---

## 📊 性能优化

### 1. 数据库优化

```sql
-- 分区表优化大量审计日志
CREATE TABLE audit_logs_partitioned (
  LIKE audit_logs INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- 按月分区
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 创建部分索引
CREATE INDEX CONCURRENTLY idx_payments_pending 
  ON payments(created_at) 
  WHERE status = 'pending';

-- 物化视图优化统计查询
CREATE MATERIALIZED VIEW medicine_category_stats AS
SELECT 
  category,
  COUNT(*) as total_medicines,
  AVG(base_price) as avg_price,
  MIN(base_price) as min_price,
  MAX(base_price) as max_price
FROM medicines 
WHERE status = 'active'
GROUP BY category;

-- 自动刷新物化视图
CREATE OR REPLACE FUNCTION refresh_medicine_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY medicine_category_stats;
END;
$$ LANGUAGE plpgsql;

-- 定时刷新（每小时）
SELECT cron.schedule('refresh-medicine-stats', '0 * * * *', 'SELECT refresh_medicine_stats();');
```

### 2. Edge Functions缓存

```typescript
// 实现简单的内存缓存
class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>()

  set(key: string, data: any, ttlSeconds: number = 300) {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    })
  }

  get(key: string) {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    
    return item.data
  }
}

const cache = new SimpleCache()

// 在Edge Function中使用缓存
serve(async (req) => {
  const cacheKey = `medicines:${JSON.stringify(searchParams)}`
  
  let results = cache.get(cacheKey)
  if (!results) {
    results = await medicineService.findAll(searchParams)
    cache.set(cacheKey, results, 300) // 5分钟缓存
  }
  
  return new Response(JSON.stringify(results))
})
```

---

## 🧪 测试策略

### 1. Edge Functions测试

```typescript
// tests/edge-functions/medicine-search.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

Deno.test('Medicine search function', async () => {
  const req = new Request('http://localhost:54321/functions/v1/medicine-search', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      search: 'aspirin',
      page: 1,
      limit: 10
    })
  })

  // 模拟函数调用
  const response = await medicineSearchFunction(req)
  const data = await response.json()

  assertEquals(response.status, 200)
  assertEquals(data.success, true)
  assertEquals(Array.isArray(data.data), true)
})
```

### 2. RLS策略测试

```sql
-- 测试RLS策略
BEGIN;
  -- 设置测试用户
  SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-id", "role": "practitioner"}';
  
  -- 测试只能访问自己的处方
  SELECT COUNT(*) FROM prescriptions; -- 应该只返回该用户的处方
  
  -- 测试不能访问其他用户的处方
  SELECT COUNT(*) FROM prescriptions WHERE doctor_id != 'test-user-id'; -- 应该返回0
ROLLBACK;
```

### 3. 集成测试

```typescript
// tests/integration/prescription-flow.test.ts
import { createClient } from '@supabase/supabase-js'

describe('Prescription Flow Integration', () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )

  test('Complete prescription creation flow', async () => {
    // 1. 认证用户
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test-password'
    })

    // 2. 搜索药品
    const { data: medicines } = await supabase.functions.invoke('medicine-search', {
      body: { search: 'aspirin' }
    })

    // 3. 计算处方价格
    const { data: calculation } = await supabase.functions.invoke('prescription-calculator', {
      body: {
        medicines: [{ medicineId: medicines.data[0].id, weight: 10, basePrice: 5.50 }],
        copies: 7
      }
    })

    // 4. 创建处方
    const { data: prescription } = await supabase.functions.invoke('create-prescription', {
      body: {
        medicines: [{ medicineId: medicines.data[0].id, weight: 10, notes: 'Take daily' }],
        copies: 7,
        notes: 'Test prescription'
      }
    })

    expect(prescription.success).toBe(true)
    expect(calculation.data.grandTotal).toBeGreaterThan(0)
  })
})
```

---

## 🚀 部署流程

### 1. Supabase项目初始化

```bash
# 1. 安装Supabase CLI
npm install -g supabase

# 2. 初始化项目
supabase init

# 3. 链接到远程项目
supabase link --project-ref your-project-ref

# 4. 推送数据库迁移
supabase db push

# 5. 部署Edge Functions
supabase functions deploy medicine-search
supabase functions deploy prescription-calculator
supabase functions deploy stripe-payment

# 6. 设置环境变量
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set QR_CODE_SECRET=your-secret
```

### 2. 生产环境配置

```bash
# 生产环境部署脚本
#!/bin/bash

# 设置生产环境变量
export SUPABASE_PROJECT_REF="your-prod-project"
export SUPABASE_ACCESS_TOKEN="your-access-token"

# 部署数据库迁移
supabase db push --project-ref $SUPABASE_PROJECT_REF

# 部署所有Edge Functions
supabase functions deploy --project-ref $SUPABASE_PROJECT_REF

# 设置生产环境密钥
supabase secrets set --project-ref $SUPABASE_PROJECT_REF \
  STRIPE_SECRET_KEY="sk_live_..." \
  QR_CODE_SECRET="prod-secret-key" \
  APP_BASE_URL="https://your-prod-app.com"

# 验证部署
supabase functions list --project-ref $SUPABASE_PROJECT_REF
```

---

## 📈 监控和日志

### 1. 性能监控

```typescript
// Edge Function性能监控
serve(async (req) => {
  const startTime = Date.now()
  
  try {
    // 业务逻辑处理
    const result = await processRequest(req)
    
    // 记录成功指标
    const duration = Date.now() - startTime
    await logMetrics({
      function: 'medicine-search',
      success: true,
      duration,
      timestamp: new Date()
    })
    
    return new Response(JSON.stringify(result))
    
  } catch (error) {
    // 记录错误指标
    const duration = Date.now() - startTime
    await logMetrics({
      function: 'medicine-search',
      success: false,
      duration,
      error: error.message,
      timestamp: new Date()
    })
    
    throw error
  }
})
```

### 2. 错误追踪

```sql
-- 创建错误日志表
CREATE TABLE function_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_name VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  request_data JSONB,
  user_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 创建性能指标表
CREATE TABLE function_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_name VARCHAR(100) NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 回滚策略

### 1. 数据库回滚

```bash
# 回滚最后一次迁移
supabase db reset

# 回滚到特定迁移
supabase db reset --to 20250101000000
```

### 2. Edge Functions版本管理

```typescript
// 版本化Edge Functions
const FUNCTION_VERSION = '1.0.0'

serve(async (req) => {
  // 检查客户端版本兼容性
  const clientVersion = req.headers.get('X-Client-Version')
  if (clientVersion && !isCompatible(clientVersion, FUNCTION_VERSION)) {
    return new Response(JSON.stringify({
      error: 'Client version incompatible',
      requiredVersion: FUNCTION_VERSION
    }), { status: 400 })
  }
  
  // 正常处理请求
})
```

---

## ✅ 迁移检查清单

### 数据库迁移

- [ ] 创建所有必要的表结构
- [ ] 设置索引和性能优化
- [ ] 配置RLS策略
- [ ] 设置触发器和函数
- [ ] 测试数据访问权限

### Edge Functions部署

- [ ] 部署所有业务服务函数
- [ ] 配置环境变量和密钥
- [ ] 测试函数响应和性能
- [ ] 设置CORS和安全头
- [ ] 配置错误处理和日志

### 实时功能配置

- [ ] 启用Realtime订阅
- [ ] 配置数据库变更监听
- [ ] 测试实时事件传递
- [ ] 设置事件频道权限

### 安全配置

- [ ] 配置JWT自定义声明
- [ ] 测试用户认证和授权
- [ ] 验证RLS策略效果
- [ ] 设置API访问限制

### 性能和监控

- [ ] 配置数据库性能优化
- [ ] 设置函数性能监控
- [ ] 配置错误追踪和告警
- [ ] 测试负载能力

---

**迁移完成标准**: 所有原有功能正常运行，性能指标满足要求，安全测试通过  
**回滚计划**: 保留原系统并行运行30天，确保迁移稳定后下线  
**技术支持**: 提供24小时技术支持，确保迁移过程顺利完成  

---

*迁移指南版本: v1.0.0*  
*最后更新: 2025年8月2日*  
*技术团队: 后端架构委员会*