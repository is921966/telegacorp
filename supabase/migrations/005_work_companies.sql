-- ============================================================
-- Migration 005: Work Companies table + Admin Roles by Telegram ID
-- ============================================================

-- ---- Part A: Work Companies per Telegram ID ----

CREATE TABLE work_companies (
  telegram_id TEXT PRIMARY KEY,
  companies JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON work_companies
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---- Part B: Switch admin_roles to telegram_id ----

-- Drop existing constraints referencing auth.users
ALTER TABLE admin_roles DROP CONSTRAINT IF EXISTS admin_roles_user_id_key;
ALTER TABLE admin_roles DROP CONSTRAINT IF EXISTS admin_roles_user_id_fkey;
ALTER TABLE admin_roles DROP CONSTRAINT IF EXISTS admin_roles_granted_by_fkey;

-- Rename and retype user_id → telegram_id
ALTER TABLE admin_roles RENAME COLUMN user_id TO telegram_id;
ALTER TABLE admin_roles ALTER COLUMN telegram_id TYPE TEXT;
ALTER TABLE admin_roles ADD CONSTRAINT admin_roles_telegram_id_key UNIQUE (telegram_id);

-- Rename and retype granted_by → granted_by_telegram_id
ALTER TABLE admin_roles RENAME COLUMN granted_by TO granted_by_telegram_id;
ALTER TABLE admin_roles ALTER COLUMN granted_by_telegram_id TYPE TEXT;

-- ---- Part C: Switch admin_audit_log to telegram_id ----

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_user_id_fkey;
ALTER TABLE admin_audit_log RENAME COLUMN admin_user_id TO admin_telegram_id;
ALTER TABLE admin_audit_log ALTER COLUMN admin_telegram_id TYPE TEXT;

-- ---- Part D: Switch other admin-related columns to telegram_id ----

-- policy_templates.created_by
ALTER TABLE policy_templates DROP CONSTRAINT IF EXISTS policy_templates_created_by_fkey;
ALTER TABLE policy_templates RENAME COLUMN created_by TO created_by_telegram_id;
ALTER TABLE policy_templates ALTER COLUMN created_by_telegram_id TYPE TEXT;

-- agents.approved_by
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_approved_by_fkey;
ALTER TABLE agents RENAME COLUMN approved_by TO approved_by_telegram_id;
ALTER TABLE agents ALTER COLUMN approved_by_telegram_id TYPE TEXT;

-- automation_patterns.reviewed_by
ALTER TABLE automation_patterns DROP CONSTRAINT IF EXISTS automation_patterns_reviewed_by_fkey;
ALTER TABLE automation_patterns RENAME COLUMN reviewed_by TO reviewed_by_telegram_id;
ALTER TABLE automation_patterns ALTER COLUMN reviewed_by_telegram_id TYPE TEXT;

-- agent_feedback.user_id (this is the admin who gave feedback)
ALTER TABLE agent_feedback DROP CONSTRAINT IF EXISTS agent_feedback_user_id_fkey;
ALTER TABLE agent_feedback RENAME COLUMN user_id TO telegram_id;
ALTER TABLE agent_feedback ALTER COLUMN telegram_id TYPE TEXT;

-- ---- Part B2: RLS policy for admin_roles (replace dropped admins_read_own_role) ----
-- Allow authenticated users to read admin_roles (needed for client-side admin badge)
DROP POLICY IF EXISTS "admins_read_own_role" ON admin_roles;
CREATE POLICY "authenticated_select" ON admin_roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- ---- Part E: Telegram Users directory (auto-populated on login) ----

CREATE TABLE telegram_users (
  telegram_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  phone TEXT,
  photo_url TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON telegram_users
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
