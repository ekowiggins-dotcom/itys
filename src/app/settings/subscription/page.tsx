import type { Metadata } from "next";
import Link from "next/link";
import { ProOffer } from "./ProOffer";
import { getDb } from "@/server/db";
import { myGroups } from "@/server/groups";
import { requireUser } from "@/server/session";
import { FREE_MEMBERS, groupPlan, MAX_WITH_PRO, proProductIds, proStatus } from "@/server/subscriptions";

export const metadata: Metadata = { title: "Who’ll Pro · Who’ll" };

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);

/** Settings → Who'll Pro: what it does, where your subscription stands, and buying, restoring or managing it. */
export default async function Subscription() {
  const user = await requireUser("/settings/subscription");
  const db = await getDb();
  const now = new Date();
  const status = await proStatus(db, user.id, now);
  const mine = [];
  for (const g of await myGroups(db, user)) {
    const plan = await groupPlan(db, g.id, now);
    if (plan.payerId === user.id && plan.memberCount > plan.freeMembers - 1) mine.push({ ...g, plan });
  }
  const paused = mine.filter((g) => g.plan.frozen);

  return (
    <>
      <p>
        <Link href="/settings">← Settings</Link>
      </p>
      <h1>Who’ll Pro</h1>
      <p>
        Free groups have up to {FREE_MEMBERS} people. With Pro, every group you made can have up to {MAX_WITH_PRO}. One subscription
        covers all of them, and everyone in them plays free. Points stay free and are only for being right.
      </p>

      <div className="card stack">
        {status.active ? (
          <p>
            <strong>Pro is on.</strong>{" "}
            {status.graceUntil
              ? `Apple couldn’t take your last payment and is trying again until ${day(status.graceUntil)}. Check your payment method in your iPhone’s Settings.`
              : status.inTrial
                ? `Your free week ends on ${day(status.expiresAt!)}${status.autoRenew ? ", then it renews" : " and it won’t renew"}.`
                : status.autoRenew
                  ? `It renews on ${day(status.expiresAt!)}.`
                  : `It ends on ${day(status.expiresAt!)} and won’t renew.`}
          </p>
        ) : status.expiresAt ? (
          <p>
            <strong>Your Pro {status.revoked ? "was refunded" : `ended on ${day(status.expiresAt)}`}.</strong>{" "}
            {paused.length > 0 ? "Your bigger groups are paused until you subscribe again." : "You can subscribe again any time."}
          </p>
        ) : (
          <p>
            <strong>You don’t have Pro.</strong>
          </p>
        )}
        {paused.length > 0 && (
          <p className="small">
            Paused: {paused.map((g) => g.name).join(", ")}. Open calls carry on, but nobody can make new calls or join
            until you renew. Nothing is deleted.
          </p>
        )}
        <ProOffer userId={user.id} productIds={proProductIds()} active={status.active} />
      </div>
    </>
  );
}
