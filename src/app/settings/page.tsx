import { deleteAccountAction, memberAction, setEmailAlertsAction } from "../actions";
import { SignOutButtons } from "./SignOut";
import { LegalFooter } from "../(legal)/LegalFooter";
import { getDb } from "@/server/db";
import { blockedPeople } from "@/server/moderation";
import { ActionForm, Submit } from "../ui";
import { requireUser } from "@/server/session";

export default async function Settings() {
  const user = await requireUser("/settings");
  const blocked = await blockedPeople(await getDb(), user);
  return (
    <>
      <h1>Settings</h1>
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
          <span className="muted">{user.email}</span>
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
