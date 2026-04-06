-- ============================================================
-- Migration 003: System Logs + Notification Modal
-- ============================================================

-- ─────────────────────────────────────────
-- system_logs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.system_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       VARCHAR(10)  NOT NULL,       -- INFO | WARN | ERROR | AUDIT
  action      VARCHAR(100) NOT NULL,       -- e.g. "user.login", "campaign.close"
  user_id     UUID,
  company_id  UUID,
  target_id   UUID,
  target_type VARCHAR(50),
  message     TEXT NOT NULL,
  metadata    JSONB,
  ip          VARCHAR(50),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level_created ON core.system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_created  ON core.system_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created       ON core.system_logs(created_at DESC);

-- ─────────────────────────────────────────
-- system_notifications
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.system_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  active      BOOLEAN DEFAULT true NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_by  UUID NOT NULL REFERENCES core.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─────────────────────────────────────────
-- system_notification_views
-- Tracks which users have already seen each notification (show-once guarantee)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.system_notification_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES core.system_notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  viewed_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(notification_id, user_id)
);
