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
import { countdown, friendlyTime, urgency } from "@/lib/when";
import { GROUP_COLORS } from "@/lib/faces";
import { Faces } from "../../components/Avatar";
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
  const now = new Date();
  const fmt = (d: Date) => friendlyTime(d, now, group.timeZone);
  const times = (c: CallView) => ({
    lock: fmt(c.lockAt),
    event: fmt(c.eventAt),
    openToAll: fmt(c.openToAllAt),
    disputeEnds: c.disputeEndsAt ? fmt(c.disputeEndsAt) : null,
    voteCloses: c.voteClosesAt ? fmt(c.voteClosesAt) : null,
    lockUrgency: urgency(c.lockAt, now),
    lockCountdown: countdown(c.lockAt, now),
  });
  const card = (c: CallView, turn = false) => (
    <CallCard key={c.id} call={c} groupId={group.id} times={times(c)} faces={group.faces} turn={turn} />
  );
  const inviteLink = group.inviteToken ? `${await appOrigin()}/join/${group.inviteToken}` : null;
  const isAdmin = group.me.role === "admin";

  return (
    <>
      <h1 className="row">
        <span className="swatch" style={{ background: GROUP_COLORS[group.color] }} aria-hidden="true" />
        {group.name}
      </h1>
      <p className="row muted">
        <Faces people={group.members.map((m) => ({ name: m.displayName, color: group.faces[m.userId] }))} />
        <span>
          {group.members.length} {group.members.length === 1 ? "person" : "people"}
          {needsMe.length > 0 ? ` · ${needsMe.length} waiting for you` : ""}
        </span>
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
        <RankingTable rows={week.rows} me={user.id} limit={3} faces={group.faces} />
      </div>

      {needsMe.length > 0 && (
        <>
          <h2>Needs you</h2>
          {needsMe.map((c) => card(c, true))}
        </>
      )}

      <h2>Open for picks</h2>
      {open.length === 0 && <p className="muted">No open calls. Make the first one below.</p>}
      {open.map((c) => card(c, c.canPick && !c.myPick))}

      <h2>New call</h2>
      <div className="card">
        <NewCallForm groupId={group.id} members={group.members} />
      </div>

      {waiting.length > 0 && (
        <>
          <h2>Waiting for results</h2>
          {waiting.map((c) => card(c))}
        </>
      )}

      {finished.length > 0 && (
        <>
          <h2>Finished</h2>
          {finished.map((c) => card(c))}
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
              color={group.faces[m.userId]}
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
