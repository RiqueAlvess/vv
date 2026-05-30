-- 2A: pulse type
ALTER TABLE survey.campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(10) NOT NULL DEFAULT 'full';
ALTER TABLE survey.campaigns ADD COLUMN IF NOT EXISTS cadence VARCHAR(20);
-- 3B: company size on companies
ALTER TABLE core.companies ADD COLUMN IF NOT EXISTS company_size VARCHAR(20);
-- 3B: benchmark snapshots
CREATE TABLE IF NOT EXISTS analytics.benchmark_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_size VARCHAR(20) NOT NULL,
  igrp DECIMAL(5,2) NOT NULL,
  dim_scores JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_company_size ON analytics.benchmark_snapshots(company_size);
