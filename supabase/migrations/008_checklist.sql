-- Drop old company-scoped tables if they exist
DROP TABLE IF EXISTS core.checklist_evidences;
DROP TABLE IF EXISTS core.checklist_progress;

-- Campaign-scoped checklist
CREATE TABLE IF NOT EXISTS survey.checklist_progress (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid        NOT NULL UNIQUE REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  checked_items jsonb       NOT NULL DEFAULT '[]',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey.checklist_evidences (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid        NOT NULL REFERENCES survey.checklist_progress(id) ON DELETE CASCADE,
  item_id      text        NOT NULL,
  file_name    text        NOT NULL,
  file_url     text        NOT NULL,
  file_type    varchar(50) NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_campaign ON survey.checklist_progress(campaign_id);
CREATE INDEX IF NOT EXISTS idx_checklist_evidences_item ON survey.checklist_evidences(checklist_id, item_id);
