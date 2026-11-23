import { requestLoginAction } from "../actions";
import { ActionForm, Submit } from "../ui";
import { safeNext } from "@/server/session";
import { reviewConfig } from "@/server/review";
import { LegalFooter } from "../(legal)/LegalFooter";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const reviewEnabled = !!reviewConfig();
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted">We&apos;ll email you a link. No password needed.</p>
      <ActionForm action={requestLoginAction}>
        <input type="hidden" name="next" value={safeNext(typeof next === "string" ? next : null)} />
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
      <LegalFooter />
    </>
  );
}
