import Link from "next/link";
import { createGroupAction } from "../actions";
import { ActionForm, Submit, TimeZoneInput } from "../ui";
import { getDb } from "@/server/db";
import { myGroups } from "@/server/groups";
import { requireUser } from "@/server/session";

export default async function Groups() {
  const user = await requireUser("/groups");
  const list = await myGroups(await getDb(), user);
  return (
    <>
      <h1>Your groups</h1>
      {list.length === 0 && <p className="muted">You&apos;re not in a group yet. Create one, or open an invite link from a friend.</p>}
      {list.map((g) => (
        <Link key={g.id} href={`/groups/${g.id}`} className="card group">
          <strong>{g.name}</strong>
          <div className="muted">
            {g.memberCount} {g.memberCount === 1 ? "person" : "people"}
            {g.role === "admin" ? " · you're the admin" : ""}
          </div>
        </Link>
      ))}

      <h2>Create a group</h2>
      <div className="card">
        <ActionForm action={createGroupAction}>
          <TimeZoneInput />
          <label htmlFor="name">Group name</label>
          <input id="name" type="text" name="name" required minLength={2} maxLength={40} placeholder="Flat 4B" />
          <label htmlFor="displayName">Your name in this group</label>
          <input id="displayName" type="text" name="displayName" defaultValue={user.name ?? ""} required maxLength={30} />
          <Submit>Create group</Submit>
        </ActionForm>
      </div>
    </>
  );
}
