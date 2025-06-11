### 1. Prisma 环境初始化与安装

**目标：** 在项目中安装Prisma CLI，并初始化Prisma配置。

**操作场景：** 终端命令（外部操作）

1.  **进入项目根目录：**
    ```bash
    cd /path/to/your/nestjs-project
    ```

2.  **安装 Prisma CLI 作为开发依赖：**
    ```bash
    npm install prisma --save-dev
    # 或者 yarn add prisma --dev
    ```

3.  **初始化 Prisma 项目：**
    这将创建一个 `prisma` 文件夹和 `schema.prisma` 文件，并自动配置 `datasource` 和 `generator`。
    ```bash
    npx prisma init
    ```
    **注意：** 这一步会提示你配置数据库连接字符串，请务必填写你的Supabase PostgreSQL连接字符串（通常从Supabase项目设置中获取）。

    例如，`schema.prisma` 文件中的 `datasource` 配置应类似：
    ```prisma
    // prisma/schema.prisma
    datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }
    ```
    并且，在项目根目录的 `.env` 文件中添加实际的数据库连接字符串：
    ```
    DATABASE_URL="postgresql://[USERNAME]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?pgbouncer=true&connection_limit=1"
    ```
    请替换 `[USERNAME]`、`[PASSWORD]`、`[HOST]`、`[PORT]`、`[DATABASE]` 为你的Supabase数据库凭证。`pgbouncer=true` 是Supabase推荐的连接池设置。

### 2. 定义 `schema.prisma` 文件

**目标：** 将我们设计的数据库表结构（包括字段、类型、约束、关系）映射到 `schema.prisma` 文件中的 `model` 定义。

**操作场景：** 项目内编辑文档（内部操作）

1.  **打开 `prisma/schema.prisma` 文件。**

2.  **为每个数据库表定义一个 `model`：**

    根据我们之前提供的"数据库表结构设计"文档，逐一创建对应的Prisma `model`。

    **示例（以 `users` 表为例）：**

    ```prisma
    // prisma/schema.prisma

    // 定义枚举类型，对应PostgreSQL的ENUM
    enum UserRole {
      doctor
      pharmacy_operator
      admin
      patient // 未来可能支持
    }

    model User {
      id            String     @id @default(uuid()) @map("id") @db.Uuid // PK, NOT NULL, gen_random_uuid()
      email         String     @unique @map("email") @db.VarChar(255) // UNIQUE, NOT NULL
      phone         String?    @map("phone") @db.VarChar(20) // NULLABLE
      role          UserRole   @default(doctor) @map("role") // NOT NULL, 默认值
      createdAt     DateTime   @default(now()) @map("created_at") @db.Timestamptz(6) // NOT NULL, now()
      updatedAt     DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6) // NOT NULL, now()
      isActive      Boolean    @default(true) @map("is_active") // NOT NULL, true
      referralCode  String?    @unique @map("referral_code") @db.VarChar(10) // UNIQUE, NULLABLE
      referredBy    String?    @map("referred_by") @db.Uuid // FK, NULLABLE
      
      // 关系字段 (如果需要)
      profile       UserProfile?
      referredByUser User? @relation("Referrals", fields: [referredBy], references: [id])
      referrals     User[] @relation("Referrals")

      // @map("users") 注解用于指定数据库表名，如果模型名与表名不一致
      @@map("users")
    }

    model UserProfile {
      id          String @id @default(uuid()) @map("id") @db.Uuid
      userId      String @unique @map("user_id") @db.Uuid
      firstName   String @map("first_name") @db.VarChar(100)
      lastName    String @map("last_name") @db.VarChar(100)
      licenseNumber String? @unique @map("license_number") @db.VarChar(50)
      clinicName  String? @map("clinic_name") @db.VarChar(200)
      address     String? @map("address") @db.Text
      latitude    Decimal? @map("latitude") @db.Decimal(10,8)
      longitude   Decimal? @map("longitude") @db.Decimal(11,8)
      preferences Json? @map("preferences") @db.JsonB
      
      // 关系字段
      user        User @relation(fields: [userId], references: [id])

      @@map("user_profiles")
    }

    // ... 其他模型定义，例如 ClinicAccount, Medicine, Prescription, Order 等
    // 确保所有枚举、模型和关系都根据我们的设计表进行定义。
    ```

    **关键要点：**
    *   **`model` 定义：** 每个 `model` 对应一个数据库表。
    *   **字段类型：** 使用Prisma支持的类型（`String`, `Int`, `Boolean`, `DateTime`, `Decimal`, `Json` 等），并通过 `@db` 注解映射到具体的PostgreSQL类型（如 `@db.VarChar(255)`, `@db.Timestamptz(6)`, `@db.JsonB`, `@db.Uuid`）。
    *   **主键：** 使用 `@id`。
    *   **默认值：** 使用 `@default(value)`，例如 `@default(uuid())` 或 `@default(now())`。
    *   **唯一约束：** 使用 `@unique`。
    *   **非空约束：** 默认非空，如果字段可为空，则使用 `?`。
    *   **字段映射：** 如果模型中的字段名与数据库列名不一致，使用 `@map("column_name")`。
    *   **表名映射：** 如果模型名与数据库表名不一致，使用 `@@map("table_name")`。
    *   **关系定义：** 使用 `@relation` 定义表之间的关系（一对一、一对多、多对多）。
    *   **索引：** Prisma会自动为 `@id` 和 `@unique` 字段创建索引。对于其他需要索引的字段（如 `users.email`, `medicines.name`），可以在 `@@index([fieldName])` 中指定。

### 3. 生成 Prisma Client

**目标：** 根据 `schema.prisma` 文件生成Prisma客户端，供后端NestJS应用与数据库交互。

**操作场景：** 终端命令（外部操作）

1.  **在项目根目录运行：**
    ```bash
    npx prisma generate
    ```
    此命令会读取 `schema.prisma` 文件，并生成 `node_modules/@prisma/client` 目录下的TypeScript类型文件。

### 4. 创建和应用数据库迁移

**目标：** 将 `schema.prisma` 中的模型定义同步到实际的Supabase PostgreSQL数据库中。

**操作场景：** 终端命令（外部操作）

1.  **创建新的迁移文件：**
    当 `schema.prisma` 文件发生变化时（例如，添加新模型、新字段、修改关系等），都需要创建新的迁移。
    ```bash
    npx prisma migrate dev --name init_schema # 首次创建
    # 或者
    npx prisma migrate dev --name add_new_feature # 后续修改
    ```
    *   `--name` 参数为迁移文件指定一个有意义的名称。
    *   `prisma migrate dev` 会检查 `schema.prisma` 与数据库的差异，并生成SQL迁移脚本，然后自动应用到开发数据库。
    *   **注意：** 如果是新的数据库，此步骤将创建所有表。如果是现有数据库，它将生成并应用更改。

2.  **检查生成的迁移文件：**

    **操作场景：** 项目内编辑文档（内部操作）

    打开 `prisma/migrations/<timestamp>_your_migration_name/migration.sql` 文件，检查Prisma生成的SQL脚本是否符合预期。这是手动验证数据库变更的重要步骤。

3.  **应用迁移到生产环境（部署时）：**
    在部署到Staging或Production环境时，需要应用这些迁移。这通常在CI/CD流水线中执行。

    **操作场景：** 终端命令（外部操作）

    ```bash
    npx prisma migrate deploy
    ```
    *   `prisma migrate deploy` 不会检查差异，它只会根据 `_prisma_migrations` 表中的记录，应用所有尚未执行的迁移。
    *   **重要：** 在部署之前，请确保你的 `DATABASE_URL` 环境变量指向正确的环境数据库（Staging/Production）。

### 5. 后端应用中使用 Prisma Client

**目标：** 在NestJS服务中集成Prisma Client，进行数据库操作。

**操作场景：** 项目内编辑文档（内部操作）

1.  **创建 `PrismaService` (NestJS Provider)：**
    为了更好地管理Prisma Client，通常会创建一个可注入的 `PrismaService`。

    ```typescript
    // src/prisma/prisma.service.ts
    import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
    import { PrismaClient } from '@prisma/client';

    @Injectable()
    export class PrismaService extends PrismaClient implements OnModuleInit {
      async onModuleInit() {
        await this.$connect();
      }

      async enableShutdownHooks(app: INestApplication) {
        process.on('beforeExit', async () => {
          await app.close();
        });
      }
    }
    ```

2.  **在 `AppModule` 或其他模块中导入 `PrismaService`：**

    ```typescript
    // src/app.module.ts
    import { Module } from '@nestjs/common';
    import { PrismaService } from './prisma/prisma.service'; // 假设你的PrismaService在这里

    @Module({
      imports: [],
      controllers: [],
      providers: [PrismaService], // 将PrismaService添加到providers
      exports: [PrismaService], // 如果其他模块需要使用，可以导出
    })
    export class AppModule {}
    ```

3.  **在其他服务中注入并使用 `PrismaService`：**

    ```typescript
    // src/users/users.service.ts
    import { Injectable } from '@nestjs/common';
    import { PrismaService } from '../prisma/prisma.service';
    import { User } from '@prisma/client'; // 导入Prisma生成的类型

    @Injectable()
    export class UsersService {
      constructor(private prisma: PrismaService) {}

      async createUser(data: { email: string; phone?: string; role: string }): Promise<User> {
        return this.prisma.user.create({
          data: {
            email: data.email,
            phone: data.phone,
            role: data.role as any, // 需要根据实际情况处理枚举类型
          },
        });
      }

      async findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
          where: { email },
        });
      }

      // ... 其他CRUD操作
    }
    ```

### 总结

请开发人员严格按照以上步骤执行Prisma Schema的定义、生成和迁移。务必在每次修改 `schema.prisma` 后运行 `npx prisma migrate dev --name <your_migration_name>` 来生成迁移文件，并在部署时使用 `npx prisma migrate deploy`。这将确保数据库Schema与代码库始终保持同步，并为后续开发提供稳定的基础。

### 6. 完整的 Schema.prisma 模板（基于 SOP v1.25）

**目标：** 根据 SOP v1.25 文档中的数据库设计，提供完整的 Prisma Schema 模板，确保所有核心业务表都有对应的模型定义。

**操作场景：** 项目内编辑文档（内部操作）

以下是完整的 `prisma/schema.prisma` 文件内容：

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Supabase需要
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
  id        String     @id @default(cuid()) @map("id")
  role      UserRole   @map("role")
  fullName  String     @map("full_name") @db.VarChar(255)
  phone     String?    @map("phone") @db.VarChar(20)
  status    UserStatus @default(pending) @map("status")
  createdAt DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime   @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  profile UserProfile?
  practitionerOrders Order[] @relation("PractitionerOrders")
  patientOrders      Order[] @relation("PatientOrders")
  clinics           Clinic[] @relation("ClinicOwner")
  pharmacy          Pharmacy? @relation("PharmacyOperator")
  fulfillmentProofs FulfillmentProof[] @relation("Reviewer")
  accountTransactions AccountTransaction[] @relation("CreatedBy")

  @@map("user_profiles")
}

model UserProfile {
  id    String @id @default(cuid()) @map("id")
  userId String @unique @map("user_id")
  // 其他profile字段根据需要扩展

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profile_details")
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
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  // 关系
  owner   User           @relation("ClinicOwner", fields: [ownerId], references: [id])
  account ClinicAccount?
  orders  Order[]

  @@map("clinics")
}

model ClinicAccount {
  id              String      @id @default(cuid()) @map("id")
  clinicId        String      @unique @map("clinic_id")
  balance         Decimal     @default(0) @map("balance") @db.Decimal(12,2)
  creditLimit     Decimal     @default(0) @map("credit_limit") @db.Decimal(12,2)
  usedCredit      Decimal     @default(0) @map("used_credit") @db.Decimal(12,2)
  availableCredit Decimal?    @map("available_credit") @db.Decimal(12,2) // 计算字段，在应用层处理
  status          AccountStatus @default(active) @map("status")
  version         Int         @default(1) @map("version") // 乐观锁
  createdAt       DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime    @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  clinic       Clinic               @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  transactions AccountTransaction[]

  @@map("clinic_accounts")
}

model AccountTransaction {
  id            String          @id @default(cuid()) @map("id")
  accountId     String          @map("account_id")
  transactionType TransactionType @map("transaction_type")
  amount        Decimal         @map("amount") @db.Decimal(12,2)
  balanceBefore Decimal         @map("balance_before") @db.Decimal(12,2)
  balanceAfter  Decimal         @map("balance_after") @db.Decimal(12,2)
  creditBefore  Decimal         @map("credit_before") @db.Decimal(12,2)
  creditAfter   Decimal         @map("credit_after") @db.Decimal(12,2)
  referenceType ReferenceType?  @map("reference_type")
  referenceId   String?         @map("reference_id")
  description   String?         @map("description") @db.Text
  createdBy     String?         @map("created_by")
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz

  // 关系
  account   ClinicAccount @relation(fields: [accountId], references: [id])
  creator   User?         @relation("CreatedBy", fields: [createdBy], references: [id])

  @@map("account_transactions")
}

// ==================== 药品相关模型 ====================

model Medicine {
  id                    String    @id @default(cuid()) @map("id")
  name                  String    @map("name") @db.VarChar(255)
  sku                   String    @unique @map("sku") @db.VarChar(100)
  description           String?   @map("description") @db.Text
  category              String?   @map("category") @db.VarChar(100)
  unit                  String    @map("unit") @db.VarChar(50)
  requiresPrescription  Boolean   @default(true) @map("requires_prescription")
  basePrice             Decimal   @map("base_price") @db.Decimal(10,2)
  metadata              Json?     @map("metadata") @db.JsonB
  status                String    @default("active") @map("status") @db.VarChar(20)
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  orderItems        OrderItem[]
  pharmacyInventory PharmacyInventory[]

  @@map("medicines")
}

// ==================== 药房相关模型 ====================

model Pharmacy {
  id           String    @id @default(cuid()) @map("id")
  name         String    @map("name") @db.VarChar(255)
  address      Json      @map("address") @db.JsonB
  coordinates  String?   @map("coordinates") // PostGIS POINT存储为字符串
  contact      Json      @map("contact") @db.JsonB
  licenseInfo  Json?     @map("license_info") @db.JsonB
  operatorId   String    @map("operator_id")
  serviceHours Json?     @map("service_hours") @db.JsonB
  status       String    @default("active") @map("status") @db.VarChar(20)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz

  // 关系
  operator           User                @relation("PharmacyOperator", fields: [operatorId], references: [id])
  inventory          PharmacyInventory[]
  assignedOrders     Order[]             @relation("AssignedPharmacy")
  fulfillmentProofs  FulfillmentProof[]
  settlements        Settlement[]

  @@map("pharmacies")
}

model PharmacyInventory {
  id            String   @id @default(cuid()) @map("id")
  pharmacyId    String   @map("pharmacy_id")
  medicineId    String   @map("medicine_id")
  quantity      Int      @default(0) @map("quantity")
  wholesalePrice Decimal? @map("wholesale_price") @db.Decimal(10,2)
  retailPrice   Decimal? @map("retail_price") @db.Decimal(10,2)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  pharmacy Pharmacy @relation(fields: [pharmacyId], references: [id], onDelete: Cascade)
  medicine Medicine @relation(fields: [medicineId], references: [id], onDelete: Cascade)

  @@unique([pharmacyId, medicineId])
  @@map("pharmacy_inventory")
}

// ==================== 订单相关模型 ====================

model Order {
  id                String        @id @default(cuid()) @map("id")
  platformOrderId   String        @unique @map("platform_order_id") @db.VarChar(50)
  practitionerId    String        @map("practitioner_id")
  patientId         String?       @map("patient_id")
  clinicId          String        @map("clinic_id")
  patientInfo       Json          @map("patient_info") @db.JsonB
  status            OrderStatus   @default(DRAFT) @map("status")
  totalAmount       Decimal       @map("total_amount") @db.Decimal(10,2)
  paymentStatus     String?       @default("pending") @map("payment_status") @db.VarChar(20)
  paymentMethod     String?       @map("payment_method") @db.VarChar(50)
  assignedPharmacyId String?      @map("assigned_pharmacy_id")
  dispensedAt       DateTime?     @map("dispensed_at") @db.Timestamptz
  completedAt       DateTime?     @map("completed_at") @db.Timestamptz
  qrCodeData        String?       @map("qr_code_data") @db.Text
  pdfUrl            String?       @map("pdf_url") @db.Text
  version           Int           @default(1) @map("version") // 乐观锁
  idempotencyKey    String?       @unique @map("idempotency_key") @db.VarChar(255)
  createdAt         DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  // 关系
  practitioner      User          @relation("PractitionerOrders", fields: [practitionerId], references: [id])
  patient           User?         @relation("PatientOrders", fields: [patientId], references: [id])
  clinic            Clinic        @relation(fields: [clinicId], references: [id])
  assignedPharmacy  Pharmacy?     @relation("AssignedPharmacy", fields: [assignedPharmacyId], references: [id])
  items             OrderItem[]
  payments          Payment[]
  fulfillmentProofs FulfillmentProof[]
  settlements       Settlement[]

  @@map("orders")
}

model OrderItem {
  id                   String   @id @default(cuid()) @map("id")
  orderId              String   @map("order_id")
  medicineId           String   @map("medicine_id")
  medicineSnapshot     Json     @map("medicine_snapshot") @db.JsonB
  quantity             Int      @map("quantity")
  unitPrice            Decimal  @map("unit_price") @db.Decimal(10,2)
  totalPrice           Decimal  @map("total_price") @db.Decimal(10,2)
  dosageInstructions   String?  @map("dosage_instructions") @db.Text
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz

  // 关系
  order    Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  medicine Medicine @relation(fields: [medicineId], references: [id])

  @@map("order_items")
}

// ==================== 支付相关模型 ====================

model Payment {
  id                     String        @id @default(cuid()) @map("id")
  orderId                String        @map("order_id")
  amount                 Decimal       @map("amount") @db.Decimal(10,2)
  currency               String        @default("USD") @map("currency") @db.VarChar(3)
  paymentMethod          String        @map("payment_method") @db.VarChar(50)
  provider               String?       @map("provider") @db.VarChar(50)
  providerTransactionId  String?       @map("provider_transaction_id") @db.VarChar(255)
  providerResponse       Json?         @map("provider_response") @db.JsonB
  status                 PaymentStatus @default(pending) @map("status")
  processedAt            DateTime?     @map("processed_at") @db.Timestamptz
  createdAt              DateTime      @default(now()) @map("created_at") @db.Timestamptz

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
  createdAt    DateTime                  @default(now()) @map("created_at") @db.Timestamptz

  // 关系
  order    Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  pharmacy Pharmacy  @relation(fields: [pharmacyId], references: [id])
  reviewer User?     @relation("Reviewer", fields: [reviewerId], references: [id])

  @@map("fulfillment_proofs")
}

// ==================== 结算相关模型 ====================

model Settlement {
  id         String   @id @default(cuid()) @map("id")
  orderId    String   @map("order_id")
  pharmacyId String   @map("pharmacy_id")
  amount     Decimal  @map("amount") @db.Decimal(10,2)
  status     String   @default("pending") @map("status") @db.VarChar(20)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

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
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("system_configs")
}

// ==================== 索引定义 ====================
// 注意：Prisma会自动为@id和@unique字段创建索引
// 以下是额外需要的复合索引和性能优化索引

// 在实际应用中，您可能需要添加这些索引：
// @@index([status]) 在Order模型中
// @@index([practitionerId]) 在Order模型中  
// @@index([createdAt]) 在Order模型中
// @@index([accountId]) 在AccountTransaction模型中
// @@index([pharmacyId, medicineId]) 在PharmacyInventory模型中（已通过@@unique覆盖）
```

**重要说明：**

1. **枚举同步：** 确保所有枚举值与 SOP v1.25 中定义的状态机保持一致。
2. **约束验证：** 部分数据库级别的CHECK约束（如balance >= 0）需要在应用层通过Prisma的验证或数据库migration中添加。
3. **计算字段：** `availableCredit` 等计算字段建议在应用层计算而不是数据库级别的GENERATED列。
4. **地理坐标：** PostGIS的POINT类型在Prisma中表示为String，需要在应用层处理坐标解析。
5. **版本控制：** 所有包含`version`字段的模型都支持乐观锁并发控制。

### 7. Schema 验证与测试

**操作场景：** 终端命令（外部操作）

在完成完整的Schema定义后，务必执行以下验证步骤：

1. **语法验证：**
   ```bash
   npx prisma format
   npx prisma validate
   ```

2. **生成客户端：**
   ```bash
   npx prisma generate
   ```

3. **创建初始迁移：**
   ```bash
   npx prisma migrate dev --name initial_complete_schema
   ```

4. **验证数据库结构：**
   ```bash
   npx prisma db pull  # 确保生成的schema与数据库一致
   ```

请严格按照此完整模板进行Prisma Schema的实现，确保与SOP v1.25中的数据库设计完全一致。