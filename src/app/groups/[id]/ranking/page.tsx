import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingTable } from "../RankingTable";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { groupForMember } from "@/server/groups";
import { rankingFor, type Period } from "@/server/rankings";
import { requireUser } from "@/server/session";

const PERIODS: { key: Period; label: string }[] = [
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "all-time", label: "All time" },
];

export default async function RankingPage({ params, searchParams }: PageProps<"/groups/[id]/ranking">) {
  const { id } = await params;
  const { period: raw } = await searchParams;
  const period = PERIODS.find((p) => p.key === raw)?.key ?? "this-week";
  const user = await requireUser(`/groups/${id}/ranking`);
  const db = await getDb();
  let group, ranking;
  try {
    group = await groupForMember(db, user, id);
    ranking = await rankingFor(db, user, id, period);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: group.timeZone, day: "numeric", month: "short" });

  return (
    <>
      <p>
        <Link href={`/groups/${id}`}>← {group.name}</Link>
      </p>
      <h1>Ranking</h1>
      <nav className="tabs">
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/groups/${id}/ranking?period=${p.key}`} className={p.key === period ? "tab active" : "tab"}>
            {p.label}
          </Link>
        ))}
      </nav>
      {ranking.from && ranking.to && (
        <p className="muted small">
          {fmt.format(ranking.from)} – {fmt.format(new Date(ranking.to.getTime() - 1))} · {ranking.calls}{" "}
          {ranking.calls === 1 ? "call" : "calls"} settled
        </p>
      )}
      <div className="card">
        <RankingTable rows={ranking.rows} me={user.id} faces={group.faces} />
      </div>
      <h2>How it works</h2>
      <ul className="small muted">
        <li>A right call scores 10 to 40 points: the fewer friends who saw it coming, the more it&apos;s worth.</li>
        <li>A wrong call scores 0. Called-off calls, and calls fewer than 2 people picked on, don&apos;t count.</li>
        <li>You&apos;re ranked by average points per call you picked on, so picking everything doesn&apos;t help.</li>
        <li>
          To be ranked, pick on at least 60% of the calls you could have{period === "all-time" ? " (and at least 5)" : ""}.
          Calls about you don&apos;t count.
        </li>
        <li>Points are just for fun. They can&apos;t be bought, traded or cashed out.</li>
      </ul>
    </>
  );
}
