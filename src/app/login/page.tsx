import { reviewLoginAction } from "../actions";
import { GetTheApp } from "../components/GetTheApp";
import { ActionForm, Submit } from "../ui";
import { AppleButton } from "./AppleButton";
import { isAppRequest, safeNext } from "@/server/session";
import { reviewConfig } from "@/server/review";
import { LegalFooter } from "../(legal)/LegalFooter";

/** For Apple's reviewers only, and only while REVIEW_CODE is set: a code that opens the demo account. */
function ReviewDoor({ next }: { next: string }) {
  if (!reviewConfig()) return null;
  return (
    <details className="review-login">
      <summary className="small">App Review demo</summary>
      <ActionForm action={reviewLoginAction}>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="code">Demo code</label>
        <input id="code" type="text" name="code" autoComplete="off" autoCapitalize="off" spellCheck={false} required maxLength={200} />
        <Submit>Open demo</Submit>
      </ActionForm>
    </details>
  );
}

/** Sign in with Apple, in the iOS app only. A web browser gets "Get the app". */
export default async function Login({ searchParams }: PageProps<"/login">) {
  const { next: raw } = await searchParams;
  const next = safeNext(typeof raw === "string" ? raw : null);
  if (!(await isAppRequest())) {
    return (
      <>
        <h1>Get Who’ll on your iPhone</h1>
        <GetTheApp invite={next.startsWith("/join/") || next.startsWith("/c/")} />
        <ReviewDoor next={next} />
        <LegalFooter />
      </>
    );
  }
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted">One tap with your Apple ID. No password, no new account to remember.</p>
      <AppleButton next={next} />
      <ReviewDoor next={next} />
      <LegalFooter />
    </>
  );
}
