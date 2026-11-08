-- Settling between friends: whoever posted a call says what happened. If someone says it's not right,
-- the group votes on what actually happened (public votes, most votes wins, a tie keeps the settler's answer).
CREATE TABLE IF NOT EXISTS result_votes (question_id TEXT REFERENCES questions(id), user_id TEXT REFERENCES users(id), answer TEXT NOT NULL, voted_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(question_id,user_id));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
