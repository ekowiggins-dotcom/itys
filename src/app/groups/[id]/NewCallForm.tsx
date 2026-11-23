"use client";

import { useActionState, useRef, useState } from "react";
import { createCallAction } from "../../actions";
import { Submit } from "../../ui";

type Member = { userId: string; displayName: string };

/** datetime-local works in the browser's local time; we send UTC ISO strings to the server. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

export function NewCallForm({ groupId, members }: { groupId: string; members: Member[] }) {
  const [state, action] = useActionState(createCallAction, undefined);
  const [kind, setKind] = useState<"yes_no" | "choice" | "member">("yes_no");
  const [defaults] = useState(() => {
    const lock = new Date(Date.now() + 86400_000);
    lock.setMinutes(0, 0, 0);
    return { lock: toLocalInput(lock), min: toLocalInput(new Date(Date.now() + 3600_000)) };
  });
  const [lockLocal, setLockLocal] = useState(defaults.lock);
  const [eventLocal, setEventLocal] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="stack">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="lockAt" value={toIso(lockLocal)} />
      <input type="hidden" name="eventAt" value={toIso(eventLocal || lockLocal)} />

      <label htmlFor="text">Your call</label>
      <input id="text" type="text" name="text" required minLength={5} maxLength={200} placeholder="Will Cem make it to the gym this week?" />

      <label htmlFor="kind">Answers</label>
      <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="yes_no">Yes / No</option>
        <option value="choice">Options I write</option>
        <option value="member">Someone in the group</option>
      </select>

      {kind === "choice" && (
        <div className="stack">
          {[1, 2, 3, 4].map((i) => (
            <input key={i} type="text" name="option" maxLength={40} placeholder={i <= 2 ? `Option ${i}` : `Option ${i} (optional)`} required={i <= 2} />
          ))}
        </div>
      )}

      <label htmlFor="subjectId">About someone? (they can&apos;t pick)</label>
      <select id="subjectId" name="subjectId" defaultValue="">
        <option value="">Nobody in particular</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.displayName}
          </option>
        ))}
      </select>

      <label htmlFor="lock">Picks close</label>
      <input id="lock" type="datetime-local" value={lockLocal} min={defaults.min} onChange={(e) => setLockLocal(e.target.value)} required />

      <label htmlFor="event">Result known (optional, defaults to when picks close)</label>
      <input id="event" type="datetime-local" value={eventLocal} min={lockLocal} onChange={(e) => setEventLocal(e.target.value)} />

      <Submit>Post call</Submit>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="ok">{state.ok}</p>}
    </form>
  );
}
