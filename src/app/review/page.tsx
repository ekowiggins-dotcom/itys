import { reviewAction } from "../actions";
import { ActionForm, Submit } from "../ui";
import { getDb } from "@/server/db";
import { reviewQueue } from "@/server/moderation";
import { requireUser } from "@/server/session";

const REASONS: Record<string, string> = {
  about_me: "the person it's about asked to hide it",
  hurtful: "hurtful or mean",
  private: "too personal",
  spam: "spam",
  other: "something else",
};

export default async function Review() {
  const user = await requireUser("/review");
  const queue = await reviewQueue(await getDb(), user);
  return (
    <>
      <h1>Review</h1>
      <p className="muted">
        These calls are hidden from everyone until you decide. Restore it if it&apos;s harmless fun; remove it if it
        isn&apos;t. Removed calls are called off and nobody scores on them.
      </p>
      {queue.length === 0 && <p className="muted">Nothing to review.</p>}
      {queue.map((q) => (
        <div key={q.callId} className="card stack">
          <p className="call-text">{q.text}</p>
          <p className="muted small">
            {q.groupName} · by {q.author}
            {q.subject ? ` · about ${q.subject}` : ""} · reported: {q.reasons.map((r) => REASONS[r]).join(", ")}
          </p>
          <div className="row">
            <ActionForm action={reviewAction} className="row">
              <input type="hidden" name="callId" value={q.callId} />
              <input type="hidden" name="decision" value="restore" />
              <Submit variant="secondary">Restore</Submit>
            </ActionForm>
            <ActionForm action={reviewAction} className="row">
              <input type="hidden" name="callId" value={q.callId} />
              <input type="hidden" name="decision" value="remove" />
              <Submit variant="danger">Remove</Submit>
            </ActionForm>
          </div>
        </div>
      ))}
    </>
  );
}
