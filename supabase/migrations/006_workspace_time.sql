-- Workspace time tracking per user
CREATE TABLE workspace_time (
  telegram_id TEXT PRIMARY KEY,
  personal_seconds BIGINT NOT NULL DEFAULT 0,
  work_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workspace_time ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON workspace_time FOR ALL USING (true);
