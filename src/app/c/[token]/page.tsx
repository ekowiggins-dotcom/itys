import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { joinWithCallAction } from "../../actions";
import { Avatar } from "../../components/Avatar";
import { AppleButton } from "../../login/AppleButton";
import { ActionForm, Submit } from "../../ui";
import { callInvitePreview, type CallInvitePreview } from "@/server/call-invites";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { clientIp, currentUser } from "@/server/session";
import { pickersLine } from "@/lib/invite-text";

export async function generateMetadata({ params }: PageProps<"/c/[token]">): Promise<Metadata> {
  const { token } = await params;
  let p: CallInvitePreview | null = null;
  try {
    p = await callInvitePreview(await getDb(), token, null, null);
  } catch {
    // fall back to the plain title
  }
  if (!p) return { title: "Who’ll", robots: { index: false } };
  const description = `${pickersLine(p.pickers)} Join ${p.groupName} on Who’ll and make yours. Free, no money.`;
  return {
    title: p.text,
    description,
    robots: { index: false },
    openGraph: { title: p.text, description, type: "website" },
    twitter: { card: "summary_large_image", title: p.text, description },
  };
}

/**
 * A call shared outside the group. The friend sees it, taps a pick (kept in the URL), signs in, and joins the
 * group with that pick in. Nothing is saved until they press Join.
 */
export default async function CallInvite({ params, searchParams }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const { pick: rawPick } = await searchParams;
  const user = await currentUser();
  let p: CallInvitePreview | null;
  try {
    p = await callInvitePreview(await getDb(), token, await clientIp(), user);
  } catch (e) {
    if (e instanceof AppError && e.code === "rate_limited") return <p className="error">{e.message}</p>;
    throw e;
  }
  if (!p) {
    return (
      <>
        <h1>This invite has closed</h1>
        <p className="muted">
          Picks for this call are closed, or it was taken down. Ask your friend for the group&apos;s invite link.
        </p>
        <p>
          <Link href="/">What is Who&apos;ll?</Link>
        </p>
      </>
    );
  }
  if (p.alreadyMember) redirect(`/groups/${p.groupId}`);

  const chosen = p.options.find((o) => o.key === rawPick) ?? null;
  const here = `/c/${token}${chosen ? `?pick=${encodeURIComponent(chosen.key)}` : ""}`;
  const ready = !!chosen || p.isAboutViewer;
  const pickHref = (key: string) => `/c/${token}?pick=${encodeURIComponent(key)}`;

  return (
    <>
      <p className="muted">
        {p.sharerName} invited you to <strong>{p.groupName}</strong> · {p.memberCount}{" "}
        {p.memberCount === 1 ? "person" : "people"}
      </p>
      <div className="card call" style={{ "--group": p.color } as React.CSSProperties}>
        <p className="call-text">{p.text}</p>
        <p className="muted small">{pickersLine(p.pickers)}</p>
        {p.isAboutViewer ? (
          <p className="muted small">This one is about you, so you don&apos;t pick. Join to see how it turns out.</p>
        ) : p.kind === "member" ? (
          <div className="people-options">
            {p.options.map((o) => (
              <Link
                key={o.key}
                href={pickHref(o.key)}
                replace
                scroll={false}
                className={`person${chosen?.key === o.key ? " mine" : ""}`}
                aria-current={chosen?.key === o.key}
              >
                <Avatar name={o.label} color={p.faces[o.key]} size={52} />
                <span>{o.label}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="options">
            {p.options.map((o) => (
              <Link
                key={o.key}
                href={pickHref(o.key)}
                replace
                scroll={false}
                className={`option${chosen?.key === o.key ? " mine" : ""}`}
                aria-current={chosen?.key === o.key}
              >
                <span className="option-label">
                  {o.label}
                  {chosen?.key === o.key ? " ✓" : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!ready ? (
        <p className="muted small">Tap your pick. Nobody sees it until picks close.</p>
      ) : p.full ? (
        <p className="error">This group is full.</p>
      ) : p.needsPro ? (
        <p className="card banner">
          <strong>{p.groupName} is full for now.</strong> It has as many people as a free group can have. Whoever made it can
          make room for more with Who’ll Pro. Ask {p.sharerName}, then open this link again.
        </p>
      ) : !user ? (
        <div className="stack">
          <p className="muted small">
            {chosen ? `Your pick: ${chosen.label}. ` : ""}Sign in to join {p.groupName} and lock it in.
          </p>
          <AppleButton next={here} servicesId={process.env.APPLE_SERVICES_ID || null} />
          <Link href={`/login?next=${encodeURIComponent(here)}`} className="small">
            Other ways to sign in
          </Link>
        </div>
      ) : !user.name ? (
        <Link href={`/welcome?next=${encodeURIComponent(here)}`}>
          <button type="button">Continue</button>
        </Link>
      ) : (
        <div className="card">
          <ActionForm action={joinWithCallAction}>
            <input type="hidden" name="token" value={token} />
            {chosen && <input type="hidden" name="option" value={chosen.key} />}
            <label htmlFor="displayName">Your name in {p.groupName}</label>
            <input id="displayName" type="text" name="displayName" defaultValue={user.name} required maxLength={30} />
            <Submit>{chosen ? `Join and lock in ${chosen.label}` : `Join ${p.groupName}`}</Submit>
          </ActionForm>
        </div>
      )}
      <p className="muted small">Free points, only for being right. No money, no prizes, just bragging rights.</p>
    </>
  );
}
