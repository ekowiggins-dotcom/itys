import Link from "next/link";
import { CallCard } from "./CallCard";
import { PlanNotice } from "./PlanNotice";
import { cardTimes, loadCalls, loadGroup } from "./data";
import type { CallView } from "@/server/call-views";
import { getDb } from "@/server/db";
import { reviewQueue } from "@/server/moderation";

const RESULTS_SHOWN = 20;

/** The Calls tab: what needs you first, then what you're waiting on, then results. */
export default async function CallsTab({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const { user, group } = await loadGroup(id);
  const { calls, sections } = await loadCalls(id);
  const toReview = (await reviewQueue(await getDb(), user)).filter((q) => q.groupId === id);
  const now = new Date();
  const card = (c: CallView, turn = false) => (
    <CallCard key={c.id} call={c} groupId={group.id} times={cardTimes(c, group.timeZone, now)} faces={group.faces} turn={turn} />
  );

  return (
    <>
      <PlanNotice plan={group.plan} place="calls" />
      {toReview.length > 0 && (
        <p className="card banner">
          <strong>{toReview.length === 1 ? "A hidden call needs" : `${toReview.length} hidden calls need`} your review.</strong>{" "}
          <Link href="/review">Review now →</Link>
        </p>
      )}

      {calls.length === 0 && (
        <div className="empty">
          <span className="art" aria-hidden="true">
            🔮
          </span>
          <p>
            <strong>No calls yet.</strong>
            <br />
            Tap <strong>+ New</strong> and make the first one. Who&apos;ll be late? Who&apos;ll cook? Will it rain?
          </p>
        </div>
      )}

      {sections.turn.length > 0 && (
        <section id="turn">
          <h2 className="section-title">
            Your turn <span className="count">{sections.turn.length}</span>
          </h2>
          {sections.turn.map((c) => card(c, true))}
        </section>
      )}

      {sections.waiting.length > 0 && (
        <section>
          <h2 className="section-title">You’re in</h2>
          {sections.waiting.map((c) => card(c))}
        </section>
      )}

      {sections.results.length > 0 && (
        <section>
          <h2 className="section-title">Results</h2>
          {sections.results.slice(0, RESULTS_SHOWN).map((c) => card(c))}
        </section>
      )}
    </>
  );
}
