-- The pivot: every group becomes a friends group. Football matches that haven't finished are taken down and count for nobody.
DELETE FROM predictions WHERE question_id IN (SELECT id FROM questions WHERE fixture_id IS NOT NULL AND state NOT IN ('settled','void'));
UPDATE questions SET superseded=true,state='void',void_reason='Football is no longer part of Calld' WHERE fixture_id IS NOT NULL AND state NOT IN ('settled','void');
-- A football week that's running keeps its dates but takes the group's own calls (3, as in a mixed week); a week that hasn't started becomes a friends week.
UPDATE rounds SET group_type='Mixed',state=CASE WHEN state='waiting_feed' THEN 'live' ELSE state END,content_ready=true WHERE group_type='Football' AND state IN ('live','waiting_feed','provisional');
UPDATE rounds SET group_type='Friends',content_ready=true WHERE group_type<>'Friends' AND state='planned';
UPDATE groups SET group_type='Friends',pending_settings=NULL WHERE group_type<>'Friends' OR pending_settings IS NOT NULL;
