"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Sheet } from "../../components/Sheet";
import { Toast } from "../../components/Toast";
import { NewCallForm } from "./NewCallForm";
import { haptic } from "../../NativeBridge";

const icons = {
  calls: (
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  ),
  ranking: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  group: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

/** Bottom tab bar (Calls / Ranking / Group) and the floating "+ New" button with its sheet. */
export function GroupChrome({
  groupId,
  members,
  faces,
  turnCount,
}: {
  groupId: string;
  members: { userId: string; displayName: string }[];
  faces: Record<string, string>;
  turnCount: number;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const base = `/groups/${groupId}`;
  const tabs = [
    { href: base, label: "Calls", icon: "calls" as const, active: path === base, badge: turnCount },
    { href: `${base}/ranking`, label: "Ranking", icon: "ranking" as const, active: path.startsWith(`${base}/ranking`) },
    { href: `${base}/group`, label: "Group", icon: "group" as const, active: path.startsWith(`${base}/group`) },
  ];
  const done = useCallback((message: string) => {
    setOpen(false);
    setToast(message);
    void haptic("success");
  }, []);

  return (
    <>
      {path === base && (
      <button type="button" className="fab" onClick={() => setOpen(true)} aria-label="New call">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New
      </button>
      )}
      <Sheet title="New call" open={open} onClose={() => setOpen(false)}>
        <NewCallForm groupId={groupId} members={members} faces={faces} onDone={done} />
      </Sheet>
      <Toast message={toast} />
      <nav className="tabbar" aria-label="Group sections">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`tabbar-item${t.active ? " active" : ""}`} aria-current={t.active ? "page" : undefined}>
            <span className="tabbar-icon">
              <Icon name={t.icon} />
              {t.badge ? <span className="badge">{t.badge}</span> : null}
            </span>
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
