import { completeLoginAction } from "../../actions";
import { ActionForm, Submit } from "../../ui";
import { GetTheApp } from "../../components/GetTheApp";
import { isAppRequest, safeNext } from "@/server/session";

/**
 * Landing page for the emailed link. Signing in needs a button press (a POST), because email
 * security scanners open links automatically and would otherwise use up the one-time token.
 */
export default async function Verify({ searchParams }: PageProps<"/auth/verify">) {
  const { token, next } = await searchParams;
  if (typeof token !== "string") {
    return (
      <>
        <h1>Link incomplete</h1>
        <p className="muted">Open the full link from your email, or request a new one.</p>
      </>
    );
  }
  if (!(await isAppRequest())) {
    // A sign-in link opened in a browser (e.g. on a computer): sign-in happens in the app.
    return (
      <>
        <h1>Open this link on your iPhone</h1>
        <p className="muted">
          Sign-in links work in the Who’ll app. Open the email on the iPhone where Who’ll is installed and tap the link
          there.
        </p>
        <GetTheApp />
      </>
    );
  }
  return (
    <>
      <h1>Finish signing in</h1>
      <ActionForm action={completeLoginAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="next" value={safeNext(typeof next === "string" ? next : null)} />
        <Submit>Continue</Submit>
      </ActionForm>
    </>
  );
}
