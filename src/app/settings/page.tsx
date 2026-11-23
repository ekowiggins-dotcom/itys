import { logoutAction, logoutEverywhereAction, setEmailAlertsAction } from "../actions";
import { ActionForm, Submit } from "../ui";
import { requireUser } from "@/server/session";

export default async function Settings() {
  const user = await requireUser("/settings");
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
        <div className="row">
          <form action={logoutAction}>
            <button type="submit" className="secondary">
              Sign out
            </button>
          </form>
          <form action={logoutEverywhereAction}>
            <button type="submit" className="danger">
              Sign out everywhere
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
