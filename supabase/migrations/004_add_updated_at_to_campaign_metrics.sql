-- Add missing updated_at column to analytics.campaign_metrics
ALTER TABLE analytics.campaign_metrics
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill existing rows
UPDATE analytics.campaign_metrics SET updated_at = created_at WHERE updated_at IS NULL;

-- Set NOT NULL after backfill
ALTER TABLE analytics.campaign_metrics
  ALTER COLUMN updated_at SET NOT NULL;
