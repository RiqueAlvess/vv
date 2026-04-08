-- Migration: add user_email to core.system_logs
-- Allows audit logs to record the e-mail of the user who performed each action
-- without requiring a JOIN to the users table.

ALTER TABLE core.system_logs
  ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
