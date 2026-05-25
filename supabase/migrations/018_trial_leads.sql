-- Migration: create trial_leads table
CREATE TABLE IF NOT EXISTS core.trial_leads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  phone        TEXT,
  company_name TEXT        NOT NULL,
  company_size TEXT        NOT NULL,
  sector       TEXT,
  role         TEXT,
  pain_points  TEXT[]      NOT NULL DEFAULT '{}',
  interest     INT         NOT NULL CHECK (interest BETWEEN 1 AND 10),
  message      TEXT,
  analytics    JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_leads_created_at_idx ON core.trial_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS trial_leads_interest_idx   ON core.trial_leads (interest DESC);
