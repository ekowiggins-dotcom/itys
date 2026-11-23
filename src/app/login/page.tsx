import { requestLoginAction } from "../actions";
import { ActionForm, Submit } from "../ui";
import { safeNext } from "@/server/session";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted">We&apos;ll email you a link. No password needed.</p>
      <ActionForm action={requestLoginAction}>
        <input type="hidden" name="next" value={safeNext(typeof next === "string" ? next : null)} />
        <label htmlFor="email">Email</label>
        <input id="email" type="email" name="email" autoComplete="email" required maxLength={254} />
        <Submit>Send link</Submit>
      </ActionForm>
    </>
  );
}
