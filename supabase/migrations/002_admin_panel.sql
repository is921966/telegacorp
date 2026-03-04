-- ============================================================
-- Migration 002: Admin Panel — RBAC, Policies, Audit, Archive
-- ============================================================

-- RBAC: admin roles
CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(50) NOT NULL,  -- 'super_admin', 'chat_manager', 'viewer', 'agent_manager', 'compliance_officer'
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- RBAC: permission matrix per role
CREATE TABLE role_permissions (
    role VARCHAR(50) PRIMARY KEY,
    permissions JSONB NOT NULL
);

INSERT INTO role_permissions (role, permissions) VALUES
  ('super_admin', '["*"]'),
  ('chat_manager', '["chats:read","chats:write","members:manage","templates:apply"]'),
  ('viewer', '["chats:read","audit:read"]'),
  ('agent_manager', '["chats:read","agents:manage","patterns:manage","monitoring:manage","governance:read"]'),
  ('compliance_officer', '["chats:read","audit:read","archive:read","agents:read"]');

-- Policy templates for chat configuration
CREATE TABLE policy_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Chat-to-template binding (drift detection)
CREATE TABLE chat_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT NOT NULL,
    template_id UUID REFERENCES policy_templates(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ,
    is_compliant BOOLEAN DEFAULT true,
    drift_details JSONB,
    UNIQUE(chat_id)
);

-- Admin action audit log
CREATE TABLE admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id UUID REFERENCES auth.users(id),
    action_type VARCHAR(100) NOT NULL,
    target_chat_id TEXT,
    target_user_id TEXT,
    payload JSONB,
    result_status VARCHAR(20),
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat event log (long-term storage — Telegram keeps only 48h)
CREATE TABLE chat_event_log (
    id BIGSERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    event_id TEXT UNIQUE NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    user_id TEXT,
    action VARCHAR(100),
    payload JSONB,
    collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cron archive state per chat
CREATE TABLE chat_archive_state (
    chat_id BIGINT PRIMARY KEY,
    last_collected_msg_id BIGINT DEFAULT 0,
    last_collected_at TIMESTAMPTZ,
    total_messages INTEGER DEFAULT 0,
    total_files INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true
);

-- Message archive (compliance storage)
CREATE TABLE message_archive (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    sender_id BIGINT,
    sender_name TEXT,
    text TEXT,
    date TIMESTAMPTZ NOT NULL,
    media_type TEXT,
    media_file_path TEXT,
    media_file_name TEXT,
    media_file_size BIGINT,
    reply_to_msg_id BIGINT,
    forward_from TEXT,
    is_edited BOOLEAN DEFAULT false,
    raw_data JSONB,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chat_id, message_id)
);

-- Indexes
CREATE INDEX idx_admin_audit_chat ON admin_audit_log(target_chat_id);
CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at);
CREATE INDEX idx_chat_event_chat ON chat_event_log(chat_id);
CREATE INDEX idx_chat_event_date ON chat_event_log(date);
CREATE INDEX idx_archive_chat_date ON message_archive(chat_id, date DESC);
CREATE INDEX idx_archive_sender ON message_archive(sender_id, date DESC);
CREATE INDEX idx_archive_text ON message_archive USING gin(to_tsvector('russian', text));

-- Row Level Security
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_archive_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies: service_role bypasses RLS, so server-side operations work.
-- For client-side, only super_admins can query these tables directly.
-- In practice all access goes through API Routes (service_role).

-- Allow admins to read their own role
CREATE POLICY "admins_read_own_role" ON admin_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Allow anyone to read role_permissions (it's a static reference table)
CREATE POLICY "anyone_read_permissions" ON role_permissions
    FOR SELECT USING (true);

-- Supabase Storage: private bucket for corporate archive files
INSERT INTO storage.buckets (id, name, public)
VALUES ('corp-archive', 'corp-archive', false)
ON CONFLICT (id) DO NOTHING;
