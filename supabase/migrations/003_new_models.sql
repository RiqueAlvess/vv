-- ============================================================================
-- Migration 003: New models added after initial schema
-- All statements use IF NOT EXISTS for idempotency
-- ============================================================================

-- ============================================================================
-- SCHEMA: core — Job
-- ============================================================================
CREATE TABLE IF NOT EXISTS core.jobs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type         varchar(50) NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}',
  status       varchar(20) NOT NULL DEFAULT 'pending',
  attempts     int         NOT NULL DEFAULT 0,
  max_attempts int         NOT NULL DEFAULT 3,
  error        text,
  run_after    timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after ON core.jobs (status, run_after);

-- ============================================================================
-- SCHEMA: core — CompanyFeedbackChannel
-- ============================================================================
CREATE TABLE IF NOT EXISTS core.company_feedback_channels (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL UNIQUE REFERENCES core.companies(id) ON DELETE CASCADE,
  public_token text        NOT NULL UNIQUE,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SCHEMA: core — AnonymousFeedback
-- ============================================================================
CREATE TABLE IF NOT EXISTS core.anonymous_feedbacks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid        NOT NULL REFERENCES core.company_feedback_channels(id) ON DELETE CASCADE,
  type       varchar(20) NOT NULL,
  category   varchar(30),
  message    text        NOT NULL,
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SCHEMA: core — Article
-- ============================================================================
CREATE TABLE IF NOT EXISTS core.articles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  slug       text        NOT NULL UNIQUE,
  content    text        NOT NULL DEFAULT '',
  cover_url  text,
  pinned     boolean     NOT NULL DEFAULT false,
  published  boolean     NOT NULL DEFAULT true,
  author_id  uuid        NOT NULL REFERENCES core.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SCHEMA: survey — ChecklistProgress
-- ============================================================================
CREATE TABLE IF NOT EXISTS survey.checklist_progress (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid        NOT NULL UNIQUE REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  checked_items jsonb       NOT NULL DEFAULT '[]',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SCHEMA: survey — ChecklistEvidence
-- ============================================================================
CREATE TABLE IF NOT EXISTS survey.checklist_evidences (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid        NOT NULL REFERENCES survey.checklist_progress(id) ON DELETE CASCADE,
  item_id      text        NOT NULL,
  file_name    text        NOT NULL,
  file_url     text        NOT NULL,
  file_type    varchar(50) NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SCHEMA: analytics — CampaignMetrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics.campaign_metrics (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          uuid         NOT NULL UNIQUE REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  total_invited        int          NOT NULL DEFAULT 0,
  total_responded      int          NOT NULL DEFAULT 0,
  response_rate        numeric(5,2) NOT NULL DEFAULT 0,
  igrp                 numeric(5,2),
  risk_distribution    jsonb,
  dimension_scores     jsonb,
  demographic_data     jsonb,
  heatmap_data         jsonb,
  top_critical_sectors jsonb,
  scores_by_gender     jsonb,
  scores_by_age        jsonb,
  top_critical_groups  jsonb,
  calculated_at        timestamptz,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================================
-- SCHEMA: analytics — DimSector
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics.dim_sectors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid        NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  unit_name     text,
  sector_name   text,
  position_name text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
