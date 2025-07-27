-- Add prescription_id, medicine_items, GST fields to purchase_orders table
ALTER TABLE "purchase_orders" 
ADD COLUMN "prescription_id" TEXT,
ADD COLUMN "medicine_items" JSONB,
ADD COLUMN "gst_amount" DECIMAL(12,2),
ADD COLUMN "net_amount" DECIMAL(12,2);

-- Create index for prescription_id
CREATE INDEX "purchase_orders_prescription_id_idx" ON "purchase_orders"("prescription_id");

-- Add foreign key constraint for prescription_id
ALTER TABLE "purchase_orders" 
ADD CONSTRAINT "purchase_orders_prescription_id_fkey" 
FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;