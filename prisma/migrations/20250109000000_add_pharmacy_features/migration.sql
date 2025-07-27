-- 添加药房账户表
CREATE TABLE "pharmacy_accounts" (
  "id" TEXT NOT NULL,
  "pharmacy_id" TEXT NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "pending_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pharmacy_accounts_pkey" PRIMARY KEY ("id")
);

-- 添加药房账户交易表
CREATE TABLE "pharmacy_account_transactions" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "transaction_type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balance_before" DECIMAL(12,2) NOT NULL,
  "balance_after" DECIMAL(12,2) NOT NULL,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "description" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pharmacy_account_transactions_pkey" PRIMARY KEY ("id")
);

-- 添加采购订单表
CREATE TABLE "purchase_orders" (
  "id" TEXT NOT NULL,
  "po_number" TEXT NOT NULL,
  "pharmacy_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "fulfillment_proof_id" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_review',
  "review_notes" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- 添加价目表版本表
CREATE TABLE "pharmacy_price_lists" (
  "id" TEXT NOT NULL,
  "pharmacy_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effective_date" DATE NOT NULL,
  "items" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_approval',
  "notes" TEXT,
  "approved_by" TEXT,
  "approved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pharmacy_price_lists_pkey" PRIMARY KEY ("id")
);

-- 添加提现申请表
CREATE TABLE "withdrawal_requests" (
  "id" TEXT NOT NULL,
  "pharmacy_id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "purchase_order_ids" JSONB NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "bank_details" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_review',
  "notes" TEXT,
  "processed_by" TEXT,
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- 创建唯一约束和索引
CREATE UNIQUE INDEX "pharmacy_accounts_pharmacy_id_key" ON "pharmacy_accounts"("pharmacy_id");
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");
CREATE UNIQUE INDEX "purchase_orders_fulfillment_proof_id_key" ON "purchase_orders"("fulfillment_proof_id");
CREATE UNIQUE INDEX "withdrawal_requests_invoice_number_key" ON "withdrawal_requests"("invoice_number");

-- 创建索引
CREATE INDEX "pharmacy_account_transactions_account_id_idx" ON "pharmacy_account_transactions"("account_id");
CREATE INDEX "pharmacy_account_transactions_created_at_idx" ON "pharmacy_account_transactions"("created_at" DESC);
CREATE INDEX "purchase_orders_pharmacy_id_idx" ON "purchase_orders"("pharmacy_id");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "pharmacy_price_lists_pharmacy_id_idx" ON "pharmacy_price_lists"("pharmacy_id");
CREATE INDEX "pharmacy_price_lists_status_idx" ON "pharmacy_price_lists"("status");
CREATE INDEX "withdrawal_requests_pharmacy_id_idx" ON "withdrawal_requests"("pharmacy_id");
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- 添加外键约束
ALTER TABLE "pharmacy_accounts" ADD CONSTRAINT "pharmacy_accounts_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pharmacy_account_transactions" ADD CONSTRAINT "pharmacy_account_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "pharmacy_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_fulfillment_proof_id_fkey" FOREIGN KEY ("fulfillment_proof_id") REFERENCES "fulfillment_proofs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pharmacy_price_lists" ADD CONSTRAINT "pharmacy_price_lists_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;