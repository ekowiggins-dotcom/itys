import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import {
  createGroup,
  groupForMember,
  invitePreview,
  joinGroup,
  leaveGroup,
  MAX_MEMBERS,
  myGroups,
  resetInvite,
} from "@/server/groups";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

let ipN = 0;
const ip = () => `9.9.${Math.floor(++ipN / 250)}.${ipN % 250}`;

async function groupWithAdmin(name = "Flat") {
  const admin = await signUp(db, `Admin${name}`);
  const id = await createGroup(db, admin.user, { name, timeZone: "Europe/Istanbul", displayName: "Ada" });
  const view = await groupForMember(db, admin.user, id);
  return { admin: admin.user, id, invite: view.inviteToken! };
}

describe("creating groups", () => {
  it("makes the creator the admin and only member", async () => {
    const { admin, id } = await groupWithAdmin();
    const view = await groupForMember(db, admin, id);
    expect(view.me).toEqual({ displayName: "Ada", role: "admin" });
    expect(view.members).toHaveLength(1);
    expect(view.timeZone).toBe("Europe/Istanbul");
    expect(await myGroups(db, admin)).toEqual([{ id, name: "Flat", role: "admin", memberCount: 1 }]);
  });

  it("rejects unknown time zones and empty names", async () => {
    const { user } = await signUp(db, "Bad");
    await expect(createGroup(db, user, { name: "X1", timeZone: "Mars/Base", displayName: "B" })).rejects.toThrow(
      /time zone/,
    );
    await expect(createGroup(db, user, { name: " ", timeZone: "UTC", displayName: "B" })).rejects.toThrow();
  });

  it("uses 128-bit invite tokens", async () => {
    const { invite } = await groupWithAdmin("Tok");
    expect(invite).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe("visibility", () => {
  it("hides a group from non-members as 'not found'", async () => {
    const { id } = await groupWithAdmin("Secret");
    const outsider = await signUp(db, "Outsider");
    await expect(groupForMember(db, outsider.user, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(groupForMember(db, outsider.user, "not-a-uuid")).rejects.toMatchObject({ code: "not_found" });
  });

  it("shows the invite link only to the admin", async () => {
    const { id, invite } = await groupWithAdmin("Links");
    const friend = await signUp(db, "Friend");
    await joinGroup(db, friend.user, invite, "Bo", ip());
    expect((await groupForMember(db, friend.user, id)).inviteToken).toBeNull();
  });

  it("shows outsiders only the name and size in the invite preview", async () => {
    const { invite } = await groupWithAdmin("Preview");
    const preview = await invitePreview(db, invite, ip(), null);
    expect(preview).toEqual({ groupId: expect.any(String), name: "Preview", memberCount: 1, full: false, alreadyMember: false });
    expect(await invitePreview(db, "x".repeat(22), ip(), null)).toBeNull();
    expect(await invitePreview(db, "short", ip(), null)).toBeNull();
  });

  it("rate-limits invite previews per IP", async () => {
    const same = "8.8.8.8";
    for (let i = 0; i < 60; i++) await invitePreview(db, "y".repeat(22), same, null);
    await expect(invitePreview(db, "y".repeat(22), same, null)).rejects.toThrow(/Too many/);
  });
});

describe("joining", () => {
  it("joins with a per-group name, and joining twice is harmless", async () => {
    const { id, invite } = await groupWithAdmin("Join");
    const friend = await signUp(db, "Joiner");
    expect(await joinGroup(db, friend.user, invite, "Cem", ip())).toBe(id);
    expect(await joinGroup(db, friend.user, invite, "Cem", ip())).toBe(id);
    const view = await groupForMember(db, friend.user, id);
    expect(view.members.map((m) => m.displayName)).toEqual(["Ada", "Cem"]);
  });

  it("refuses a name someone in the group already uses, ignoring case", async () => {
    const { invite } = await groupWithAdmin("Names");
    const friend = await signUp(db, "Copycat");
    await expect(joinGroup(db, friend.user, invite, "ada", ip())).rejects.toThrow(/already called/);
  });

  it("stops working after the admin makes a new link", async () => {
    const { admin, id, invite } = await groupWithAdmin("Reset");
    const fresh = await resetInvite(db, admin, id);
    expect(fresh).not.toBe(invite);
    const friend = await signUp(db, "TooLate");
    await expect(joinGroup(db, friend.user, invite, "Dee", ip())).rejects.toThrow(/no longer valid/);
    await joinGroup(db, friend.user, fresh, "Dee", ip());
  });

  it("only lets the admin reset the link", async () => {
    const { id, invite } = await groupWithAdmin("ResetAuth");
    const friend = await signUp(db, "Member");
    await joinGroup(db, friend.user, invite, "Eli", ip());
    await expect(resetInvite(db, friend.user, id)).rejects.toMatchObject({ code: "forbidden" });
  });

  it(`caps groups at ${MAX_MEMBERS} people`, async () => {
    const { invite } = await groupWithAdmin("Full");
    for (let i = 1; i < MAX_MEMBERS; i++) {
      const u = await signUp(db, `Fill${i}`);
      await joinGroup(db, u.user, invite, `Fill${i}`, ip());
    }
    const extra = await signUp(db, "Extra");
    await expect(joinGroup(db, extra.user, invite, "Extra", ip())).rejects.toThrow(/full/);
    expect((await invitePreview(db, invite, ip(), extra.user))?.full).toBe(true);
  });
});

describe("leaving", () => {
  it("hands admin to the longest-standing member when the admin leaves", async () => {
    const { admin, id, invite } = await groupWithAdmin("Handover");
    const t = Date.now();
    const first = await signUp(db, "First");
    await joinGroup(db, first.user, invite, "First", ip(), new Date(t + 1000));
    const second = await signUp(db, "Second");
    await joinGroup(db, second.user, invite, "Second", ip(), new Date(t + 2000));

    await leaveGroup(db, admin, id);
    await expect(groupForMember(db, admin, id)).rejects.toMatchObject({ code: "not_found" });
    const view = await groupForMember(db, first.user, id);
    expect(view.me.role).toBe("admin");
    expect(view.members.map((m) => m.displayName)).toEqual(["First", "Second"]);
  });

  it("frees the name and lets someone rejoin later as a plain member", async () => {
    const { admin, id, invite } = await groupWithAdmin("Rejoin");
    const friend = await signUp(db, "Back");
    await joinGroup(db, friend.user, invite, "Fay", ip());
    await leaveGroup(db, friend.user, id);
    expect(await myGroups(db, friend.user)).toEqual([]);

    const other = await signUp(db, "Other");
    await joinGroup(db, other.user, invite, "Fay", ip()); // the name is free again
    await joinGroup(db, friend.user, invite, "Fay2", ip());
    const view = await groupForMember(db, admin, id);
    expect(view.members.map((m) => m.displayName)).toEqual(["Ada", "Fay", "Fay2"]);
  });
});
