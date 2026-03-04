-- ============================================================
-- Migration 003: Agent Factory tables
-- Supports Phases 7-11 (AI Agent lifecycle)
-- ============================================================

-- Monitored chats (consent-based AI observation)
CREATE TABLE monitored_chats (
    chat_id BIGINT PRIMARY KEY,
    title TEXT,
    monitoring_enabled BOOLEAN DEFAULT false,
    consent_obtained_at TIMESTAMPTZ,
    assigned_agents UUID[],
    excluded_topics TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Automation patterns discovered by Conversation Intelligence
CREATE TABLE automation_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    frequency TEXT,
    avg_duration_minutes INTEGER,
    participants BIGINT[],
    sample_messages JSONB,
    estimated_roi_monthly DECIMAL(10,2),
    confidence FLOAT,
    status TEXT DEFAULT 'new',
    -- new → proposed → approved → automated → rejected
    detected_at TIMESTAMPTZ DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ
);

-- Agents (full lifecycle)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    -- draft → proposed → approved → testing → shadow → canary → active → deprecated → retired
    pattern_id UUID REFERENCES automation_patterns(id),
    workspace_path TEXT,
    model TEXT NOT NULL,
    gateway_id TEXT,
    permissions JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}',
    assigned_chats BIGINT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    retired_at TIMESTAMPTZ
);

-- Agent performance metrics (aggregated periods)
CREATE TABLE agent_metrics (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    executions INTEGER DEFAULT 0,
    successful INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    tokens_consumed BIGINT DEFAULT 0,
    cost_usd DECIMAL(10,4) DEFAULT 0,
    user_corrections INTEGER DEFAULT 0,
    time_saved_minutes INTEGER DEFAULT 0
);

-- User feedback on agent actions
CREATE TABLE agent_feedback (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    type TEXT NOT NULL,
    -- thumbs_up, thumbs_down, correction, comment
    message TEXT,
    original_output TEXT,
    corrected_output TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent action audit log
CREATE TABLE agent_audit_log (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID REFERENCES agents(id),
    action TEXT NOT NULL,
    chat_id BIGINT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_patterns_status ON automation_patterns(status);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agent_metrics_agent ON agent_metrics(agent_id, period_start DESC);
CREATE INDEX idx_agent_feedback_agent ON agent_feedback(agent_id, created_at DESC);
CREATE INDEX idx_agent_audit ON agent_audit_log(agent_id, created_at DESC);
CREATE INDEX idx_monitored_chats_enabled ON monitored_chats(monitoring_enabled) WHERE monitoring_enabled = true;

-- RLS (enforced, policies managed via service_role bypass)
ALTER TABLE monitored_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
