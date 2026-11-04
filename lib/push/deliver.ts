import { db } from '../db';
import { apnsConfig, sendAlert, deadToken, type ApnsConfig, type Transport, http2Transport } from './apns';

const TITLES: Record<string, string> = {
  about_you: 'They’re talking about you', round_open: 'A new week of calls', lock_reminder: 'Your friends made their calls', weekly_final: 'The week is final',
  proposal: 'The result’s in', dispute: 'Someone said that’s not right', judgment_request: 'You’re the judge',
  settlement: 'It counts now', moderation: 'Group safety', match_change: 'Match updated',
};
const MAX_AGE = 6 * 3600000;

/** Sends queued push notifications. Runs from the scheduler, outside group transactions,
 * so a slow network never holds a group lock. Each notification is claimed before sending. */
export async function deliverPending(now = new Date(), cfg: ApnsConfig | null = apnsConfig(), transport: Transport = http2Transport) {
  if (!cfg) return { sent: 0, skipped: 'not_configured' as const };
  const d = await db();
  const due = (await d.query<{ id: string; user_id: string; kind: string; text: string; group_id: string; group_name: string; invite: string; question_id: string | null; round_id: string | null }>(
    `UPDATE notifications n SET push_status='sending' FROM groups g WHERE n.id IN (SELECT id FROM notifications WHERE push_status='queued' AND created_at>$1 ORDER BY created_at LIMIT 100) AND g.id=n.group_id
     RETURNING n.id,n.user_id,n.kind,n.text,n.group_id,g.name group_name,g.invite,n.question_id,n.round_id`, [new Date(now.getTime() - MAX_AGE)])).rows;
  await d.query("UPDATE notifications SET push_status='expired' WHERE push_status='queued' AND created_at<=$1", [new Date(now.getTime() - MAX_AGE)]);
  let sent = 0;
  for (const n of due) {
    const devices = (await d.query<{ token: string; environment: 'sandbox' | 'production' }>('SELECT token,environment FROM devices WHERE user_id=$1 AND disabled_at IS NULL', [n.user_id])).rows;
    if (!devices.length) { await d.query("UPDATE notifications SET push_status='no_device' WHERE id=$1", [n.id]); continue; }
    let ok = false;
    for (const dev of devices) {
      try {
        const r = await sendAlert(cfg, dev.environment, dev.token, {
          title: TITLES[n.kind] || n.group_name, body: n.text.slice(0, 180), threadId: n.group_id,
          data: { invite: n.invite, ...(n.question_id ? { questionId: n.question_id } : {}), ...(n.round_id ? { roundId: n.round_id } : {}) },
        }, transport, now.getTime());
        if (r.status === 200) ok = true;
        else if (deadToken(r)) await d.query("UPDATE devices SET disabled_at=$2,disabled_reason=$3 WHERE token=$1", [dev.token, now, r.reason || String(r.status)]);
      } catch { /* network error: try other devices; this notification is marked failed below */ }
    }
    await d.query('UPDATE notifications SET push_status=$2 WHERE id=$1', [n.id, ok ? 'sent' : 'failed']);
    if (ok) sent++;
  }
  return { sent };
}
