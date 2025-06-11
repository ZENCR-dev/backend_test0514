/*
  Warnings:

  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" TEXT NOT NULL DEFAULT 'password_not_set_for_existing_user';

-- CreateIndex
CREATE INDEX "account_transactions_account_id_idx" ON "account_transactions"("account_id");

-- CreateIndex
CREATE INDEX "account_transactions_created_at_idx" ON "account_transactions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "account_transactions_reference_type_reference_id_idx" ON "account_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "account_transactions_account_id_transaction_type_idx" ON "account_transactions"("account_id", "transaction_type");

-- CreateIndex
CREATE INDEX "account_transactions_reference_type_reference_id_created_at_idx" ON "account_transactions"("reference_type", "reference_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "clinic_accounts_status_idx" ON "clinic_accounts"("status");

-- CreateIndex
CREATE INDEX "fulfillment_proofs_order_id_idx" ON "fulfillment_proofs"("order_id");

-- CreateIndex
CREATE INDEX "fulfillment_proofs_pharmacy_id_idx" ON "fulfillment_proofs"("pharmacy_id");

-- CreateIndex
CREATE INDEX "fulfillment_proofs_review_status_idx" ON "fulfillment_proofs"("review_status");

-- CreateIndex
CREATE INDEX "medicines_name_idx" ON "medicines"("name");

-- CreateIndex
CREATE INDEX "medicines_category_idx" ON "medicines"("category");

-- CreateIndex
CREATE INDEX "medicines_status_idx" ON "medicines"("status");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_practitioner_id_idx" ON "orders"("practitioner_id");

-- CreateIndex
CREATE INDEX "orders_clinic_id_idx" ON "orders"("clinic_id");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_practitioner_id_status_idx" ON "orders"("practitioner_id", "status");

-- CreateIndex
CREATE INDEX "orders_clinic_id_status_idx" ON "orders"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pharmacies_status_idx" ON "pharmacies"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
