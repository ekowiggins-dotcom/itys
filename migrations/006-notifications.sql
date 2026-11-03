CREATE TABLE notification_preferences (
 group_id TEXT REFERENCES groups(id),user_id TEXT REFERENCES users(id),muted BOOLEAN NOT NULL DEFAULT false,
 round_open BOOLEAN NOT NULL DEFAULT true,lock_reminder BOOLEAN NOT NULL DEFAULT true,weekly_final BOOLEAN NOT NULL DEFAULT true,
 PRIMARY KEY(group_id,user_id)
);
CREATE TABLE notification_counters (
 group_id TEXT REFERENCES groups(id),user_id TEXT REFERENCES users(id),week_start DATE NOT NULL,
 routine_count INTEGER NOT NULL DEFAULT 0 CHECK(routine_count BETWEEN 0 AND 4),PRIMARY KEY(group_id,user_id,week_start)
);
CREATE TABLE notifications (
 id TEXT PRIMARY KEY,group_id TEXT REFERENCES groups(id),user_id TEXT REFERENCES users(id),source_key TEXT NOT NULL,
 kind TEXT NOT NULL,category TEXT NOT NULL,question_id TEXT REFERENCES questions(id),round_id TEXT REFERENCES rounds(id),
 text TEXT NOT NULL,event_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL,in_app BOOLEAN NOT NULL,
 push_eligible BOOLEAN NOT NULL,push_status TEXT NOT NULL DEFAULT 'not_configured',suppressed_reason TEXT,read_at TIMESTAMPTZ,
 UNIQUE(group_id,user_id,source_key)
);
CREATE INDEX notifications_inbox ON notifications(group_id,user_id,created_at DESC);
