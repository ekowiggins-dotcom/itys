"use client";

import { useActionState } from "react";
import { callAction } from "../../actions";
import type { CallView } from "@/server/call-views";

const VOID = "void";

type Times = { lock: string; event: string; openToAll: string; disputeEnds: string | null; voteCloses: string | null };

export function CallCard({ call, groupId, times }: { call: CallView; groupId: string; times: Times }) {
  const [state, action, pending] = useActionState(callAction, undefined);
  const total = call.split ? Object.values(call.split).reduce((a, b) => a + b, 0) : 0;
  const labelOf = (key: string | null) =>
    key === VOID ? "Called off (didn't happen or unclear)" : (call.options.find((o) => o.key === key)?.label ?? "");

  const hidden = (
    <>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="callId" value={call.id} />
    </>
  );

  /** A row of answer buttons for settling, disputing or voting. */
  const answerButtons = (op: "settle" | "dispute" | "vote", exclude?: string | null) => (
    <form action={action} className="options compact">
      {hidden}
      <input type="hidden" name="op" value={op} />
      {[...call.options, { key: VOID, label: "Call it off" }]
        .filter((o) => o.key !== exclude)
        .map((o) => (
          <button key={o.key} type="submit" name="option" value={o.key} disabled={pending} className="option" aria-label={o.label}>
            <span className="option-label">{o.label}</span>
          </button>
        ))}
    </form>
  );

  return (
    <div id={`call-${call.id}`} className={`card call status-${call.status}`}>
      <p className="call-text">{call.text}</p>
      <p className="muted small">
        by {call.author}
        {call.subject ? ` · about ${call.isAboutMe ? "you" : call.subject}` : ""}
        {" · "}
        {call.locked ? `picks closed ${times.lock}` : `picks close ${times.lock}`}
      </p>

      <form action={action} className="options">
        {hidden}
        <input type="hidden" name="op" value="pick" />
        {call.options.map((o) => {
          const n = call.split?.[o.key] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const mine = call.myPick === o.key;
          const correct = call.result === o.key;
          return (
            <button
              key={o.key}
              type="submit"
              name="option"
              value={o.key}
              disabled={!call.canPick || pending}
              className={`option${mine ? " mine" : ""}${correct ? " correct" : ""}`}
              aria-pressed={mine}
              aria-label={`${o.label}${call.split ? `, ${pct}%` : ""}${mine ? ", your pick" : ""}${correct ? ", correct answer" : ""}`}
            >
              {call.split && <span className="bar" style={{ width: `${pct}%` }} />}
              <span className="option-label">
                {correct ? "🏆 " : ""}
                {o.label}
                {mine ? " ✓" : ""}
                {call.whoPicked?.[o.key] && <span className="who"> · {call.whoPicked[o.key].join(", ")}</span>}
              </span>
              {call.split && <span className="pct">{pct}%</span>}
            </button>
          );
        })}
      </form>

      <p className="muted small">
        {call.isAboutMe ? "This call is about you, so you can't pick. " : ""}
        {call.pickCount !== null && `${call.pickCount} of ${call.eligibleCount} picked`}
        {!call.locked && call.pickCount !== null && " · the split shows when picks close"}
      </p>

      {/* Waiting for the event */}
      {call.status === "active" && call.locked && !call.awaitingResult && (
        <p className="small">
          Result expected {times.event}
          {call.settler ? ` · ${call.isSettler ? "you'll" : `${call.settler} will`} enter it` : ""}
        </p>
      )}

      {/* Entering the result */}
      {call.awaitingResult && (
        <div className="phase">
          {call.canSettle ? (
            <>
              <p className="small">
                <strong>What happened?</strong>{" "}
                {call.isSettler ? "You're the settler for this call." : "The settler hasn't entered a result, so anyone can."}
              </p>
              {answerButtons("settle")}
            </>
          ) : (
            <p className="small">
              Waiting for {call.settler ?? "someone"} to enter the result. Anyone can from {times.openToAll}.
            </p>
          )}
        </div>
      )}

      {/* Result entered, open to dispute */}
      {call.status === "proposed" && (
        <div className="phase">
          <p className="small">
            <strong>{call.proposedBy}</strong> says: <strong>{labelOf(call.proposedResult)}</strong>. Final{" "}
            {times.disputeEnds} unless someone disputes.
          </p>
          {call.canDispute && (
            <details>
              <summary className="small">Think that&apos;s wrong? Dispute it</summary>
              <p className="small muted">Pick the right answer. Everyone who picked gets a vote.</p>
              {answerButtons("dispute", call.proposedResult)}
            </details>
          )}
        </div>
      )}

      {/* Group vote */}
      {call.status === "disputed" && (
        <div className="phase">
          <p className="small">
            <strong>{call.disputedBy}</strong> disputed <strong>{call.proposedBy}</strong>&apos;s answer (
            {labelOf(call.proposedResult)}). Group vote until {times.voteCloses} · {call.votesCast} of {call.eligibleVoters} voted.
          </p>
          {call.myVote && <p className="small muted">You voted: {labelOf(call.myVote)}</p>}
          {call.canVote && (
            <>
              <p className="small">What really happened?</p>
              {answerButtons("vote")}
            </>
          )}
          <p className="small muted">More than half the votes decides it. A tie calls it off: nobody scores.</p>
        </div>
      )}

      {/* Final */}
      {call.status === "settled" && (
        <p className="small">
          <span className="ok">Settled: {labelOf(call.result)}</span>
          {" · "}
          {call.counted ? (
            <>
              {call.myPoints !== null && <strong>{call.myPoints > 0 ? `+${call.myPoints}` : "0"} for you · </strong>}
              {call.rightCount} of {call.pickCount} called it
            </>
          ) : (
            <span className="muted">didn&apos;t count for points (fewer than 2 picks)</span>
          )}
        </p>
      )}
      {call.status === "void" && (
        <p className="small muted">
          Called off: nobody scores.{" "}
          {call.voidReason === "not settled in time" ? "Nobody entered a result within 7 days." : ""}
          {call.voidReason === "vote" ? "The group vote didn't reach a majority." : ""}
        </p>
      )}
      {call.voteTally && (
        <p className="small muted">
          Vote:{" "}
          {Object.entries(call.voteTally)
            .map(([k, n]) => `${labelOf(k)} ${n}`)
            .join(" · ")}
        </p>
      )}

      {(call.canPick && call.myPick) || call.canCancel ? (
        <form action={action} className="row">
          {hidden}
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
      {call.canHide && (
        <form action={action} className="row">
          {hidden}
          <button type="submit" name="op" value="hide" className="link" disabled={pending}>
            This is about me: hide it
          </button>
        </form>
      )}
      {call.canReport && (
        <details className="report">
          <summary className="small muted">Report</summary>
          <form action={action} className="row">
            {hidden}
            <input type="hidden" name="op" value="report" />
            <select name="reason" defaultValue="hurtful" aria-label="Reason">
              <option value="hurtful">Hurtful or mean</option>
              <option value="private">Too personal or private</option>
              <option value="spam">Spam</option>
              <option value="other">Something else</option>
            </select>
            <button type="submit" className="secondary" disabled={pending}>
              Report
            </button>
          </form>
        </details>
      )}
      {state?.error && (
        <p className="error small" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="ok small">{state.ok}</p>}
    </div>
  );
}
