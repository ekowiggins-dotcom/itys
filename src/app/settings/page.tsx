import { deleteAccountAction, memberAction, setEmailAlertsAction } from "../actions";
import { SignOutButtons } from "./SignOut";
import { LegalFooter } from "../(legal)/LegalFooter";
import { getDb } from "@/server/db";
import { blockedPeople } from "@/server/moderation";
import { ActionForm, Submit } from "../ui";
import { requireUser } from "@/server/session";
import { FREE_MEMBERS, proLimitsOn, proStatus } from "@/server/subscriptions";
import { ProGate } from "./ProGate";
import Link from "next/link";

export default async function Settings() {
  const user = await requireUser("/settings");
  const db = await getDb();
  const blocked = await blockedPeople(db, user);
  const pro = await proStatus(db, user.id);
  return (
    <>
      <h1>Settings</h1>
      <ProGate enforced={proLimitsOn() || pro.active}>
        <h2>Who’ll Pro</h2>
        <div className="card">
          <p className="small" style={{ marginTop: 0 }}>
            {pro.active
              ? "Pro is on: groups you made can have up to 30 people."
              : `Free groups have up to ${FREE_MEMBERS} people. Pro lets groups you made have up to 30.`}
          </p>
          <Link href="/settings/subscription" className="btn secondary">
            {pro.active ? "Your subscription" : "See Who’ll Pro"}
          </Link>
        </div>
      </ProGate>

      <h2>Emails</h2>
      <div className="card">
        <ActionForm action={setEmailAlertsAction}>
          <label className="row check">
            <input type="checkbox" name="emailAlerts" defaultChecked={user.emailAlerts !== false} />
            Email me when something needs me: settling a call, a group vote, or a call about me.
          </label>
          <Submit variant="secondary">Save</Submit>
        </ActionForm>
      </div>

      <h2>Account</h2>
      <div className="card">
        <p>
          <strong>{user.name}</strong>
          <br />
          <span className="muted">{user.email ?? "Signed in with Apple"}</span>
        </p>
        <SignOutButtons />
      </div>

      {blocked.length > 0 && (
        <>
          <h2>Blocked</h2>
          <div className="card">
            <ul className="list">
              {blocked.map((b) => (
                <li key={b.userId}>
                  <span>{b.name}</span>
                  <ActionForm action={memberAction} className="row">
                    <input type="hidden" name="userId" value={b.userId} />
                    <input type="hidden" name="op" value="unblock" />
                    <Submit variant="secondary">Unblock</Submit>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <h2>Delete account</h2>
      <div className="card">
        <ActionForm action={deleteAccountAction}>
          <p className="small">
            This deletes your account, your picks and points, and your name from every group, and takes down calls about
            you. Calls you wrote stay for your friends, shown as by &quot;Former member&quot;. It can&apos;t be undone.
            {pro.active && " Deleting your account doesn’t cancel Who’ll Pro: cancel it first in your iPhone’s Settings → your name → Subscriptions."}
          </p>
          <label htmlFor="confirm">Type &quot;delete&quot; to confirm</label>
          <input id="confirm" type="text" name="confirm" autoComplete="off" required />
          <Submit variant="danger">Delete my account</Submit>
        </ActionForm>
      </div>
      <LegalFooter />
    </>
  );
}
