-- Database-backed job queue for async processing
CREATE TABLE IF NOT EXISTS core.jobs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        varchar(50) NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}',
  status      varchar(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts    int         NOT NULL DEFAULT 0,
  max_attempts int        NOT NULL DEFAULT 3,
  error       text,
  run_after   timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_status_run_after ON core.jobs (status, run_after)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_jobs_type ON core.jobs (type);
