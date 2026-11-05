-- Who says what happened on a call. NULL means the group admin (the default).
ALTER TABLE questions ADD COLUMN IF NOT EXISTS resolver_id TEXT REFERENCES users(id);
