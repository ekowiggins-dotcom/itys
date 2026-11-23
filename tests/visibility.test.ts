import { describe, expect, it } from "vitest";
import { callVisibility, type CallState, type CallVisibility } from "@/server/visibility";

const now = new Date("2026-06-01T12:00:00Z");
const before = new Date(now.getTime() + 3600_000); // picks still open
const after = new Date(now.getTime() - 3600_000); // picks closed

const ME = "me";
const SUBJECT = "subject";

type Row = [string, Partial<CallState>, { userId: string | null; isMember: boolean }, Partial<CallVisibility>];

/**
 * Every role × state, and what they may see. When a leak is found, add the row that would have caught it.
 * Fields not listed in a row must be false.
 */
const table: Row[] = [
  ["member, open", { lockAt: before }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canPick: true }],
  ["member, locked", { lockAt: after }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true }],
  ["member, settled", { lockAt: after, status: "settled" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true, canSeeWhoPicked: true }],
  ["member, cancelled", { lockAt: before, status: "cancelled" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeeOwnPick: true }],
  ["member, void", { lockAt: after, status: "void" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true }],
  ["subject, open", { lockAt: before, subjectId: SUBJECT }, { userId: SUBJECT, isMember: true }, { canSeeCall: true, canSeePickCount: true }],
  ["subject, locked", { lockAt: after, subjectId: SUBJECT }, { userId: SUBJECT, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeSplit: true }],
  ["non-member, open", { lockAt: before }, { userId: ME, isMember: false }, {}],
  ["non-member, settled", { lockAt: after, status: "settled" }, { userId: ME, isMember: false }, {}],
  ["signed out, settled", { lockAt: after, status: "settled" }, { userId: null, isMember: false }, {}],
];

const NONE: CallVisibility = {
  canSeeCall: false,
  canSeePickCount: false,
  canSeeOwnPick: false,
  canSeeSplit: false,
  canSeeWhoPicked: false,
  canPick: false,
};

describe("callVisibility", () => {
  it.each(table)("%s", (_name, call, viewer, expected) => {
    const state: CallState = { lockAt: before, status: "active", subjectId: null, ...call };
    expect(callVisibility(state, viewer, now)).toEqual({ ...NONE, ...expected });
  });

  it("closes exactly at lock time", () => {
    const v = callVisibility({ lockAt: now, status: "active", subjectId: null }, { userId: ME, isMember: true }, now);
    expect(v.canPick).toBe(false);
    expect(v.canSeeSplit).toBe(true);
  });
});
