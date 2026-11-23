"use client";

import { useActionState, useEffect, useState } from "react";
import { createCallAction } from "../../actions";
import { Submit } from "../../ui";
import { Avatar } from "../../components/Avatar";

type Member = { userId: string; displayName: string };
type Kind = "yes_no" | "choice" | "member";

/** datetime-local works in the browser's local time; we send UTC ISO strings to the server. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

/** Quick deadlines, in the phone's local time. Only ones at least an hour away are offered. */
function presets(now: Date) {
  const at = (days: number, h: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(h, 0, 0, 0);
    return d;
  };
  const saturday = (6 - now.getDay() + 7) % 7 || 7;
  const list = [
    { label: "Tonight", date: at(0, 21) },
    { label: "Tomorrow", date: at(1, 12) },
    { label: "Weekend", date: at(saturday, 12) },
    { label: "In a week", date: at(7, 12) },
  ];
  return list.filter((p) => p.date.getTime() - now.getTime() >= 3_600_000);
}

const KINDS: { key: Kind; label: string }[] = [
  { key: "yes_no", label: "Yes / No" },
  { key: "member", label: "Someone" },
  { key: "choice", label: "Options" },
];

export function NewCallForm({
  groupId,
  members,
  faces,
  onDone,
}: {
  groupId: string;
  members: Member[];
  faces: Record<string, string>;
  onDone?: (message: string) => void;
}) {
  const [state, action] = useActionState(createCallAction, undefined);
  const [kind, setKind] = useState<Kind>("yes_no");
  const [subject, setSubject] = useState("");
  // "Now" is read once, when the form opens (useState initialisers run once).
  const [{ quick, min }] = useState(() => {
    const now = new Date();
    return { quick: presets(now), min: toLocalInput(new Date(now.getTime() + 3_600_000)) };
  });
  const [lockLocal, setLockLocal] = useState(() => {
    const first = quick.find((p) => p.label === "Tomorrow") ?? quick[0];
    return first ? toLocalInput(first.date) : "";
  });
  const [custom, setCustom] = useState(() => quick.length === 0);
  const [eventLocal, setEventLocal] = useState("");

  useEffect(() => {
    if (state?.ok) onDone?.(state.ok);
  }, [state, onDone]);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subjectId" value={subject} />
      <input type="hidden" name="lockAt" value={toIso(lockLocal)} />
      <input type="hidden" name="eventAt" value={toIso(eventLocal || lockLocal)} />

      <label htmlFor="text">Your call</label>
      <input id="text" type="text" name="text" required minLength={5} maxLength={200} placeholder="Who’ll be late on Saturday?" autoFocus />

      <span className="label">Answers</span>
      <div className="segmented" role="radiogroup" aria-label="Answers">
        {KINDS.map((k) => (
          <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>
      {kind === "member" && <p className="small muted">Everyone in the group is an option (except whoever it&apos;s about).</p>}
      {kind === "choice" && (
        <div className="stack">
          {[1, 2, 3, 4].map((i) => (
            <input key={i} type="text" name="option" maxLength={40} placeholder={i <= 2 ? `Option ${i}` : `Option ${i} (optional)`} required={i <= 2} />
          ))}
        </div>
      )}

      <span className="label">About someone? They can&apos;t pick.</span>
      <div className="people-picker" role="radiogroup" aria-label="About someone">
        <button type="button" role="radio" aria-checked={subject === ""} onClick={() => setSubject("")} className="pill">
          Nobody
        </button>
        {members.map((m) => (
          <button
            key={m.userId}
            type="button"
            role="radio"
            aria-checked={subject === m.userId}
            onClick={() => setSubject(m.userId)}
            className="pill"
          >
            <Avatar name={m.displayName} color={faces[m.userId]} size={22} />
            {m.displayName}
          </button>
        ))}
      </div>

      <span className="label">Picks close</span>
      <div className="people-picker" role="radiogroup" aria-label="Picks close">
        {quick.map((p) => (
          <button
            key={p.label}
            type="button"
            role="radio"
            className="pill"
            aria-checked={!custom && lockLocal === toLocalInput(p.date)}
            onClick={() => {
              setCustom(false);
              setLockLocal(toLocalInput(p.date));
            }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" role="radio" className="pill" aria-checked={custom} onClick={() => setCustom(true)}>
          Pick a time
        </button>
      </div>
      {custom && (
        <input aria-label="Picks close at" type="datetime-local" value={lockLocal} min={min} onChange={(e) => setLockLocal(e.target.value)} required />
      )}

      <details>
        <summary className="small">The result comes later than that?</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <label htmlFor="event">Result known</label>
          <input id="event" type="datetime-local" value={eventLocal} min={lockLocal} onChange={(e) => setEventLocal(e.target.value)} />
        </div>
      </details>

      <Submit>Post call</Submit>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
