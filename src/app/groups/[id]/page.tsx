import { notFound } from "next/navigation";
import { leaveGroupAction, resetInviteAction } from "../../actions";
import { ActionForm, CopyButton, Submit } from "../../ui";
import { CallCard } from "./CallCard";
import { NewCallForm } from "./NewCallForm";
import { callsForMember } from "@/server/calls";
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
  const open = callList.filter((c) => !c.locked);
  const closed = callList.filter((c) => c.locked);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: group.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const fmt = (d: Date) => formatter.format(d);
  const inviteLink = group.inviteToken ? `${await appOrigin()}/join/${group.inviteToken}` : null;
  const isAdmin = group.me.role === "admin";

  return (
    <>
      <h1>{group.name}</h1>
      <p className="muted">
        You&apos;re {group.me.displayName} here · times shown in {group.timeZone}
      </p>

      <h2>Open calls</h2>
      {open.length === 0 && <p className="muted">No open calls. Make the first one below.</p>}
      {open.map((c) => (
        <CallCard key={c.id} call={c} groupId={group.id} times={{ lock: fmt(c.lockAt), event: fmt(c.eventAt) }} />
      ))}

      <h2>New call</h2>
      <div className="card">
        <NewCallForm groupId={group.id} members={group.members} />
      </div>

      {closed.length > 0 && (
        <>
          <h2>Picks closed</h2>
          {closed.map((c) => (
            <CallCard key={c.id} call={c} groupId={group.id} times={{ lock: fmt(c.lockAt), event: fmt(c.eventAt) }} />
          ))}
        </>
      )}

      <h2>People ({group.members.length})</h2>
      <div className="card">
        <ul className="list">
          {group.members.map((m) => (
            <li key={m.userId}>
              <span>
                {m.displayName}
                {m.userId === user.id ? " (you)" : ""}
              </span>
              {m.role === "admin" && <span className="tag">admin</span>}
            </li>
          ))}
        </ul>
      </div>

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
