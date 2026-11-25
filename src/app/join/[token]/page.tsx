import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { joinGroupAction } from "../../actions";
import { ActionForm, Submit } from "../../ui";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { invitePreview } from "@/server/groups";
import { GetTheApp } from "../../components/GetTheApp";
import { appOrigin, clientIp, currentUser, isAppRequest } from "@/server/session";
import { appBannerMeta } from "@/lib/app-client";

export async function generateMetadata({ params }: PageProps<"/join/[token]">): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "You're invited to Who’ll",
    description: "Join your friends' group and make your calls. Free points, no money, just bragging rights.",
    robots: { index: false },
    // Safari's app banner: "Open" takes this invite into the app.
    other: appBannerMeta(`${await appOrigin()}/join/${token}`),
  };
}

export default async function Join({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await currentUser();
  let preview;
  try {
    preview = await invitePreview(await getDb(), token, await clientIp(), user);
  } catch (e) {
    if (e instanceof AppError && e.code === "rate_limited") return <p className="error">{e.message}</p>;
    throw e;
  }
  if (!preview) {
    return (
      <>
        <h1>Invite not valid</h1>
        <p className="muted">This link may have been replaced by a newer one. Ask your friend for a fresh link.</p>
      </>
    );
  }
  if (preview.alreadyMember) redirect(`/groups/${preview.groupId}`);

  const here = `/join/${token}`;
  return (
    <>
      <h1>Join {preview.name}?</h1>
      <p className="muted">
        {preview.memberCount} {preview.memberCount === 1 ? "person is" : "people are"} in this group.
      </p>
      {preview.full ? (
        <p className="error">This group is full.</p>
      ) : preview.needsPro ? (
        <p className="card banner">
          <strong>This group is full for now.</strong> It has as many people as a free group can have. Whoever made it can
          make room for more with Who’ll Pro. Ask them, then open this link again.
        </p>
      ) : !user && !(await isAppRequest()) ? (
        <GetTheApp invite />
      ) : !user ? (
        <Link href={`/login?next=${encodeURIComponent(here)}`}>
          <button type="button">Sign in to join</button>
        </Link>
      ) : !user.name ? (
        <Link href={`/welcome?next=${encodeURIComponent(here)}`}>
          <button type="button">Continue</button>
        </Link>
      ) : (
        <div className="card">
          <ActionForm action={joinGroupAction}>
            <input type="hidden" name="token" value={token} />
            <label htmlFor="displayName">Your name in this group</label>
            <input id="displayName" type="text" name="displayName" defaultValue={user.name} required maxLength={30} />
            <Submit>Join group</Submit>
          </ActionForm>
        </div>
      )}
    </>
  );
}
