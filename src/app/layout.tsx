import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getDb } from "@/server/db";
import { unreadCount } from "@/server/notifications";
import { currentUser } from "@/server/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Who’ll",
  description: "Friendly predictions with your friends. Free points, no money, just bragging rights.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17201b" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  const unread = user ? await unreadCount(await getDb(), user) : 0;
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href={user ? "/groups" : "/"} className="brand">
            Who’ll
          </Link>
          {user && (
            <nav className="row">
              <Link href="/notifications" className="bell" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                🔔{unread > 0 && <span className="badge">{unread > 99 ? "99+" : unread}</span>}
              </Link>
              <Link href="/settings" className="muted">
                {user.name ?? user.email}
              </Link>
            </nav>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
