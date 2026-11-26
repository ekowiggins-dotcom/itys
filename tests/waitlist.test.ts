import { beforeAll, describe, expect, it } from "vitest";
import { waitlist } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { joinWaitlist, waitlistCsv, waitlistReport } from "@/server/waitlist";
import { pickLocale } from "@/lib/waitlist-copy";
import { testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});
let n = 0;
const ip = () => `10.9.${Math.floor(++n / 250)}.${n % 250}`;
const T0 = new Date("2026-11-26T10:00:00Z");

describe("the waitlist", () => {
  it("saves the email lower-cased with the language, group size and the ad it came from", async () => {
    await joinWaitlist(db, { email: "  Ada@Example.COM ", locale: "tr", groupSize: "5-8", source: "instagram", campaign: "launch", content: "reel-2" }, ip(), T0);
    const rows = await db.select().from(waitlist);
    expect(rows).toEqual([
      expect.objectContaining({ email: "ada@example.com", locale: "tr", groupSize: "5-8", source: "instagram", campaign: "launch", content: "reel-2" }),
    ]);
  });

  it("lets the same email sign up again without a second row or an error", async () => {
    await expect(joinWaitlist(db, { email: "ADA@example.com", locale: "en" }, ip(), T0)).resolves.toEqual({ ok: true });
    const rows = (await db.select().from(waitlist)).filter((r) => r.email === "ada@example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0].locale).toBe("tr"); // the first sign-up stays as it was
  });

  it("pretends to work for bots that fill the hidden field, and saves nothing", async () => {
    await expect(joinWaitlist(db, { email: "bot@example.com", locale: "en", website: "http://spam" }, ip(), T0)).resolves.toEqual({ ok: true });
    expect((await db.select().from(waitlist)).some((r) => r.email === "bot@example.com")).toBe(false);
  });

  it("refuses a bad email, ignores unknown group sizes and languages, and cleans ad tags", async () => {
    await expect(joinWaitlist(db, { email: "not-an-email", locale: "en" }, ip(), T0)).rejects.toThrow();
    await joinWaitlist(db, { email: "bo@example.com", locale: "fr" as "en", groupSize: "100" as "9+", source: "<script>ig</script>" }, ip(), T0);
    const bo = (await db.select().from(waitlist)).find((r) => r.email === "bo@example.com")!;
    expect(bo).toMatchObject({ locale: "en", groupSize: null, source: "scriptig/script" });
  });

  it("rate-limits sign-ups per IP", async () => {
    const same = "7.7.7.7";
    for (let i = 0; i < 10; i++) await joinWaitlist(db, { email: `many${i}@example.com`, locale: "en" }, same, T0);
    await expect(joinWaitlist(db, { email: "many10@example.com", locale: "en" }, same, T0)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("exports a CSV with counts by source and by group size, safe to open in a spreadsheet", async () => {
    await joinWaitlist(db, { email: "cem@example.com", locale: "en", groupSize: "9+", source: "instagram", campaign: "launch" }, ip(), T0);
    await joinWaitlist(db, { email: "+cmd@example.com", locale: "en" }, ip(), T0);
    const report = await waitlistReport(db);
    expect(report.byGroupSize).toEqual(expect.arrayContaining([{ groupSize: "5-8", n: 1 }, { groupSize: "9+", n: 1 }]));
    expect(report.bySource).toEqual(expect.arrayContaining([{ source: "instagram", campaign: "launch", n: 2 }]));
    const csv = waitlistCsv(report);
    expect(csv.split("\n")[0]).toBe("email,locale,group_size,source,campaign,content,created_at");
    expect(csv).toContain(`"'+cmd@example.com"`);
    expect(csv).toContain("source,campaign,signups");
    expect(csv).toContain("group_size,signups");
  });
});

describe("waitlist language", () => {
  it("is English unless the link says ?lang=tr", () => {
    expect(pickLocale("tr")).toBe("tr");
    expect(pickLocale("en")).toBe("en");
    expect(pickLocale(null)).toBe("en");
    expect(pickLocale("xx")).toBe("en");
  });
});
