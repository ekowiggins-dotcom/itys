import type { RankingRow } from "@/server/rankings";
import { Avatar } from "../../components/Avatar";

export function RankingTable({
  rows,
  me,
  limit,
  faces = {},
}: {
  rows: RankingRow[];
  me: string;
  limit?: number;
  faces?: Record<string, string>;
}) {
  const ranked = rows.filter((r) => r.rank !== null);
  const shown = limit ? ranked.slice(0, limit) : rows;
  if (ranked.length === 0 && limit) return <p className="muted small">No settled calls yet this week.</p>;
  return (
    <table className="ranking">
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th title="Average points per call picked">Avg</th>
          <th title="Right calls / calls picked">Right</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.userId} className={r.userId === me ? "me" : undefined}>
            <td>{r.rank === 1 ? "🏆" : (r.rank ?? "–")}</td>
            <td>
              <span className="person-line">
                <Avatar name={r.name} color={faces[r.userId]} size={28} me={r.userId === me} />
                {r.name}
              </span>
              {r.rank === null && r.eligible > 0 && (
                <span className="muted small"> · {r.needed} more {r.needed === 1 ? "pick" : "picks"} to rank</span>
              )}
            </td>
            <td>{r.picked ? r.average : "–"}</td>
            <td>
              {r.correct}/{r.picked}
            </td>
            <td>{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
