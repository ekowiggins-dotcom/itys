ALTER TABLE members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE groups ADD COLUMN IF NOT EXISTS fallback_id TEXT;
CREATE TABLE IF NOT EXISTS question_requests (group_id TEXT REFERENCES groups(id), user_id TEXT REFERENCES users(id), request_id TEXT NOT NULL, question_id TEXT REFERENCES questions(id), PRIMARY KEY(group_id,user_id,request_id));
