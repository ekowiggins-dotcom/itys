import type { Metadata } from "next";
import Link from "next/link";
import { resultFor } from "./data";

export async function generateMetadata({ params }: PageProps<"/r/[token]">): Promise<Metadata> {
  const { token } = await params;
  const r = await resultFor(token);
  if (!r) return { title: "Who’ll", robots: { index: false } };
  const title = r.sharerCalledIt ? `${r.sharerName} called it: ${r.answer}` : `${r.text} → ${r.answer}`;
  return {
    title,
    description: `${r.text} · ${r.rightCount} of ${r.pickers} called it. Friendly predictions with friends on Who’ll.`,
    robots: { index: false },
    openGraph: { title, type: "website" },
    twitter: { card: "summary_large_image", title },
  };
}

/** A public, read-only result. Anyone with the link can see it; it shows no names but the sharer's. */
export default async function SharedResult({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const r = await resultFor(token);
  if (!r) {
    return (
      <>
        <h1>Nothing to see here</h1>
        <p className="muted">This link doesn&apos;t exist or was taken down.</p>
        <p>
          <Link href="/">What is Who&apos;ll?</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <p className="muted">{r.sharerCalledIt ? `${r.sharerName} called it 🏆` : `Shared by ${r.sharerName}`}</p>
      <h1>{r.text}</h1>
      <div className="card">
        <p className="call-text">🏆 {r.answer}</p>
        <p className="muted small">
          {r.rightCount} of {r.pickers} called it
          {r.sharerPoints ? ` · +${r.sharerPoints} for ${r.sharerName}` : ""}
        </p>
      </div>
      <p className="muted">
        Who&apos;ll is a game of friendly predictions with your friends. Points are free and only earned by being right.
      </p>
      <p>
        <Link href="/login">
          <button type="button">Start a group</button>
        </Link>
      </p>
    </>
  );
}
