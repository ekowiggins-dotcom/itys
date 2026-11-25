import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { deleteAccount } from "@/server/account";
import type { User } from "@/server/auth";
import { userForSession } from "@/server/auth";
import { callsForMember } from "@/server/call-views";
import { createCall, pick } from "@/server/calls";
import { findBlocked } from "@/server/content-filter";
import { calls, scores, users } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createGroup, groupForMember, joinGroup, leaveGroup } from "@/server/groups";
import { proposeResult, runDueCalls } from "@/server/lifecycle";
import {
  allowBack,
  blockUser,
  removeMember,
  reportCall,
  reviewCall,
  reviewerFor,
  reviewQueue,
  unblockUser,
} from "@/server/moderation";
import { inbox } from "@/server/notifications";
import { rankingFor } from "@/server/rankings";
import { givePro, signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const T0 = new Date("2026-09-07T09:00:00Z");
const H = 3600_000;
const at = (h: number) => new Date(T0.getTime() + h * H);
let n = 0;

async function group(names = ["Ada", "Bo", "Cem", "Dee"]) {
  const u: Record<string, User> = {};
  const tokens: Record<string, string> = {};
  for (const name of names) {
    const s = await signUp(db, name);
    u[name] = s.user;
    tokens[name] = s.sessionToken;
  }
  const groupId = await createGroup(db, u[names[0]], { name: "Mods", timeZone: "UTC", displayName: names[0] }, T0);
  await givePro(db, u[names[0]].id); // 5+ members need Who’ll Pro
  const invite = (await groupForMember(db, u[names[0]], groupId)).inviteToken!;
  for (const name of names.slice(1)) await joinGroup(db, u[name], invite, name, `3.3.${Math.floor(++n / 250)}.${n % 250}`, T0);
  return { u, tokens, groupId, invite };
}

const visibleTo = async (user: User, groupId: string) => (await callsForMember(db, user, groupId, at(1))).map((c) => c.text);
const row = async (id: string) => (await db.select().from(calls).where(eq(calls.id, id)))[0];

describe("word filter", () => {
  it("blocks explicit words, including common disguises, but not innocent words", () => {
    expect(findBlocked("Will Bo send nudes?")).toBe("nudes");
    expect(findBlocked("Will Bo send NUD3S")).toBe("nudes");
    expect(findBlocked("p.o.r.n night")).toBe("porn");
    expect(findBlocked("Will we see the sextant at the museum?")).toBeNull();
    expect(findBlocked("Will Cem finish the grape harvest?")).toBeNull();
  });

  it("uses the maintained English and Turkish lists, by whole word", () => {
    expect(findBlocked("Will Bo post porn?")).toBe("porn");
    expect(findBlocked("Kim en büyük göt?")).toBe("göt");
    expect(findBlocked("Scunthorpe will win the cup")).toBeNull(); // contains a bad word, isn't one
    expect(findBlocked("Am I going to be late?")).toBeNull(); // "am" is fine in English
    expect(findBlocked("Will the film suck?")).toBeNull(); // mild banter allowed
    expect(findBlocked("Kim düğüne geç kalacak?")).toBeNull();
    expect(findBlocked("Sık sık geç kalır mı?")).toBeNull(); // Turkish "often", dotless ı
    expect(findBlocked("Who got the job?")).toBeNull(); // accents matter: "got" isn't "göt"
    expect(findBlocked("Düğünde çok şık olacak mı?")).toBeNull(); // "şık" means stylish
    expect(findBlocked("WILL BO SEND NUDES")).toBe("nudes"); // capital I in English still counts as i
    expect(findBlocked("KİM EN BÜYÜK GÖT")).toBe("göt"); // and Turkish capitals work too
  });

  it("refuses calls with blocked words", async () => {
    const { u, groupId } = await group();
    await expect(
      createCall(db, u.Ada, groupId, { text: "Will Bo post nudes?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0),
    ).rejects.toThrow(/isn't allowed/);
  });
});

describe("hiding and reporting", () => {
  it("lets the person a call is about hide it at once, from everyone", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will Bo cry at the film?", kind: "yes_no", subjectId: u.Bo.id, lockAt: at(24), eventAt: at(48) }, T0);
    expect(await reportCall(db, u.Bo, id, "about_me", at(1))).toBe(true);
    for (const who of [u.Ada, u.Bo, u.Cem]) expect(await visibleTo(who, groupId)).not.toContain("Will Bo cry at the film?");
    await expect(pick(db, u.Cem, id, "yes", at(2))).rejects.toThrow();
    // Its clock is paused: nothing happens at lock while it's hidden.
    await runDueCalls(db, at(30));
    expect((await row(id)).settlerId).toBeNull();
  });

  it("hides a call after 2 reports from others, not after 1", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will the neighbours complain?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);
    expect(await reportCall(db, u.Bo, id, "hurtful", at(1))).toBe(false);
    expect(await reportCall(db, u.Bo, id, "hurtful", at(1))).toBe(false); // the same person twice doesn't count twice
    expect(await visibleTo(u.Cem, groupId)).toContain("Will the neighbours complain?");
    expect(await reportCall(db, u.Cem, id, "spam", at(2))).toBe(true);
    expect(await visibleTo(u.Dee, groupId)).not.toContain("Will the neighbours complain?");
  });

  it("doesn't let you report your own call", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will I wake up early?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);
    await expect(reportCall(db, u.Ada, id, "other", at(1))).rejects.toThrow(/You wrote this call/);
  });

  it("never shows a hidden call's text in notifications", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Bo, groupId, { text: "Will Cem lose his keys again?", kind: "yes_no", subjectId: u.Cem.id, lockAt: at(24), eventAt: at(48) }, T0);
    await reportCall(db, u.Cem, id, "about_me", at(1));
    const texts = (await inbox(db, u.Dee)).map((x) => x.text);
    expect(texts.some((t) => t.includes("keys"))).toBe(false);
  });
});

describe("review", () => {
  it("goes to the admin, unless the admin wrote it or it's about them", async () => {
    const { u, groupId } = await group();
    expect(await reviewerFor(db, { groupId, authorId: u.Bo.id, subjectId: u.Cem.id })).toBe(u.Ada.id);
    expect(await reviewerFor(db, { groupId, authorId: u.Ada.id, subjectId: u.Cem.id })).toBe(u.Bo.id);
    expect(await reviewerFor(db, { groupId, authorId: u.Bo.id, subjectId: u.Ada.id })).toBe(u.Cem.id);
  });

  it("tells the reviewer, who can restore the call and resume its clock", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Bo, groupId, { text: "Will Dee sing at karaoke?", kind: "yes_no", subjectId: u.Dee.id, lockAt: at(24), eventAt: at(48) }, T0);
    await reportCall(db, u.Dee, id, "about_me", at(1));
    expect((await inbox(db, u.Ada)).map((x) => x.text)).toContain("A call in Mods was hidden after a report. Please review it.");
    const queue = await reviewQueue(db, u.Ada);
    expect(queue.map((q) => [q.text, q.reasons])).toEqual([["Will Dee sing at karaoke?", ["about_me"]]]);
    expect(await reviewQueue(db, u.Cem)).toEqual([]);
    await expect(reviewCall(db, u.Cem, id, "restore", at(2))).rejects.toThrow(/Someone else reviews/);

    await reviewCall(db, u.Ada, id, "restore", at(30)); // restored after lock: catches up
    expect(await visibleTo(u.Cem, groupId)).toContain("Will Dee sing at karaoke?");
    expect((await row(id)).settlerId).not.toBeNull();
  });

  it("removes a call for good, calls it off and takes back its points", async () => {
    const { u, groupId } = await group(["Ada", "Bo", "Cem", "Dee", "Eve"]);
    const id = await createCall(db, u.Bo, groupId, { text: "Will Eve trip on stage?", kind: "yes_no", subjectId: u.Eve.id, lockAt: at(2), eventAt: at(2) }, T0);
    await pick(db, u.Cem, id, "yes", at(1));
    await pick(db, u.Dee, id, "no", at(1));
    await runDueCalls(db, at(2));
    const r = await row(id);
    await proposeResult(db, Object.values(u).find((x) => x.id === r.settlerId)!, id, "yes", at(3));
    await runDueCalls(db, at(28));
    expect((await db.select().from(scores).where(eq(scores.callId, id))).length).toBe(2);

    await reportCall(db, u.Eve, id, "about_me", at(29));
    await reviewCall(db, u.Ada, id, "remove", at(30));
    const after = await row(id);
    expect(after).toMatchObject({ moderation: "removed", status: "void" });
    expect(await db.select().from(scores).where(eq(scores.callId, id))).toEqual([]);
    expect((await rankingFor(db, u.Cem, groupId, "all-time", at(30))).rows.find((x) => x.name === "Cem")!.points).toBe(0);
    expect((await inbox(db, u.Bo)).map((x) => x.text)).toContain("Your call in Mods was removed after a review.");
  });
});

describe("blocking", () => {
  it("hides their calls, mutes them, and stops them making calls about you", async () => {
    const { u, groupId } = await group();
    await blockUser(db, u.Cem, u.Bo.id, at(1));
    await createCall(db, u.Bo, groupId, { text: "Will the bus be late today?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, at(2));
    expect(await visibleTo(u.Cem, groupId)).not.toContain("Will the bus be late today?");
    expect(await visibleTo(u.Dee, groupId)).toContain("Will the bus be late today?");
    expect((await inbox(db, u.Cem)).some((x) => x.text.includes("bus be late"))).toBe(false);
    await expect(
      createCall(db, u.Bo, groupId, { text: "Will Cem be late again?", kind: "yes_no", subjectId: u.Cem.id, lockAt: at(24), eventAt: at(48) }, at(2)),
    ).rejects.toThrow(/can't make calls about this person/);

    await unblockUser(db, u.Cem, u.Bo.id);
    expect(await visibleTo(u.Cem, groupId)).toContain("Will the bus be late today?");
  });

  it("still shows a blocked person's call if you're the one settling it", async () => {
    const { u, groupId } = await group(["Ada", "Bo", "Cem"]);
    const id = await createCall(db, u.Bo, groupId, { text: "Will the pizza arrive hot?", kind: "yes_no", lockAt: at(2), eventAt: at(2) }, T0);
    await pick(db, u.Ada, id, "yes", at(1));
    await runDueCalls(db, at(2)); // Cem is the neutral settler
    expect((await row(id)).settlerId).toBe(u.Cem.id);
    await blockUser(db, u.Cem, u.Bo.id, at(3));
    expect(await visibleTo(u.Cem, groupId)).toContain("Will the pizza arrive hot?");
  });

  it("only works on people you share a group with", async () => {
    const { u } = await group();
    const stranger = (await signUp(db, "Stranger")).user;
    await expect(blockUser(db, u.Ada, stranger.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(blockUser(db, u.Ada, u.Ada.id)).rejects.toThrow(/can't block/);
  });
});

describe("removing members", () => {
  it("lets the admin remove someone, who can't rejoin until let back in", async () => {
    const { u, groupId, invite } = await group();
    await expect(removeMember(db, u.Bo, groupId, u.Cem.id)).rejects.toMatchObject({ code: "forbidden" });
    await removeMember(db, u.Ada, groupId, u.Cem.id, at(1));
    await expect(groupForMember(db, u.Cem, groupId)).rejects.toMatchObject({ code: "not_found" });
    await expect(joinGroup(db, u.Cem, invite, "Cem", "2.2.2.2", at(2))).rejects.toThrow(/removed you/);
    await allowBack(db, u.Ada, groupId, u.Cem.id);
    await joinGroup(db, u.Cem, invite, "Cem", "2.2.2.2", at(3));
  });
});

describe("deleting an account", () => {
  it("removes the person everywhere, hands over admin and takes down calls about them", async () => {
    const { u, tokens, groupId } = await group();
    const about = await createCall(db, u.Bo, groupId, { text: "Will Ada move abroad?", kind: "yes_no", subjectId: u.Ada.id, lockAt: at(24), eventAt: at(48) }, T0);
    const theirs = await createCall(db, u.Ada, groupId, { text: "Will the plants survive August?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);
    await pick(db, u.Ada, theirs, "yes", at(1));

    await deleteAccount(db, u.Ada, at(2));

    expect(await db.select().from(users).where(eq(users.id, u.Ada.id))).toEqual([]);
    expect(await userForSession(db, tokens.Ada, at(2))).toBeNull();
    const view = await groupForMember(db, u.Bo, groupId);
    expect(view.me.role).toBe("admin");
    expect(view.members.map((m) => m.displayName)).not.toContain("Ada");
    expect((await row(about)).moderation).toBe("removed");
    const kept = (await callsForMember(db, u.Bo, groupId, at(3))).find((c) => c.id === theirs)!;
    expect(kept.author).toBe("Former member");
    expect(kept.pickCount).toBe(0); // their pick went with them
  });

  it("works for someone who already left some groups", async () => {
    const { u, groupId } = await group(["Ada", "Bo"]);
    await leaveGroup(db, u.Bo, groupId, at(1));
    await deleteAccount(db, u.Bo, at(2));
    expect((await groupForMember(db, u.Ada, groupId)).members.map((m) => m.displayName)).toEqual(["Ada"]);
  });
});
