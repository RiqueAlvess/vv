-- ============================================================================
-- Performance indexes for production scale
-- All indexes use IF NOT EXISTS for idempotency
-- ============================================================================

-- Survey response lookups by campaign
CREATE INDEX IF NOT EXISTS idx_survey_responses_campaign_id
  ON survey.survey_responses(campaign_id);

-- Invitation lookups by campaign and status
CREATE INDEX IF NOT EXISTS idx_survey_invitations_campaign_id
  ON survey.survey_invitations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_survey_invitations_status
  ON survey.survey_invitations(status);

-- Analytics fact table
CREATE INDEX IF NOT EXISTS idx_fact_responses_campaign_id
  ON analytics.fact_responses(campaign_id);

-- BullMQ job processing (partial index for active jobs only)
CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after
  ON core.jobs(status, run_after)
  WHERE status IN ('pending', 'failed');
