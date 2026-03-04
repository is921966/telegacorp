// ---- Agent lifecycle statuses ----

export type AgentStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "testing"
  | "shadow"
  | "canary"
  | "active"
  | "deprecated"
  | "retired";

export type PatternStatus =
  | "new"
  | "proposed"
  | "approved"
  | "automated"
  | "rejected";

export type FeedbackType =
  | "thumbs_up"
  | "thumbs_down"
  | "correction"
  | "comment";

// ---- Domain types ----

export interface AutomationPattern {
  id: string;
  description: string;
  frequency: string | null;
  avg_duration_minutes: number | null;
  participants: number[];
  sample_messages: Record<string, unknown>[] | null;
  estimated_roi_monthly: number | null;
  confidence: number | null;
  status: PatternStatus;
  detected_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  pattern_id: string | null;
  workspace_path: string | null;
  model: string;
  gateway_id: string | null;
  permissions: Record<string, unknown>;
  config: Record<string, unknown>;
  assigned_chats: number[];
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  retired_at: string | null;
}

export interface AgentMetrics {
  id: number;
  agent_id: string;
  period_start: string;
  period_end: string;
  executions: number;
  successful: number;
  failed: number;
  avg_response_time_ms: number | null;
  tokens_consumed: number;
  cost_usd: number;
  user_corrections: number;
  time_saved_minutes: number;
}

export interface AgentFeedback {
  id: number;
  agent_id: string;
  user_id: string | null;
  type: FeedbackType;
  message: string | null;
  original_output: string | null;
  corrected_output: string | null;
  created_at: string;
}

export interface AgentAuditEntry {
  id: number;
  agent_id: string | null;
  action: string;
  chat_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface MonitoredChat {
  chat_id: number;
  title: string | null;
  monitoring_enabled: boolean;
  consent_obtained_at: string | null;
  assigned_agents: string[];
  excluded_topics: string[];
  created_at: string;
}

// ---- Aggregate types ----

export interface AgentWithMetrics extends Agent {
  latestMetrics: AgentMetrics | null;
  feedbackSummary: {
    thumbs_up: number;
    thumbs_down: number;
    corrections: number;
  } | null;
}

export interface GovernanceDashboard {
  totalAgents: number;
  activeAgents: number;
  totalPatterns: number;
  pendingPatterns: number;
  monitoredChats: number;
  totalExecutions: number;
  totalCostUsd: number;
  totalTimeSavedMinutes: number;
}
