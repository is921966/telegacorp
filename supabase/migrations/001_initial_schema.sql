-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Telegram sessions (encrypted client-side)
CREATE TABLE telegram_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_data TEXT NOT NULL,
  dc_id INTEGER,
  phone_hash TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Cached dialogs
CREATE TABLE cached_dialogs (
  id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dialog_type TEXT NOT NULL,
  title TEXT,
  photo_path TEXT,
  last_message_text TEXT,
  last_message_date TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  folder_id INTEGER DEFAULT 0,
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

-- Cached messages
CREATE TABLE cached_messages (
  id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_id BIGINT,
  message_text TEXT,
  date TIMESTAMPTZ NOT NULL,
  media_type TEXT,
  media_path TEXT,
  reply_to_id BIGINT,
  is_outgoing BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, chat_id, user_id)
);

-- Push subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT true,
  message_font_size INTEGER DEFAULT 14,
  language TEXT DEFAULT 'ru',
  settings_json JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cached_dialogs_user ON cached_dialogs(user_id, last_message_date DESC);
CREATE INDEX idx_cached_messages_chat ON cached_messages(chat_id, user_id, date DESC);
CREATE INDEX idx_cached_messages_search ON cached_messages USING gin(to_tsvector('russian', message_text));

-- Row Level Security
ALTER TABLE telegram_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_dialogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions" ON telegram_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_dialogs" ON cached_dialogs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_messages" ON cached_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_push" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
