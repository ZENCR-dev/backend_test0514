-- Migration: Rename amounts to copies in orders table
-- Created: 2025-07-22
-- Purpose: Standardize field naming according to API documentation

BEGIN;

-- Add copies column with same type and constraints as amounts
ALTER TABLE orders 
ADD COLUMN copies INT;

-- Copy data from amounts to copies
UPDATE orders 
SET copies = amounts;

-- Make copies NOT NULL (same constraint as amounts)
ALTER TABLE orders 
ALTER COLUMN copies SET NOT NULL;

-- Drop the old amounts column
ALTER TABLE orders 
DROP COLUMN amounts;

-- Add check constraint if needed (assuming amounts had reasonable range)
ALTER TABLE orders 
ADD CONSTRAINT check_copies_positive CHECK (copies > 0 AND copies <= 100);

-- Update comments for documentation
COMMENT ON COLUMN orders.copies IS 'Number of prescription copies (帖数) - renamed from amounts';

COMMIT;