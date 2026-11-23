import Link from "next/link";
import { MarkRead } from "./MarkRead";
import { getDb } from "@/server/db";
import { inbox } from "@/server/notifications";
import { requireUser } from "@/server/session";

export default async function Notifications() {
  const user = await requireUser("/notifications");
  const items = await inbox(await getDb(), user);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const newest = items[0]?.createdAt;

  return (
    <>
      <h1>Notifications</h1>
      {items.length === 0 && <p className="muted">Nothing yet. You&apos;ll hear about new calls, results and anything that needs you.</p>}
      <div className="card">
        <ul className="list notifs">
          {items.map((n) => (
            <li key={n.id} className={n.read ? undefined : "unread"}>
              <Link href={n.href}>
                <span>{n.text}</span>
                <span className="muted small">
                  {n.groupName} · {fmt.format(n.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {newest && items.some((n) => !n.read) && <MarkRead upTo={newest.toISOString()} />}
    </>
  );
}
