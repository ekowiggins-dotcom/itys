import { requestLoginAction } from "../actions";
import { GetTheApp } from "../components/GetTheApp";
import { ActionForm, Submit } from "../ui";
import { AppleButton } from "./AppleButton";
import { isAppRequest, safeNext } from "@/server/session";
import { reviewConfig } from "@/server/review";
import { LegalFooter } from "../(legal)/LegalFooter";

/** Sign-in, in the iOS app only (Sign in with Apple, or an emailed link). A web browser gets "Get the app". */
export default async function Login({ searchParams }: PageProps<"/login">) {
  const { next: raw } = await searchParams;
  const next = safeNext(typeof raw === "string" ? raw : null);
  if (!(await isAppRequest())) {
    return (
      <>
        <h1>Get Who’ll on your iPhone</h1>
        <GetTheApp invite={next.startsWith("/join/") || next.startsWith("/c/")} />
        <LegalFooter />
      </>
    );
  }
  const reviewEnabled = !!reviewConfig();
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted">One tap with your Apple ID. No password, no new account to remember.</p>
      <AppleButton next={next} />

      <details className="email-login">
        <summary className="small">Use email instead</summary>
        <ActionForm action={requestLoginAction}>
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" name="email" autoComplete="email" required maxLength={254} />
          {reviewEnabled && (
            <details>
              <summary className="small">Have a sign-in code?</summary>
              <label htmlFor="code">Sign-in code</label>
              <input id="code" type="text" name="code" autoComplete="one-time-code" maxLength={200} />
            </details>
          )}
          <Submit>Send link</Submit>
        </ActionForm>
      </details>
      <LegalFooter />
    </>
  );
}
