-- Migration: Add user_companies table for multi-company access
-- Users can belong to multiple companies; this table tracks those relationships.

CREATE TABLE IF NOT EXISTS core.user_companies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES core.users(id)     ON DELETE CASCADE,
  company_id UUID        NOT NULL REFERENCES core.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_company UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON core.user_companies(user_id);

-- Back-fill: every existing user gets an entry for their current company
INSERT INTO core.user_companies (user_id, company_id)
SELECT id, company_id FROM core.users
ON CONFLICT DO NOTHING;
