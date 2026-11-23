import { requestLoginAction } from "../actions";
import { ActionForm, Submit } from "../ui";
import { AppleButton, WebOnly } from "./AppleButton";
import { safeNext } from "@/server/session";
import { reviewConfig } from "@/server/review";
import { LegalFooter } from "../(legal)/LegalFooter";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { next: raw } = await searchParams;
  const next = safeNext(typeof raw === "string" ? raw : null);
  const reviewEnabled = !!reviewConfig();
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted">One tap with your Apple ID. No password, no new account to remember.</p>
      <AppleButton next={next} servicesId={process.env.APPLE_SERVICES_ID || null} />

      <WebOnly alsoInApp={reviewEnabled}>
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
      </WebOnly>
      <LegalFooter />
    </>
  );
}
