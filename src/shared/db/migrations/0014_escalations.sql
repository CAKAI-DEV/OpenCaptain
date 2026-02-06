-- Escalation blocks table - admin-configured escalation rules
CREATE TABLE IF NOT EXISTS escalation_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by_id UUID NOT NULL REFERENCES users(id),

  name VARCHAR(255) NOT NULL,
  description VARCHAR(1000),

  -- Trigger configuration
  trigger_type VARCHAR(50) NOT NULL, -- blocker_reported, deadline_risk, output_below_threshold

  -- Deadline risk configuration
  deadline_warning_days INTEGER,

  -- Output threshold configuration
  output_threshold INTEGER,
  output_period_days INTEGER,

  -- Targeting
  target_type VARCHAR(20) NOT NULL DEFAULT 'all',
  target_squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
  target_role VARCHAR(50),

  -- Escalation chain (time-windowed routing steps as JSONB)
  escalation_steps JSONB NOT NULL,

  enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS escalation_blocks_project_id_idx ON escalation_blocks(project_id);
CREATE INDEX IF NOT EXISTS escalation_blocks_trigger_type_idx ON escalation_blocks(trigger_type);
CREATE INDEX IF NOT EXISTS escalation_blocks_enabled_idx ON escalation_blocks(enabled);

-- Blockers table - user-reported obstacles
CREATE TABLE IF NOT EXISTS blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  reported_by_id UUID NOT NULL REFERENCES users(id),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, in_progress, resolved, cancelled

  resolved_by_id UUID REFERENCES users(id),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blockers_project_id_idx ON blockers(project_id);
CREATE INDEX IF NOT EXISTS blockers_reported_by_id_idx ON blockers(reported_by_id);
CREATE INDEX IF NOT EXISTS blockers_status_idx ON blockers(status);
CREATE INDEX IF NOT EXISTS blockers_task_id_idx ON blockers(task_id);
CREATE INDEX IF NOT EXISTS blockers_created_at_idx ON blockers(created_at);

-- Escalation instances table - tracking active escalation chains
CREATE TABLE IF NOT EXISTS escalation_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  escalation_block_id UUID NOT NULL REFERENCES escalation_blocks(id) ON DELETE CASCADE,

  trigger_type VARCHAR(50) NOT NULL,
  blocker_id UUID REFERENCES blockers(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  current_step INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, resolved, cancelled

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS escalation_instances_project_id_idx ON escalation_instances(project_id);
CREATE INDEX IF NOT EXISTS escalation_instances_blocker_id_idx ON escalation_instances(blocker_id);
CREATE INDEX IF NOT EXISTS escalation_instances_status_idx ON escalation_instances(status);
CREATE INDEX IF NOT EXISTS escalation_instances_target_user_id_idx ON escalation_instances(target_user_id);
CREATE INDEX IF NOT EXISTS escalation_instances_started_at_idx ON escalation_instances(started_at);
