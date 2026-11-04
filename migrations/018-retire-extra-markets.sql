-- Exact score, over/under and match of the week are gone: every match is one "Who wins?" call.
-- Unsettled questions of the old kinds are taken down and count for nobody. Settled ones stay in history.
DELETE FROM predictions WHERE question_id IN (SELECT id FROM questions WHERE market IN ('exact_score','over_under') AND state NOT IN ('settled','void'));
UPDATE questions SET superseded=true,state='void',void_reason='Question type retired' WHERE market IN ('exact_score','over_under') AND state NOT IN ('settled','void');
UPDATE questions SET slot='featured' WHERE slot='motw';
