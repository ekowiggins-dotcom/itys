import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userForSession } from "@/server/auth";
import { callsForMember } from "@/server/call-views";
import type { Db } from "@/server/db/types";
import { myGroups } from "@/server/groups";
import { ensureReviewDemo, reviewConfig, reviewLogin } from "@/server/review";
import { testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});
afterEach(() => {
  delete process.env.REVIEW_EMAIL;
  delete process.env.REVIEW_CODE;
});

const CODE = "correct-horse-battery-staple";
const enable = () => {
  process.env.REVIEW_EMAIL = "Review@Example.com";
  process.env.REVIEW_CODE = CODE;
};

describe("App Review sign-in", () => {
  it("is off unless an email and a long code are configured", async () => {
    expect(reviewConfig()).toBeNull();
    process.env.REVIEW_EMAIL = "review@example.com";
    process.env.REVIEW_CODE = "short";
    expect(reviewConfig()).toBeNull();
    await expect(reviewLogin(db, "review@example.com", "short", "1.0.0.1")).rejects.toThrow(/isn't right/);
  });

  it("signs in only the configured email with the exact code", async () => {
    enable();
    await expect(reviewLogin(db, "someone@example.com", CODE, "1.0.0.2")).rejects.toThrow(/isn't right/);
    await expect(reviewLogin(db, "review@example.com", CODE + "x", "1.0.0.2")).rejects.toThrow(/isn't right/);
    const { sessionToken, user } = await reviewLogin(db, " REVIEW@example.com ", CODE, "1.0.0.2");
    expect(user.name).toBe("Reviewer");
    expect((await userForSession(db, sessionToken))?.id).toBe(user.id);
  });

  it("is rate-limited like normal sign-in", async () => {
    enable();
    for (let i = 0; i < 10; i++) await reviewLogin(db, "x@example.com", "nope", "1.0.0.3").catch(() => {});
    await expect(reviewLogin(db, "review@example.com", CODE, "1.0.0.3")).rejects.toThrow(/Too many/);
  });
});

describe("App Review demo group", () => {
  it("creates one demo group with something to pick, and a call the reviewer called right", async () => {
    enable();
    const now = new Date("2026-12-01T12:00:00Z");
    await ensureReviewDemo(db, now);
    await ensureReviewDemo(db, now); // idempotent
    const { user } = await reviewLogin(db, "review@example.com", CODE, "1.0.0.4", now);
    const groups = await myGroups(db, user);
    expect(groups.filter((g) => g.name === "App Review demo")).toHaveLength(1);
    const list = await callsForMember(db, user, groups[0].id, now);
    expect(list.some((c) => c.canPick)).toBe(true);
    const won = list.find((c) => c.text.includes("pizza"))!;
    expect(won.status).toBe("settled");
    expect(won.myPoints).toBeGreaterThan(0);
  });

  it("does nothing when review access isn't configured", async () => {
    await ensureReviewDemo(db);
    expect(reviewConfig()).toBeNull();
  });
});
