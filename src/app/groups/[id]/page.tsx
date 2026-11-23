import Link from "next/link";
import { notFound } from "next/navigation";
import { leaveGroupAction, resetInviteAction } from "../../actions";
import { ActionForm, CopyButton, Submit } from "../../ui";
import { CallCard } from "./CallCard";
import { NewCallForm } from "./NewCallForm";
import { RankingTable } from "./RankingTable";
import { MemberRow, RemovedRow } from "./MemberRow";
import { blockedIds, removedMembers, reviewQueue } from "@/server/moderation";
import { rankingFor } from "@/server/rankings";
import { callsForMember, type CallView } from "@/server/call-views";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { groupForMember } from "@/server/groups";
import { appOrigin, requireUser } from "@/server/session";

export default async function Group({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/groups/${id}`);
  let group;
  try {
    group = await groupForMember(await getDb(), user, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
  const callList = await callsForMember(await getDb(), user, id);
  const week = await rankingFor(await getDb(), user, id, "this-week");
  const blocked = await blockedIds(await getDb(), user.id);
  const removed = await removedMembers(await getDb(), user, id);
  const toReview = (await reviewQueue(await getDb(), user)).filter((q) => q.groupId === id);
  const open = callList.filter((c) => !c.locked);
  const needsMe = callList.filter((c) => c.locked && (c.canSettle || c.canDispute || c.canVote));
  const waiting = callList.filter(
    (c) => c.locked && !needsMe.includes(c) && ["active", "proposed", "disputed"].includes(c.status),
  );
  const finished = callList.filter((c) => c.status === "settled" || c.status === "void");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: group.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const fmt = (d: Date) => formatter.format(d);
  const times = (c: CallView) => ({
    lock: fmt(c.lockAt),
    event: fmt(c.eventAt),
    openToAll: fmt(c.openToAllAt),
    disputeEnds: c.disputeEndsAt ? fmt(c.disputeEndsAt) : null,
    voteCloses: c.voteClosesAt ? fmt(c.voteClosesAt) : null,
  });
  const card = (c: CallView) => <CallCard key={c.id} call={c} groupId={group.id} times={times(c)} />;
  const inviteLink = group.inviteToken ? `${await appOrigin()}/join/${group.inviteToken}` : null;
  const isAdmin = group.me.role === "admin";

  return (
    <>
      <h1>{group.name}</h1>
      <p className="muted">
        You&apos;re {group.me.displayName} here · times shown in {group.timeZone}
      </p>

      {toReview.length > 0 && (
        <p className="card">
          <strong>{toReview.length === 1 ? "A hidden call needs" : `${toReview.length} hidden calls need`} your review.</strong>{" "}
          <Link href="/review">Review now →</Link>
        </p>
      )}

      <div className="card">
        <div className="row spread">
          <strong>This week</strong>
          <Link href={`/groups/${group.id}/ranking`} className="small">
            Full ranking →
          </Link>
        </div>
        <RankingTable rows={week.rows} me={user.id} limit={3} />
      </div>

      {needsMe.length > 0 && (
        <>
          <h2>Needs you</h2>
          {needsMe.map(card)}
        </>
      )}

      <h2>Open for picks</h2>
      {open.length === 0 && <p className="muted">No open calls. Make the first one below.</p>}
      {open.map(card)}

      <h2>New call</h2>
      <div className="card">
        <NewCallForm groupId={group.id} members={group.members} />
      </div>

      {waiting.length > 0 && (
        <>
          <h2>Waiting for results</h2>
          {waiting.map(card)}
        </>
      )}

      {finished.length > 0 && (
        <>
          <h2>Finished</h2>
          {finished.map(card)}
        </>
      )}

      <h2>People ({group.members.length})</h2>
      <div className="card">
        <ul className="list">
          {group.members.map((m) => (
            <MemberRow
              key={m.userId}
              groupId={group.id}
              userId={m.userId}
              name={m.displayName}
              isMe={m.userId === user.id}
              isAdmin={m.role === "admin"}
              viewerIsAdmin={isAdmin}
              blocked={blocked.has(m.userId)}
            />
          ))}
        </ul>
        <p className="muted small">Blocking hides someone&apos;s calls from you and stops them making calls about you.</p>
      </div>

      {removed.length > 0 && (
        <>
          <h2>Removed</h2>
          <div className="card">
            <ul className="list">
              {removed.map((m) => (
                <RemovedRow key={m.userId} groupId={group.id} userId={m.userId} name={m.name} />
              ))}
            </ul>
          </div>
        </>
      )}

      {inviteLink && (
        <>
          <h2>Invite friends</h2>
          <div className="card stack">
            <p className="invite">{inviteLink}</p>
            <div className="row">
              <CopyButton text={inviteLink} />
              <ActionForm action={resetInviteAction} className="row">
                <input type="hidden" name="groupId" value={group.id} />
                <Submit variant="secondary">New link</Submit>
              </ActionForm>
            </div>
            <p className="muted">Anyone with this link can join. Make a new link to stop the old one working.</p>
          </div>
        </>
      )}

      <h2>Leave</h2>
      <ActionForm action={leaveGroupAction}>
        <input type="hidden" name="groupId" value={group.id} />
        {isAdmin && group.members.length > 1 && (
          <p className="muted">You&apos;re the admin. If you leave, the longest-standing member takes over.</p>
        )}
        <Submit variant="danger">Leave group</Submit>
      </ActionForm>
    </>
  );
}
