-- Migration 013: link CampaignEmployee to CampaignPosition
-- Enables pre-suggestion of hierarchy (unit/sector/cargo) on the survey page
-- based on the employee's position imported via CSV.

ALTER TABLE survey.campaign_employees
  ADD COLUMN IF NOT EXISTS position_id UUID
    REFERENCES survey.campaign_positions(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_employees_position_id
  ON survey.campaign_employees(position_id);
