import Link from "next/link";
import { Avatar } from "../../../components/Avatar";
import { loadGroup } from "../data";
import { RankingTable } from "../RankingTable";
import { getDb } from "@/server/db";
import { rankingFor, type Period, type RankingRow } from "@/server/rankings";

const PERIODS: { key: Period; label: string }[] = [
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "all-time", label: "All time" },
];

/** First, second and third, as a podium (second on the left, like a real one). */
function Podium({ rows, faces, me }: { rows: RankingRow[]; faces: Record<string, string>; me: string }) {
  const top = rows.filter((r) => r.rank !== null && r.rank <= 3).slice(0, 3);
  if (top.length === 0) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <div className="podium" aria-label="Top three">
      {order.map((r) => (
        <div key={r.userId} className={`podium-step place-${r.rank}`}>
          <Avatar name={r.name} color={faces[r.userId]} size={r.rank === 1 ? 64 : 52} me={r.userId === me} />
          <span className="podium-name">{r.name}</span>
          <span className="podium-score">{r.average} avg</span>
          <span className="podium-block">{r.rank === 1 ? "🏆" : r.rank}</span>
        </div>
      ))}
    </div>
  );
}

/** The Ranking tab. */
export default async function RankingTab({ params, searchParams }: PageProps<"/groups/[id]/ranking">) {
  const { id } = await params;
  const { period: raw } = await searchParams;
  const period = PERIODS.find((p) => p.key === raw)?.key ?? "this-week";
  const { user, group } = await loadGroup(id);
  const db = await getDb();
  const ranking = await rankingFor(db, user, id, period);
  // Last week's winner gets a mention on this week's table.
  const lastWeek = period === "this-week" ? await rankingFor(db, user, id, "last-week") : null;
  const oracle = lastWeek?.rows.find((r) => r.rank === 1);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: group.timeZone, day: "numeric", month: "short" });

  return (
    <>
      <nav className="segmented" aria-label="Period">
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/groups/${id}/ranking?period=${p.key}`} aria-current={p.key === period ? "page" : undefined}>
            {p.label}
          </Link>
        ))}
      </nav>

      {oracle && (
        <p className="card oracle">
          <Avatar name={oracle.name} color={group.faces[oracle.userId]} size={36} />
          <span>
            <strong>{oracle.name}</strong> was last week&apos;s Oracle 🔮
          </span>
        </p>
      )}

      {ranking.calls === 0 ? (
        <div className="empty">
          <span className="art" aria-hidden="true">
            🏆
          </span>
          <p>No settled calls {period === "all-time" ? "yet" : period === "this-week" ? "this week yet" : "last week"}.</p>
        </div>
      ) : (
        <>
          <Podium rows={ranking.rows} faces={group.faces} me={user.id} />
          <div className="card">
            <RankingTable rows={ranking.rows} me={user.id} faces={group.faces} />
          </div>
        </>
      )}
      {ranking.from && ranking.to && (
        <p className="muted small">
          {fmt.format(ranking.from)} – {fmt.format(new Date(ranking.to.getTime() - 1))} · {ranking.calls}{" "}
          {ranking.calls === 1 ? "call" : "calls"} settled
        </p>
      )}

      <details className="card">
        <summary>How points work</summary>
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
      </details>
    </>
  );
}
