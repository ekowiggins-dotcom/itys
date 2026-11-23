"use client";

import { useActionState } from "react";
import { callAction } from "../../actions";
import type { CallView } from "@/server/calls";

export function CallCard({ call, groupId, times }: { call: CallView; groupId: string; times: { lock: string; event: string } }) {
  const [state, action, pending] = useActionState(callAction, undefined);
  const total = call.split ? Object.values(call.split).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="card call">
      <p className="call-text">{call.text}</p>
      <p className="muted small">
        by {call.author}
        {call.subject ? ` · about ${call.isAboutMe ? "you" : call.subject}` : ""}
        {" · "}
        {call.locked ? `picks closed ${times.lock}` : `picks close ${times.lock}`}
      </p>

      <form action={action} className="options">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="callId" value={call.id} />
        <input type="hidden" name="op" value="pick" />
        {call.options.map((o) => {
          const n = call.split?.[o.key] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const mine = call.myPick === o.key;
          return (
            <button
              key={o.key}
              type="submit"
              name="option"
              value={o.key}
              disabled={!call.canPick || pending}
              className={`option${mine ? " mine" : ""}`}
              aria-pressed={mine}
            >
              {call.split && <span className="bar" style={{ width: `${pct}%` }} />}
              <span className="option-label">
                {o.label}
                {mine ? " ✓" : ""}
              </span>
              {call.split && <span className="pct">{pct}%</span>}
            </button>
          );
        })}
      </form>

      <p className="muted small">
        {call.isAboutMe
          ? "This call is about you, so you can't pick. "
          : ""}
        {call.pickCount !== null && `${call.pickCount} of ${call.eligibleCount} picked`}
        {!call.locked && call.pickCount !== null && " · the split shows when picks close"}
      </p>

      {(call.canPick && call.myPick) || call.canCancel ? (
        <form action={action} className="row">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="callId" value={call.id} />
          {call.canPick && call.myPick && (
            <button type="submit" name="op" value="unpick" className="link" disabled={pending}>
              Take back my pick
            </button>
          )}
          {call.canCancel && (
            <button type="submit" name="op" value="cancel" className="link danger-link" disabled={pending}>
              Cancel call
            </button>
          )}
        </form>
      ) : null}
      {state?.error && (
        <p className="error small" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
