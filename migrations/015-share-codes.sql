-- Short share links (/c/<code>) for a group invite, a single call, or a weekly result.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;
