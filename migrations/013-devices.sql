-- Push-notification devices (one row per app install token).
CREATE TABLE IF NOT EXISTS devices (
 token TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 platform TEXT NOT NULL CHECK(platform IN ('ios')),
 environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
 created_at TIMESTAMPTZ NOT NULL,
 last_seen TIMESTAMPTZ NOT NULL,
 disabled_at TIMESTAMPTZ,
 disabled_reason TEXT
);
CREATE INDEX IF NOT EXISTS devices_user ON devices(user_id) WHERE disabled_at IS NULL;
-- Push delivery outbox: eligible notifications start 'queued' and are sent by the scheduler.
CREATE INDEX IF NOT EXISTS notifications_push_queue ON notifications(created_at) WHERE push_status='queued';
