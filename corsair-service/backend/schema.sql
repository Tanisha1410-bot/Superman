-- pgvector extension enable karo
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  google_refresh_token TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  gmail_message_id TEXT UNIQUE,
  thread_id TEXT,
  sender TEXT,
  recipients TEXT[],
  subject TEXT,
  body TEXT,
  received_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium',
  category TEXT,
  triage_reason TEXT,
  status TEXT DEFAULT 'pending_triage',
  indexed BOOLEAN DEFAULT FALSE
);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  google_event_id TEXT UNIQUE,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  attendees TEXT[],
  status TEXT,
  indexed BOOLEAN DEFAULT FALSE
);

-- Vector embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT,
  source_id UUID,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent audit log
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  prompt TEXT,
  tool_calls JSONB,
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook event log
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for speed
CREATE INDEX IF NOT EXISTS idx_emails_user_date ON emails(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON calendar_events(user_id, start_time);