import { logoutAction, logoutEverywhereAction } from "../actions";
import { requireUser } from "@/server/session";

export default async function Settings() {
  const user = await requireUser("/settings");
  return (
    <>
      <h1>Settings</h1>
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
