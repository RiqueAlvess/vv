-- ============================================================================
-- Migration 016: Remove LIDERANCA role
-- The LIDERANCA role is no longer used. This migration reassigns any existing
-- users with that role to RH, then tightens the CHECK constraint to allow
-- only ADM and RH.
-- ============================================================================

-- Step 1: Reassign any existing LIDERANCA users to RH
UPDATE core.users SET role = 'RH' WHERE role = 'LIDERANCA';

-- Step 2: Drop the existing CHECK constraint on the role column
-- (uses a DO block because the auto-generated constraint name may vary)
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  WHERE pg_namespace.nspname = 'core'
    AND pg_class.relname = 'users'
    AND pg_constraint.contype = 'c'
    AND pg_get_constraintdef(pg_constraint.oid) LIKE '%role%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE core.users DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;

-- Step 3: Add new CHECK constraint — only ADM and RH are valid roles
ALTER TABLE core.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('ADM', 'RH'));
