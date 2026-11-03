-- Who proposed the result, so a proposer (e.g. an admin after takeover) is never their own judge.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS proposed_by TEXT REFERENCES users(id);
-- Backfill: admin takeovers are recorded in the audit trail; everything else was proposed by the creator.
UPDATE questions q SET proposed_by=COALESCE(
  (SELECT a.actor_id FROM audit a WHERE a.question_id=q.id AND a.action='admin takeover' ORDER BY a.created_at DESC LIMIT 1),
  q.creator)
WHERE q.proposed_at IS NOT NULL AND q.proposed_by IS NULL;
