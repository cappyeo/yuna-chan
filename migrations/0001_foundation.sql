CREATE TABLE guild_settings (
  guild_id text PRIMARY KEY CHECK (guild_id ~ '^[0-9]{17,20}$'),
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'vi')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  interaction_id text NOT NULL UNIQUE,
  guild_id text NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_guild_time_idx ON audit_events (guild_id, created_at);
CREATE INDEX audit_events_time_idx ON audit_events (created_at);
