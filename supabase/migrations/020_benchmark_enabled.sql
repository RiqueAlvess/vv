-- Add benchmark_enabled flag to companies table
-- Controls whether a company's anonymous metrics are included in the platform benchmark
ALTER TABLE core.companies
  ADD COLUMN IF NOT EXISTS benchmark_enabled BOOLEAN NOT NULL DEFAULT true;
