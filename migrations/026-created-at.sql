-- When each call was made, for the operator's metrics page (calls per group per week).
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE questions q SET created_at=COALESCE((SELECT min(p.submitted_at) FROM predictions p WHERE p.question_id=q.id),q.locks_at) WHERE created_at IS NULL;
ALTER TABLE questions ALTER COLUMN created_at SET DEFAULT now();
