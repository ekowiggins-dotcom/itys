-- Custom bets may have 2–4 named options. NULL means a classic yes/no bet.
-- Answers are stored as the option labels themselves, so results and audit stay readable.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS options JSONB;
