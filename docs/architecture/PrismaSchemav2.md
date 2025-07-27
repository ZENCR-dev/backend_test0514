# Prisma Schema v2.0 - 新西兰 TCM 处方平台

**文档版本：** 2.0  
**基于：** SOP v1.3 Final MVP 1.0  
**创建日期：** 2024年1月16日  
**技术栈：** NestJS + Prisma + TypeScript + Supabase PostgreSQL  

---

## 目录

1. [概述](#1-概述)
2. [完整 Schema 定义](#2-完整-schema-定义)
3. [核心模型详解](#3-核心模型详解)
4. [业务逻辑实现](#4-业务逻辑实现)
5. [索引和性能优化](#5-索引和性能优化)
6. [安全和约束](#6-安全和约束)
7. [迁移指导](#7-迁移指导)
8. [测试验证](#8-测试验证)

---

## 1. 概述

### 1.1 设计原则

本 Schema 设计完全基于 SOP v1.3 文档要求，核心支持：

- **诊所预付/信用额度**业务模式
- **统一订单状态机**管理
- **原子性支付**和事务处理
- **履约凭证**审核流程
- **完整审计**追踪

### 1.2 关键特性

- ✅ 并发安全的账户操作（乐观锁）
- ✅ 幂等性支持（防重复操作）
- ✅ 完整的资金流水审计
- ✅ 严格的状态机控制
- ✅ 地理位置支持
- ✅ 文件管理集成

---

## 2. 完整 Schema 定义

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ==================== 枚举定义 ====================

enum UserRole {
  practitioner
  patient
  pharmacy_operator
  admin
}

enum UserStatus {
  pending
  approved
  suspended
}

enum OrderStatus {
  DRAFT
  PAYMENT_FAILED
  PAID
  PENDING_REVIEW
  REJECTED
  FULFILLED
  CANCELLED
  EXPIRED
}

enum PaymentStatus {
  pending
  processing
  completed
  failed
  refunded
}

enum FulfillmentReviewStatus {
  pending
  approved
  rejected
}

enum TransactionType {
  DEBIT
  CREDIT
  REFUND
  ADJUSTMENT
}

enum ReferenceType {
  ORDER
  RECHARGE
  REFUND
  MANUAL
}

enum AccountStatus {
  active
  suspended
  frozen
}

// ==================== 用户相关模型 ====================

model User {
  id           String     @id @default(cuid()) @map("id")
  email        String     @unique @map("email") @db.VarChar(255)
  role         UserRole   @map("role")
  status       UserStatus @default(pending) @map("status")
  referralCode String?    @unique @map("referral_code") @db.VarChar(10)
  referredBy   String?    @map("referred_by")
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime   @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  profile              UserProfile?
  referredByUser       User?                  @relation("Referrals", fields: [referredBy], references: [id])
  referrals            User[]                 @relation("Referrals")
  ownedClinics         Clinic[]               @relation("ClinicOwner")
  operatedPharmacy     Pharmacy?              @relation("PharmacyOperator")
  practitionerOrders   Order[]                @relation("PractitionerOrders")
  patientOrders        Order[]                @relation("PatientOrders")
  fulfillmentReviews   FulfillmentProof[]     @relation("Reviewer")
  accountTransactions  AccountTransaction[]   @relation("CreatedBy")

  @@map("users")
}

model UserProfile {
  id              String  @id @default(cuid()) @map("id")
  userId          String  @unique @map("user_id")
  fullName        String  @map("full_name") @db.VarChar(255)
  phone           String? @map("phone") @db.VarChar(20)
  licenseNumber   String? @unique @map("license_number") @db.VarChar(50)
  address         Json?   @map("address") @db.JsonB
  preferences     Json?   @map("preferences") @db.JsonB
  metadata        Json?   @map("metadata") @db.JsonB
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

// ==================== 诊所相关模型 ====================

model Clinic {
  id            String   @id @default(cuid()) @map("id")
  name          String   @map("name") @db.VarChar(255)
  address       Json     @map("address") @db.JsonB
  contact       Json?    @map("contact") @db.JsonB
  licenseNumber String?  @map("license_number") @db.VarChar(100)
  ownerId       String   @map("owner_id")
  status        String   @default("active") @map("status") @db.VarChar(20)
  metadata      Json?    @map("metadata") @db.JsonB
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  owner   User           @relation("ClinicOwner", fields: [ownerId], references: [id])
  account ClinicAccount?
  orders  Order[]

  @@map("clinics")
}

model ClinicAccount {
  id              String        @id @default(cuid()) @map("id")
  clinicId        String        @unique @map("clinic_id")
  balance         Decimal       @default(0) @map("balance") @db.Decimal(12, 2)
  creditLimit     Decimal       @default(0) @map("credit_limit") @db.Decimal(12, 2)
  usedCredit      Decimal       @default(0) @map("used_credit") @db.Decimal(12, 2)
  availableCredit Decimal?      @map("available_credit") @db.Decimal(12, 2)
  status          AccountStatus @default(active) @map("status")
  version         Int           @default(1) @map("version")
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  clinic       Clinic               @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  transactions AccountTransaction[]

  @@map("clinic_accounts")
}

model AccountTransaction {
  id            String        @id @default(cuid()) @map("id")
  accountId     String        @map("account_id")
  transactionType TransactionType @map("transaction_type")
  amount        Decimal       @map("amount") @db.Decimal(12, 2)
  balanceBefore Decimal       @map("balance_before") @db.Decimal(12, 2)
  balanceAfter  Decimal       @map("balance_after") @db.Decimal(12, 2)
  creditBefore  Decimal       @map("credit_before") @db.Decimal(12, 2)
  creditAfter   Decimal       @map("credit_after") @db.Decimal(12, 2)
  referenceType ReferenceType? @map("reference_type")
  referenceId   String?       @map("reference_id")
  description   String?       @map("description") @db.Text
  createdBy     String?       @map("created_by")
  createdAt     DateTime      @default(now()) @map("created_at") @db.Timestamptz

  // 关系
  account ClinicAccount @relation(fields: [accountId], references: [id])
  creator User?         @relation("CreatedBy", fields: [createdBy], references: [id])

  @@map("account_transactions")
}

// ==================== 药品相关模型 ====================

model Medicine {
  id                   String    @id @default(cuid()) @map("id")
  name                 String    @map("name") @db.VarChar(255)
  chineseName          String?   @map("chinese_name") @db.VarChar(255)
  englishName          String?   @map("english_name") @db.VarChar(255)
  pinyinName           String?   @map("pinyin_name") @db.VarChar(255)
  sku                  String    @unique @map("sku") @db.VarChar(100)
  description          String?   @map("description") @db.Text
  category             String?   @map("category") @db.VarChar(100)
  unit                 String    @map("unit") @db.VarChar(50)
  requiresPrescription Boolean   @default(true) @map("requires_prescription")
  basePrice            Decimal   @map("base_price") @db.Decimal(10, 2)
  metadata             Json?     @map("metadata") @db.JsonB
  status               String    @default("active") @map("status") @db.VarChar(20)
  createdAt            DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  orderItems        OrderItem[]
  pharmacyInventory PharmacyInventory[]

  @@map("medicines")
}

// ==================== 药房相关模型 ====================

model Pharmacy {
  id           String   @id @default(cuid()) @map("id")
  name         String   @map("name") @db.VarChar(255)
  address      Json     @map("address") @db.JsonB
  coordinates  String?  @map("coordinates")
  contact      Json     @map("contact") @db.JsonB
  licenseInfo  Json?    @map("license_info") @db.JsonB
  operatorId   String   @map("operator_id")
  serviceHours Json?    @map("service_hours") @db.JsonB
  status       String   @default("active") @map("status") @db.VarChar(20)
  metadata     Json?    @map("metadata") @db.JsonB
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  operator          User                @relation("PharmacyOperator", fields: [operatorId], references: [id])
  inventory         PharmacyInventory[]
  assignedOrders    Order[]             @relation("AssignedPharmacy")
  fulfillmentProofs FulfillmentProof[]
  settlements       Settlement[]

  @@map("pharmacies")
}

model PharmacyInventory {
  id             String   @id @default(cuid()) @map("id")
  pharmacyId     String   @map("pharmacy_id")
  medicineId     String   @map("medicine_id")
  quantity       Int      @default(0) @map("quantity")
  wholesalePrice Decimal? @map("wholesale_price") @db.Decimal(10, 2)
  retailPrice    Decimal? @map("retail_price") @db.Decimal(10, 2)
  lastRestocked  DateTime? @map("last_restocked") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  pharmacy Pharmacy @relation(fields: [pharmacyId], references: [id], onDelete: Cascade)
  medicine Medicine @relation(fields: [medicineId], references: [id], onDelete: Cascade)

  @@unique([pharmacyId, medicineId])
  @@map("pharmacy_inventory")
}

// ==================== 订单相关模型 ====================

model Order {
  id                 String      @id @default(cuid()) @map("id")
  platformOrderId    String      @unique @map("platform_order_id") @db.VarChar(50)
  practitionerId     String      @map("practitioner_id")
  patientId          String?     @map("patient_id")
  clinicId           String      @map("clinic_id")
  patientInfo        Json        @map("patient_info") @db.JsonB
  status             OrderStatus @default(DRAFT) @map("status")
  totalAmount        Decimal     @map("total_amount") @db.Decimal(10, 2)
  paymentStatus      String?     @default("pending") @map("payment_status") @db.VarChar(20)
  paymentMethod      String?     @map("payment_method") @db.VarChar(50)
  assignedPharmacyId String?     @map("assigned_pharmacy_id")
  dispensedAt        DateTime?   @map("dispensed_at") @db.Timestamptz
  completedAt        DateTime?   @map("completed_at") @db.Timestamptz
  qrCodeData         String?     @map("qr_code_data") @db.Text
  pdfUrl             String?     @map("pdf_url") @db.Text
  notes              String?     @map("notes") @db.Text
  version            Int         @default(1) @map("version")
  idempotencyKey     String?     @unique @map("idempotency_key") @db.VarChar(255)
  expiresAt          DateTime?   @map("expires_at") @db.Timestamptz
  createdAt          DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime    @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  practitioner      User                 @relation("PractitionerOrders", fields: [practitionerId], references: [id])
  patient           User?                @relation("PatientOrders", fields: [patientId], references: [id])
  clinic            Clinic               @relation(fields: [clinicId], references: [id])
  assignedPharmacy  Pharmacy?            @relation("AssignedPharmacy", fields: [assignedPharmacyId], references: [id])
  items             OrderItem[]
  payments          Payment[]
  fulfillmentProofs FulfillmentProof[]
  settlements       Settlement[]

  @@map("orders")
}

model OrderItem {
  id                 String   @id @default(cuid()) @map("id")
  orderId            String   @map("order_id")
  medicineId         String   @map("medicine_id")
  medicineSnapshot   Json     @map("medicine_snapshot") @db.JsonB
  quantity           Int      @map("quantity")
  unitPrice          Decimal  @map("unit_price") @db.Decimal(10, 2)
  totalPrice         Decimal  @map("total_price") @db.Decimal(10, 2)
  dosageInstructions String?  @map("dosage_instructions") @db.Text
  notes              String?  @map("notes") @db.Text
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz

  // 关系
  order    Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  medicine Medicine @relation(fields: [medicineId], references: [id])

  @@map("order_items")
}

// ==================== 支付相关模型 ====================

model Payment {
  id                    String        @id @default(cuid()) @map("id")
  orderId               String        @map("order_id")
  amount                Decimal       @map("amount") @db.Decimal(10, 2)
  currency              String        @default("NZD") @map("currency") @db.VarChar(3)
  paymentMethod         String        @map("payment_method") @db.VarChar(50)
  provider              String?       @map("provider") @db.VarChar(50)
  providerTransactionId String?       @map("provider_transaction_id") @db.VarChar(255)
  providerResponse      Json?         @map("provider_response") @db.JsonB
  status                PaymentStatus @default(pending) @map("status")
  processedAt           DateTime?     @map("processed_at") @db.Timestamptz
  metadata              Json?         @map("metadata") @db.JsonB
  createdAt             DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("payments")
}

// ==================== 履约相关模型 ====================

model FulfillmentProof {
  id           String                    @id @default(cuid()) @map("id")
  orderId      String                    @map("order_id")
  pharmacyId   String                    @map("pharmacy_id")
  proofFiles   Json                      @map("proof_files") @db.JsonB
  notes        String?                   @map("notes") @db.Text
  reviewStatus FulfillmentReviewStatus   @default(pending) @map("review_status")
  reviewerId   String?                   @map("reviewer_id")
  reviewNotes  String?                   @map("review_notes") @db.Text
  reviewedAt   DateTime?                 @map("reviewed_at") @db.Timestamptz
  metadata     Json?                     @map("metadata") @db.JsonB
  createdAt    DateTime                  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime                  @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  order    Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  pharmacy Pharmacy  @relation(fields: [pharmacyId], references: [id])
  reviewer User?     @relation("Reviewer", fields: [reviewerId], references: [id])

  @@map("fulfillment_proofs")
}

// ==================== 结算相关模型 ====================

model Settlement {
  id          String   @id @default(cuid()) @map("id")
  orderId     String   @map("order_id")
  pharmacyId  String   @map("pharmacy_id")
  amount      Decimal  @map("amount") @db.Decimal(10, 2)
  currency    String   @default("NZD") @map("currency") @db.VarChar(3)
  status      String   @default("pending") @map("status") @db.VarChar(20)
  paidAt      DateTime? @map("paid_at") @db.Timestamptz
  paymentRef  String?  @map("payment_ref") @db.VarChar(255)
  metadata    Json?    @map("metadata") @db.JsonB
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  order    Order    @relation(fields: [orderId], references: [id])
  pharmacy Pharmacy @relation(fields: [pharmacyId], references: [id])

  @@map("settlements")
}

// ==================== 系统配置 ====================

model SystemConfig {
  key         String   @id @map("key") @db.VarChar(255)
  value       Json     @map("value") @db.JsonB
  description String?  @map("description") @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  metadata    Json?    @map("metadata") @db.JsonB
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("system_configs")
}
```

---

## 3. 核心模型详解

### 3.1 用户系统

#### User 模型
- **统一用户模型**：支持所有角色（医生、药房操作员、管理员、患者）
- **推荐码系统**：支持医生推荐机制，自动生成唯一推荐码
- **状态管理**：支持用户审核流程

#### UserProfile 模型
- **扩展信息**：个人详细信息，支持不同角色的特定字段
- **元数据支持**：灵活的 JSON 字段存储额外信息

### 3.2 诊所账户系统

#### ClinicAccount 模型
- **资金管理**：支持预付款和信用额度双重模式
- **并发安全**：使用乐观锁版本控制防止并发冲突
- **约束保护**：数据库级别约束防止负余额

#### AccountTransaction 模型
- **完整审计**：记录所有资金变动的前后状态
- **业务关联**：支持关联到订单或其他业务操作
- **追踪完整**：支持资金流向的完整追踪

### 3.3 订单系统

#### Order 模型
- **状态机控制**：严格按照 SOP 11.8 定义的状态转换
- **幂等性支持**：防止重复创建订单
- **患者信息快照**：保存订单创建时的患者信息
- **凭证管理**：支持 QR 码和 PDF 凭证

### 3.4 履约系统

#### FulfillmentProof 模型
- **文件管理**：支持多个履约证明文件
- **审核流程**：支持管理员审核和状态管理
- **灵活元数据**：支持扩展的履约信息

---

## 4. 业务逻辑实现

### 4.1 诊所支付流程

```typescript
// 核心支付逻辑伪代码
async function processClinicPayment(
  clinicId: string,
  orderAmount: Decimal,
  idempotencyKey: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. 检查幂等性
    const existingOrder = await tx.order.findUnique({
      where: { idempotencyKey }
    });
    if (existingOrder) {
      return existingOrder; // 返回已存在的订单
    }

    // 2. 乐观锁更新账户
    const account = await tx.clinicAccount.findUnique({
      where: { clinicId }
    });
    
    const totalAvailable = account.balance + 
      (account.creditLimit - account.usedCredit);
    
    if (totalAvailable < orderAmount) {
      throw new InsufficientFundsError();
    }

    // 3. 原子性扣款
    const updatedAccount = await tx.clinicAccount.update({
      where: { 
        clinicId,
        version: account.version // 乐观锁
      },
      data: {
        balance: account.balance >= orderAmount 
          ? account.balance - orderAmount
          : 0,
        usedCredit: account.balance >= orderAmount
          ? account.usedCredit
          : account.usedCredit + (orderAmount - account.balance),
        version: { increment: 1 }
      }
    });

    // 4. 创建订单
    const order = await tx.order.create({
      data: {
        clinicId,
        totalAmount: orderAmount,
        status: 'PAID',
        idempotencyKey,
        // ... 其他字段
      }
    });

    // 5. 记录交易
    await tx.accountTransaction.create({
      data: {
        accountId: account.id,
        transactionType: 'DEBIT',
        amount: orderAmount,
        balanceBefore: account.balance,
        balanceAfter: updatedAccount.balance,
        creditBefore: account.usedCredit,
        creditAfter: updatedAccount.usedCredit,
        referenceType: 'ORDER',
        referenceId: order.id
      }
    });

    return order;
  });
}
```

### 4.2 订单状态转换

```typescript
// 订单状态转换验证
const VALID_TRANSITIONS = {
  DRAFT: ['PAYMENT_FAILED', 'PAID', 'CANCELLED'],
  PAYMENT_FAILED: ['PAID', 'CANCELLED'],
  PAID: ['PENDING_REVIEW', 'CANCELLED', 'EXPIRED'],
  PENDING_REVIEW: ['REJECTED', 'FULFILLED'],
  REJECTED: ['PENDING_REVIEW', 'CANCELLED'],
  FULFILLED: [],
  CANCELLED: [],
  EXPIRED: []
};

function validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus].includes(newStatus);
}
```

---

## 5. 索引和性能优化

### 5.1 核心索引

```sql
-- 用户相关索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- 订单相关索引
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_practitioner_id ON orders(practitioner_id);
CREATE INDEX idx_orders_clinic_id ON orders(clinic_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_platform_order_id ON orders(platform_order_id);

-- 账户相关索引
CREATE INDEX idx_clinic_accounts_clinic_id ON clinic_accounts(clinic_id);
CREATE INDEX idx_clinic_accounts_status ON clinic_accounts(status);
CREATE INDEX idx_account_transactions_account_id ON account_transactions(account_id);
CREATE INDEX idx_account_transactions_created_at ON account_transactions(created_at DESC);
CREATE INDEX idx_account_transactions_reference ON account_transactions(reference_type, reference_id);

-- 药品相关索引
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_status ON medicines(status);
CREATE INDEX idx_medicines_sku ON medicines(sku);

-- 药房相关索引
CREATE INDEX idx_pharmacies_operator_id ON pharmacies(operator_id);
CREATE INDEX idx_pharmacies_status ON pharmacies(status);
CREATE INDEX idx_pharmacy_inventory_pharmacy_medicine ON pharmacy_inventory(pharmacy_id, medicine_id);

-- 履约相关索引
CREATE INDEX idx_fulfillment_proofs_order_id ON fulfillment_proofs(order_id);
CREATE INDEX idx_fulfillment_proofs_pharmacy_id ON fulfillment_proofs(pharmacy_id);
CREATE INDEX idx_fulfillment_proofs_review_status ON fulfillment_proofs(review_status);
```

### 5.2 复合索引

```sql
-- 订单查询优化
CREATE INDEX idx_orders_practitioner_status ON orders(practitioner_id, status);
CREATE INDEX idx_orders_clinic_status ON orders(clinic_id, status);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at DESC);

-- 账户交易查询优化
CREATE INDEX idx_account_transactions_account_type ON account_transactions(account_id, transaction_type);
CREATE INDEX idx_account_transactions_reference_created ON account_transactions(reference_type, reference_id, created_at DESC);
```

---

## 6. 安全和约束

### 6.1 数据库约束

```sql
-- 账户约束
ALTER TABLE clinic_accounts 
ADD CONSTRAINT chk_balance_non_negative 
CHECK (balance >= 0);

ALTER TABLE clinic_accounts 
ADD CONSTRAINT chk_credit_limit_non_negative 
CHECK (credit_limit >= 0);

ALTER TABLE clinic_accounts 
ADD CONSTRAINT chk_used_credit_within_limit 
CHECK (used_credit >= 0 AND used_credit <= credit_limit);

-- 订单约束
ALTER TABLE orders 
ADD CONSTRAINT chk_total_amount_positive 
CHECK (total_amount > 0);

-- 交易约束
ALTER TABLE account_transactions 
ADD CONSTRAINT chk_amount_positive 
CHECK (amount > 0);
```

### 6.2 Row Level Security (RLS)

```sql
-- 用户只能访问自己的数据
CREATE POLICY user_profile_policy ON user_profiles
FOR ALL USING (user_id = auth.uid());

-- 诊所成员只能访问自己诊所的数据
CREATE POLICY clinic_orders_policy ON orders
FOR ALL USING (
  clinic_id IN (
    SELECT c.id FROM clinics c 
    WHERE c.owner_id = auth.uid()
  )
);

-- 药房操作员只能访问自己药房的数据
CREATE POLICY pharmacy_orders_policy ON orders
FOR ALL USING (
  assigned_pharmacy_id IN (
    SELECT p.id FROM pharmacies p 
    WHERE p.operator_id = auth.uid()
  )
);
```

---

## 7. 迁移指导

### 7.1 从现有 Schema 迁移

```bash
# 1. 备份当前数据库
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 重置 Prisma 迁移历史
rm -rf prisma/migrations
npx prisma migrate reset --force

# 3. 应用新的 Schema
npx prisma db push

# 4. 生成新的 Prisma Client
npx prisma generate

# 5. 创建初始迁移
npx prisma migrate dev --name "initial-schema-v2"
```

### 7.2 数据迁移脚本

```typescript
// 数据迁移示例
async function migrateFromV1ToV2() {
  // 1. 迁移用户数据
  const oldUsers = await prisma.user.findMany();
  for (const user of oldUsers) {
    await prisma.user.create({
      data: {
        email: user.email,
        role: mapOldRoleToNew(user.role),
        profile: {
          create: {
            fullName: `${user.firstName} ${user.lastName}`,
            // ... 其他字段映射
          }
        }
      }
    });
  }

  // 2. 迁移诊所账户数据
  const oldClinics = await prisma.clinic.findMany();
  for (const clinic of oldClinics) {
    await prisma.clinic.create({
      data: {
        name: clinic.name,
        // ... 其他字段
        account: {
          create: {
            balance: clinic.balance || 0,
            creditLimit: clinic.creditLimit || 0,
            usedCredit: 0
          }
        }
      }
    });
  }

  // 3. 迁移订单状态
  await prisma.order.updateMany({
    where: { status: 'pending_payment' },
    data: { status: 'DRAFT' }
  });
}
```

---

## 8. 测试验证

### 8.1 Schema 验证

```bash
# 验证 Schema 语法
npx prisma validate

# 格式化 Schema
npx prisma format

# 生成客户端
npx prisma generate

# 检查数据库连接
npx prisma db pull
```

### 8.2 业务逻辑测试

```typescript
// 测试账户扣款逻辑
describe('Clinic Payment System', () => {
  test('should deduct from balance first', async () => {
    const account = await createTestAccount({
      balance: 100,
      creditLimit: 200,
      usedCredit: 50
    });

    const result = await processPayment(account.clinicId, 80);
    
    expect(result.account.balance).toBe(20);
    expect(result.account.usedCredit).toBe(50);
    expect(result.order.status).toBe('PAID');
  });

  test('should use credit when balance insufficient', async () => {
    const account = await createTestAccount({
      balance: 30,
      creditLimit: 200,
      usedCredit: 50
    });

    const result = await processPayment(account.clinicId, 80);
    
    expect(result.account.balance).toBe(0);
    expect(result.account.usedCredit).toBe(100);
    expect(result.order.status).toBe('PAID');
  });

  test('should reject when insufficient funds', async () => {
    const account = await createTestAccount({
      balance: 30,
      creditLimit: 100,
      usedCredit: 90
    });

    await expect(
      processPayment(account.clinicId, 50)
    ).rejects.toThrow('Insufficient funds');
  });
});
```

### 8.3 并发测试

```typescript
// 测试并发安全性
describe('Concurrent Payment Tests', () => {
  test('should handle concurrent payments correctly', async () => {
    const account = await createTestAccount({
      balance: 100,
      creditLimit: 0,
      usedCredit: 0
    });

    // 同时发起多个支付请求
    const promises = Array.from({ length: 5 }, () =>
      processPayment(account.clinicId, 30)
    );

    const results = await Promise.allSettled(promises);
    
    // 只应该有 3 个成功（100/30 = 3.33）
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    expect(successful.length).toBe(3);
    expect(failed.length).toBe(2);
  });
});
```

---

## 结论

本 Prisma Schema v2.0 设计完全基于 SOP v1.3 要求，提供了：

- ✅ 完整的诊所预付/信用额度业务支持
- ✅ 严格的订单状态机控制
- ✅ 并发安全的支付处理
- ✅ 完整的审计追踪
- ✅ 灵活的扩展能力

通过这个设计，TCM 处方平台能够安全、高效地处理核心业务流程，为后续的 NestJS 服务开发提供坚实的数据层基础。 