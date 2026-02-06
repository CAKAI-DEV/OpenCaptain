-- Check-in blocks table
CREATE TABLE IF NOT EXISTS check_in_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by_id UUID NOT NULL REFERENCES users(id),

  name VARCHAR(255) NOT NULL,
  description VARCHAR(1000),

  cron_pattern VARCHAR(50) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

  questions JSONB NOT NULL,
  template_id VARCHAR(50),

  target_type VARCHAR(20) NOT NULL DEFAULT 'all',
  target_squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
  target_role VARCHAR(50),

  enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS check_in_blocks_project_id_idx ON check_in_blocks(project_id);
CREATE INDEX IF NOT EXISTS check_in_blocks_enabled_idx ON check_in_blocks(enabled);

-- Check-in responses table
CREATE TABLE IF NOT EXISTS check_in_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_block_id UUID NOT NULL REFERENCES check_in_blocks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  responses JSONB,

  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS check_in_responses_block_id_idx ON check_in_responses(check_in_block_id);
CREATE INDEX IF NOT EXISTS check_in_responses_user_id_idx ON check_in_responses(user_id);
CREATE INDEX IF NOT EXISTS check_in_responses_status_idx ON check_in_responses(status);
CREATE INDEX IF NOT EXISTS check_in_responses_sent_at_idx ON check_in_responses(sent_at);
