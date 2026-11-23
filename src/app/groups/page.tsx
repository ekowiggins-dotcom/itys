import Link from "next/link";
import { createGroupAction } from "../actions";
import { ActionForm, Submit, TimeZoneInput } from "../ui";
import { getDb } from "@/server/db";
import { myGroups } from "@/server/groups";
import { GROUP_COLOR_KEYS, GROUP_COLORS, groupColorKey, initials } from "@/lib/faces";
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
          <span
            className="avatar"
            style={{ "--size": "44px", background: GROUP_COLORS[groupColorKey(g.color, g.id)] } as React.CSSProperties}
            aria-hidden="true"
          >
            {initials(g.name)}
          </span>
          <span>
            <strong className="display">{g.name}</strong>
            <span className="muted small" style={{ display: "block" }}>
              {g.memberCount} {g.memberCount === 1 ? "person" : "people"}
              {g.role === "admin" ? " · you're the admin" : ""}
            </span>
          </span>
        </Link>
      ))}

      <h2>Create a group</h2>
      <div className="card">
        <ActionForm action={createGroupAction}>
          <TimeZoneInput />
          <label htmlFor="name">Group name</label>
          <input id="name" type="text" name="name" required minLength={2} maxLength={40} placeholder="Flat 4B" />
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small" style={{ fontWeight: 700, marginBottom: 8 }}>
              Colour
            </legend>
            <div className="colors">
              {GROUP_COLOR_KEYS.map((k, i) => (
                <label key={k} title={k}>
                  <input type="radio" name="color" value={k} defaultChecked={i === 0} aria-label={k} />
                  <span className="dot" style={{ background: GROUP_COLORS[k] }} />
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="displayName">Your name in this group</label>
          <input id="displayName" type="text" name="displayName" defaultValue={user.name ?? ""} required maxLength={30} />
          <Submit>Create group</Submit>
        </ActionForm>
      </div>
    </>
  );
}
