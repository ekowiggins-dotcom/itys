import Link from "next/link";
import { Faces } from "../../components/Avatar";
import { GroupChrome } from "./GroupChrome";
import { loadCalls, loadGroup } from "./data";
import { GROUP_COLORS } from "@/lib/faces";
import { countdown } from "@/lib/when";

/** Every group screen: the group header on top, the tab bar and "+ New" at the bottom. */
export default async function GroupLayout({ children, params }: LayoutProps<"/groups/[id]">) {
  const { id } = await params;
  const { group } = await loadGroup(id);
  const { sections, nextLock } = await loadCalls(id);
  const turn = sections.turn.length;
  const tint = GROUP_COLORS[group.color];

  const summary = [
    turn > 0 ? `${turn} ${turn === 1 ? "call needs" : "calls need"} you` : "You’re all caught up",
    nextLock ? `next lock ${countdown(nextLock, new Date())}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="with-tabs">
      <header className="group-hero" style={{ "--tint": tint } as React.CSSProperties}>
        <div className="group-hero-main">
          <Link href="/groups" className="group-hero-back">
            ← Groups
          </Link>
          <h1 className="group-hero-name">
            <span className="swatch" style={{ background: tint }} aria-hidden="true" />
            {group.name}
          </h1>
          <Faces people={group.members.map((m) => ({ name: m.displayName, color: group.faces[m.userId] }))} size={30} max={7} />
          <p className="group-hero-summary">{summary}</p>
        </div>
        {turn > 0 && (
          <a href={`/groups/${group.id}#turn`} className="to-call">
            <strong>{turn}</strong>
            to call
          </a>
        )}
      </header>
      {children}
      <GroupChrome
        groupId={group.id}
        members={group.members.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
        faces={group.faces}
        turnCount={turn}
        paused={group.plan.frozen ? (group.plan.payerIsMe ? "you renew" : `${group.plan.payerName ?? "the admin"} renews`) : null}
      />
    </div>
  );
}
