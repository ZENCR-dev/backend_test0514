-- Create prescriptions table manually
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id TEXT UNIQUE NOT NULL,
  doctor_id TEXT NOT NULL,
  patient_info JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  qr_code_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescription_medicines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  dosage_instructions TEXT NOT NULL,
  duration INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_medicines_prescription_id ON prescription_medicines(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_medicines_medicine_id ON prescription_medicines(medicine_id);