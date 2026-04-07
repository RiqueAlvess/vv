-- ============================================================
-- Migration 012: campaign_employees + total_employees KPI
-- Version 1.0.6
-- ============================================================

-- 1. Create campaign_employees table
-- Stores one row per employee registered via CSV.
-- cpf_hash = SHA-256(campaign_salt:cpf_digits), nulled after response.
-- has_responded = permanent flag once survey submitted.
-- validation_token = ephemeral UUID issued on CPF verify, deleted on use.
CREATE TABLE IF NOT EXISTS survey.campaign_employees (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                 UUID        NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  cpf_hash                    VARCHAR(64),
  has_responded               BOOLEAN     NOT NULL DEFAULT FALSE,
  validation_token            UUID        UNIQUE,
  validation_token_expires_at TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_employees_campaign_cpf
  ON survey.campaign_employees(campaign_id, cpf_hash);

CREATE INDEX IF NOT EXISTS idx_campaign_employees_validation_token
  ON survey.campaign_employees(validation_token);

-- 2. Add total_employees to campaign_metrics
ALTER TABLE analytics.campaign_metrics
  ADD COLUMN IF NOT EXISTS total_employees INT NOT NULL DEFAULT 0;

-- 3. Remove fingerprint from survey_responses (no longer needed)
DROP INDEX IF EXISTS survey.idx_survey_responses_campaign_fingerprint;
ALTER TABLE survey.survey_responses
  DROP COLUMN IF EXISTS fingerprint;
