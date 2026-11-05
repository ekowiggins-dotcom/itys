-- Social setup: each group has a colour and a language (for its WhatsApp cards) and the names of friends who haven't joined yet.
-- Calls can have friends as their answers.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS pending_names JSONB NOT NULL DEFAULT '[]';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer_type TEXT NOT NULL DEFAULT 'choice';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS instant BOOLEAN NOT NULL DEFAULT false;
