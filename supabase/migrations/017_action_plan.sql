-- 017_action_plan.sql
-- Stores AI-generated action plans per campaign (one plan per campaign).
-- problems: JSONB array of ActionPlanProblem objects (see src/lib/hse-agent.ts).

CREATE TABLE IF NOT EXISTS survey.action_plans (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        UNIQUE NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  model_used   VARCHAR(100),
  problems     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plans_campaign_id ON survey.action_plans(campaign_id);
