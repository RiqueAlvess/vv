ALTER TABLE core.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON core.users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON core.users(role);
