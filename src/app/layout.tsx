import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { currentUser } from "@/server/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Who’ll",
  description: "Friendly predictions with your friends. Free points, no money, just bragging rights.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17201b" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href={user ? "/groups" : "/"} className="brand">
            Who’ll
          </Link>
          {user && (
            <Link href="/settings" className="muted">
              {user.name ?? user.email}
            </Link>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
