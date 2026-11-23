import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { Avatar } from "./components/Avatar";
import { NativeBridge } from "./NativeBridge";
import { getDb } from "@/server/db";
import { unreadCount } from "@/server/notifications";
import { currentUser } from "@/server/session";
import "./globals.css";

// Self-hosted at build time (no requests to Google from users' browsers). latin-ext covers Turkish letters.
const display = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["500", "700"], variable: "--font-space-grotesk" });
const body = DM_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  // Absolute URLs for share images. Production sets APP_ORIGIN (never derived from the request's Host header).
  metadataBase: new URL(process.env.APP_ORIGIN ?? "http://localhost:3000"),
  title: "Who’ll",
  description: "Friendly predictions with your friends. Free points, no money, just bragging rights.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#111613" },
  ],
};

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  const unread = user ? await unreadCount(await getDb(), user) : 0;
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="top">
          <Link href={user ? "/groups" : "/"} className="brand" aria-label="Who’ll home">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny SVG, no optimisation needed */}
            <img src="/brand/wordmark.svg" alt="Who’ll" className="on-light" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wordmark-light.svg" alt="" className="on-dark" />
          </Link>
          {user && (
            <nav className="row">
              <Link href="/notifications" className="bell" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                <BellIcon />
                {unread > 0 && <span className="badge">{unread > 99 ? "99+" : unread}</span>}
              </Link>
              <Link href="/settings" aria-label="Settings">
                <Avatar name={user.name ?? user.email} color="var(--lime)" size={40} />
              </Link>
            </nav>
          )}
        </header>
        <main>{children}</main>
        {user && <NativeBridge userId={user.id} />}
      </body>
    </html>
  );
}
