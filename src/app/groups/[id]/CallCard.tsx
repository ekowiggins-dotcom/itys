"use client";

import { useActionState, useState } from "react";
import { callAction } from "../../actions";
import { ShareLink } from "../../ui";
import { Avatar } from "../../components/Avatar";
import { Chip } from "../../components/Chip";
import { Toast } from "../../components/Toast";
import { Sheet } from "../../components/Sheet";
import { CalledItStamp } from "../../components/Stamp";
import { Celebrate } from "../../components/Celebrate";
import { haptic } from "../../NativeBridge";
import type { CallView } from "@/server/call-views";

const VOID = "void";

type Times = {
  lock: string;
  event: string;
  openToAll: string;
  disputeEnds: string | null;
  voteCloses: string | null;
  lockUrgency: "soon" | "later" | "past";
  lockCountdown: string;
  settledStamp: string | null;
};

/** The chip at the top of a card: what stage the call is in and the next time that matters. */
function stageChip(call: CallView, t: Times): { text: string; tone?: "soon" | "later" | "done" | "past" } {
  // Things you need to do come first.
  if (call.canSettle) return { text: "Your turn to settle", tone: "soon" };
  if (call.canVote) return { text: `Vote until ${t.voteCloses}`, tone: "soon" };
  if (call.canDispute) return { text: `Check by ${t.disputeEnds}`, tone: "later" };
  if (call.canPick && !call.myPick) return { text: `Pick by ${t.lock}`, tone: t.lockUrgency };
  if (call.status === "settled") return { text: "Settled", tone: "done" };
  if (call.status === "void") return { text: "Called off" };
  if (call.status === "disputed") return { text: `Vote until ${t.voteCloses}`, tone: "soon" };
  if (call.status === "proposed") return { text: `Final ${t.disputeEnds}`, tone: "later" };
  if (!call.locked) return { text: `Picks close ${t.lock}`, tone: t.lockUrgency };
  if (call.awaitingResult) return { text: "Waiting for the result", tone: "soon" };
  return { text: `Result ${t.event}` };
}

export function CallCard({
  call,
  groupId,
  times,
  faces,
  turn = false,
}: {
  call: CallView;
  groupId: string;
  times: Times;
  /** Face colour per user id. */
  faces: Record<string, string>;
  /** Highlight as the thing to do next. */
  turn?: boolean;
}) {
  const [state, action, pending] = useActionState(callAction, undefined);
  const chip = stageChip(call, times);
  const won = call.status === "settled" && !!call.counted && (call.myPoints ?? 0) > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const hasMenu = (call.canPick && !!call.myPick) || call.canCancel || call.canShare || call.canHide || call.canReport;
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
    <div id={`call-${call.id}`} className={`card call status-${call.status}${turn ? " turn" : ""}`}>
      <div className="call-head">
        <Chip tone={chip.tone}>{chip.text}</Chip>
        <span className="person-line small muted">
          by {call.author}
          <Avatar name={call.author} color={call.authorId ? faces[call.authorId] : undefined} size={24} />
          {hasMenu && (
            <button type="button" className="icon-button" aria-label="More options" onClick={() => setMenuOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          )}
        </span>
      </div>
      {hasMenu && (
        <Sheet title="Call options" open={menuOpen} onClose={() => setMenuOpen(false)}>
          <div className="menu" onSubmit={() => setMenuOpen(false)}>
            {call.canShare && (
              <form action={action}>
                {hidden}
                <button type="submit" name="op" value="share" className="menu-item">
                  Share result
                </button>
              </form>
            )}
            {call.canPick && call.myPick && (
              <form action={action}>
                {hidden}
                <button type="submit" name="op" value="unpick" className="menu-item">
                  Take back my pick
                </button>
              </form>
            )}
            {call.canHide && (
              <form action={action}>
                {hidden}
                <button type="submit" name="op" value="hide" className="menu-item">
                  This is about me: hide it
                  <span className="small muted">Nobody sees it while it&apos;s reviewed.</span>
                </button>
              </form>
            )}
            {call.canCancel && (
              <form action={action}>
                {hidden}
                <button
                  type="submit"
                  name="op"
                  value="cancel"
                  className="menu-item danger"
                  onClick={(e) => {
                    if (!confirm("Cancel this call for everyone? Picks on it are dropped.")) e.preventDefault();
                  }}
                >
                  Cancel call
                </button>
              </form>
            )}
            {call.canReport && (
              <form action={action} className="stack report-form">
                {hidden}
                <input type="hidden" name="op" value="report" />
                <span className="label">Report this call</span>
                {[
                  ["hurtful", "Hurtful or mean"],
                  ["private", "Too personal or private"],
                  ["spam", "Spam"],
                  ["other", "Something else"],
                ].map(([v, l], i) => (
                  <label key={v} className="row check">
                    <input type="radio" name="reason" value={v} defaultChecked={i === 0} />
                    {l}
                  </label>
                ))}
                <button type="submit" className="secondary">
                  Report
                </button>
                <span className="small muted">Two reports hide a call until it&apos;s reviewed.</span>
              </form>
            )}
          </div>
        </Sheet>
      )}
      <p className="call-text">{call.text}</p>
      {call.subject && <p className="muted small">About {call.isAboutMe ? "you" : call.subject}</p>}

      {call.kind === "member" ? (
        <form action={action} className="people-options" onSubmit={() => void haptic("light")}>
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
                className={`person${mine ? " mine" : ""}${correct ? " correct" : ""}`}
                aria-pressed={mine}
                aria-label={`${o.label}${call.split ? `, ${pct}%` : ""}${mine ? ", your pick" : ""}${correct ? ", correct answer" : ""}`}
              >
                <Avatar name={o.label} color={faces[o.key]} size={52} />
                <span>
                  {correct ? "🏆 " : ""}
                  {o.label}
                </span>
                {call.split && <span className="pct">{pct}%</span>}
              </button>
            );
          })}
        </form>
      ) : (
      <form action={action} className="options" onSubmit={() => void haptic("light")}>
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
      )}
      {call.kind === "member" && call.whoPicked && (
        <p className="small muted">
          {Object.entries(call.whoPicked)
            .map(([k, names]) => `${names.join(", ")} → ${call.options.find((o) => o.key === k)?.label ?? ""}`)
            .join(" · ")}
        </p>
      )}

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
            <Sheet
              title="What really happened?"
              open={disputeOpen}
              onClose={() => setDisputeOpen(false)}
              trigger={() => (
                <button type="button" className="secondary" onClick={() => setDisputeOpen(true)}>
                  That&apos;s wrong: dispute it
                </button>
              )}
            >
              <p className="small muted">
                Pick the right answer. Everyone who picked gets a vote, and more than half decides. A tie calls it off.
              </p>
              <div onSubmit={() => setDisputeOpen(false)}>{answerButtons("dispute", call.proposedResult)}</div>
            </Sheet>
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
        <div className="phase result-row">
          {won && <CalledItStamp points={call.myPoints!} date={times.settledStamp ?? ""} size={96} />}
          <p className="small result-text">
            <span className="ok">Settled: {labelOf(call.result)}</span>
            <br />
            {call.counted ? (
              <>
                {won ? (
                  <strong>You called it! +{call.myPoints}</strong>
                ) : call.myPick ? (
                  <span>Not this time.</span>
                ) : null}
                {(won || call.myPick) && <br />}
                <span className="muted">
                  {call.rightCount} of {call.pickCount} called it
                </span>
              </>
            ) : (
              <span className="muted">Didn&apos;t count for points (fewer than 2 picks).</span>
            )}
          </p>
          {won && <Celebrate id={call.id} />}
        </div>
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

      {call.canShare && (
        <form action={action} className="row">
          {hidden}
          <button type="submit" name="op" value="share" className="secondary" disabled={pending}>
            Share result
          </button>
        </form>
      )}
      {state?.shareUrl && <ShareLink url={state.shareUrl} text={call.text} />}
      {state?.error && (
        <p className="error small" role="alert">
          {state.error}
        </p>
      )}
      <Toast message={state?.ok} />
    </div>
  );
}
