import { setNameAction } from "../actions";
import { ActionForm, Submit } from "../ui";
import { requireUser, safeNext } from "@/server/session";

export default async function Welcome({ searchParams }: PageProps<"/welcome">) {
  const { next } = await searchParams;
  const user = await requireUser("/welcome");
  return (
    <>
      <h1>What do friends call you?</h1>
      <p className="muted">This is your default name in groups. You can pick a different one per group.</p>
      <ActionForm action={setNameAction}>
        <input type="hidden" name="next" value={safeNext(typeof next === "string" ? next : null)} />
        <label htmlFor="name">Name</label>
        <input id="name" type="text" name="name" defaultValue={user.name ?? ""} required maxLength={30} />
        <Submit>Continue</Submit>
      </ActionForm>
    </>
  );
}
