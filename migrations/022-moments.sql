-- Moments: a few calls around one occasion (a birthday, a trip, a night out). Everyone picks before it starts.
CREATE TABLE IF NOT EXISTS moments (id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id), creator TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, title TEXT NOT NULL, subject_name TEXT, starts_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, share_code TEXT UNIQUE);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS moment_id TEXT REFERENCES moments(id);
CREATE INDEX IF NOT EXISTS questions_moment ON questions(moment_id) WHERE moment_id IS NOT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS moment_pos INTEGER;
