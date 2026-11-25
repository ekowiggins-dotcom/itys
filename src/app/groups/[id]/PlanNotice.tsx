import Link from "next/link";
import type { GroupView } from "@/server/groups";

/**
 * Why a group can't take new calls or people, and what to do: shown on the Calls and Group tabs.
 * The payer (who made the group) sees how to get or renew Who'll Pro; everyone else sees who can.
 */
export function PlanNotice({ plan, place }: { plan: GroupView["plan"]; place: "calls" | "group" }) {
  if (plan.frozen) {
    return (
      <div className="card banner" role="status">
        <p style={{ margin: 0 }}>
          <strong>{plan.payerIsMe ? "Paused until you renew Who’ll Pro." : `Paused until ${plan.payerName ?? "the admin"} renews Who’ll Pro.`}</strong>{" "}
          This group has {plan.memberCount} people and free groups have up to {plan.freeMembers}. Open calls carry on as usual;
          new calls and new people wait until then. Nobody is removed and nothing is deleted.
        </p>
        {plan.payerIsMe && (
          <p style={{ marginBottom: 0 }}>
            <Link href="/settings/subscription">Renew Who’ll Pro →</Link>
          </p>
        )}
      </div>
    );
  }
  if (place === "group" && !plan.canAddMember && !plan.payerHasPro) {
    return (
      <div className="card banner" role="status">
        <p style={{ margin: 0 }}>
          <strong>Free groups have up to {plan.freeMembers} people.</strong>{" "}
          {plan.payerIsMe
            ? "Who’ll Pro lets every group you made have up to 20. Everyone else stays free."
            : `${plan.payerName ?? "The admin"} can make room for more with Who’ll Pro.`}
        </p>
        {plan.payerIsMe && (
          <p style={{ marginBottom: 0 }}>
            <Link href="/settings/subscription">Get Who’ll Pro →</Link>
          </p>
        )}
      </div>
    );
  }
  return null;
}
