import { leaveGroupAction, resetInviteAction } from "../../../actions";
import { ActionForm, Submit } from "../../../ui";
import { loadGroup } from "../data";
import { InviteShare } from "../InviteShare";
import { PlanNotice } from "../PlanNotice";
import { MemberRow, RemovedRow } from "../MemberRow";
import { getDb } from "@/server/db";
import { blockedIds, removedMembers } from "@/server/moderation";
import { appOrigin } from "@/server/session";

/** The Group tab: people, inviting, and leaving. */
export default async function GroupTab({ params }: PageProps<"/groups/[id]/group">) {
  const { id } = await params;
  const { user, group } = await loadGroup(id);
  const db = await getDb();
  const blocked = await blockedIds(db, user.id);
  const removed = await removedMembers(db, user, id);
  const inviteLink = group.inviteToken ? `${await appOrigin()}/join/${group.inviteToken}` : null;
  const isAdmin = group.me.role === "admin";

  return (
    <>
      <PlanNotice plan={group.plan} place="group" />
      {inviteLink && (
        <section className="card invite-card">
          <h2>Invite friends</h2>
          <p className="muted small">Anyone with the link can join. Make a new link to stop the old one working.</p>
          <InviteShare url={inviteLink} groupName={group.name} />
          <ActionForm action={resetInviteAction} className="row">
            <input type="hidden" name="groupId" value={group.id} />
            <Submit variant="secondary">Make a new link</Submit>
          </ActionForm>
        </section>
      )}

      <h2 className="section-title">
        People{" "}
        <span className="count neutral">
          {group.members.length}
          {group.plan.enforced && !group.plan.payerHasPro ? ` of ${Math.max(group.plan.freeMembers, group.members.length)}` : ""}
        </span>
      </h2>
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
          <h2 className="section-title">Removed</h2>
          <div className="card">
            <ul className="list">
              {removed.map((m) => (
                <RemovedRow key={m.userId} groupId={group.id} userId={m.userId} name={m.name} />
              ))}
            </ul>
          </div>
        </>
      )}

      <h2 className="section-title">About</h2>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          You&apos;re <strong>{group.me.displayName}</strong> here. Times are shown in {group.timeZone}.
        </p>
        <ActionForm action={leaveGroupAction}>
          <input type="hidden" name="groupId" value={group.id} />
          {isAdmin && group.members.length > 1 && (
            <p className="muted small">You&apos;re the admin. If you leave, the longest-standing member takes over.</p>
          )}
          <Submit variant="danger">Leave group</Submit>
        </ActionForm>
      </div>
    </>
  );
}
