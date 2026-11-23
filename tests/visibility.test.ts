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
  ["member, settled", { lockAt: after, status: "settled" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true, canSeeWhoPicked: true, canSeeVoteTally: true, canShare: true }],
  ["member, cancelled", { lockAt: before, status: "cancelled" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeeOwnPick: true }],
  ["member, void", { lockAt: after, status: "void" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeVoteTally: true }],
  ["member, result proposed", { lockAt: after, status: "proposed" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true }],
  ["member, vote running", { lockAt: after, status: "disputed" }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true }],
  ["subject, open", { lockAt: before, subjectId: SUBJECT }, { userId: SUBJECT, isMember: true }, { canSeeCall: true, canSeePickCount: true }],
  ["subject, locked", { lockAt: after, subjectId: SUBJECT }, { userId: SUBJECT, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeSplit: true }],
  ["non-member, open", { lockAt: before }, { userId: ME, isMember: false }, {}],
  ["non-member, settled", { lockAt: after, status: "settled" }, { userId: ME, isMember: false }, {}],
  ["member, hidden for review", { lockAt: before, moderation: "hidden" }, { userId: ME, isMember: true }, {}],
  ["member, removed after settling", { lockAt: after, status: "settled", moderation: "removed" }, { userId: ME, isMember: true }, {}],
  ["subject, hidden", { lockAt: after, subjectId: SUBJECT, moderation: "hidden" }, { userId: SUBJECT, isMember: true }, {}],
  ["member, settled call about someone else", { lockAt: after, status: "settled", subjectId: SUBJECT }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true, canSeeWhoPicked: true, canSeeVoteTally: true }],
  ["subject, settled call about them", { lockAt: after, status: "settled", subjectId: SUBJECT }, { userId: SUBJECT, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeSplit: true, canSeeWhoPicked: true, canSeeVoteTally: true, canShare: true }],
  ["member, settled 'who' call naming someone else", { lockAt: after, status: "settled", kind: "member", result: SUBJECT }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true, canSeeWhoPicked: true, canSeeVoteTally: true }],
  ["member named by a settled 'who' call", { lockAt: after, status: "settled", kind: "member", result: ME }, { userId: ME, isMember: true }, { canSeeCall: true, canSeePickCount: true, canSeeOwnPick: true, canSeeSplit: true, canSeeWhoPicked: true, canSeeVoteTally: true, canShare: true }],
  ["signed out, settled", { lockAt: after, status: "settled" }, { userId: null, isMember: false }, {}],
];

const NONE: CallVisibility = {
  canSeeCall: false,
  canSeePickCount: false,
  canSeeOwnPick: false,
  canSeeSplit: false,
  canSeeWhoPicked: false,
  canSeeVoteTally: false,
  canPick: false,
  canShare: false,
};

describe("callVisibility", () => {
  it.each(table)("%s", (_name, call, viewer, expected) => {
    const state: CallState = { lockAt: before, status: "active", subjectId: null, moderation: "visible", ...call };
    expect(callVisibility(state, viewer, now)).toEqual({ ...NONE, ...expected });
  });

  it("closes exactly at lock time", () => {
    const v = callVisibility({ lockAt: now, status: "active", subjectId: null, moderation: "visible" }, { userId: ME, isMember: true }, now);
    expect(v.canPick).toBe(false);
    expect(v.canSeeSplit).toBe(true);
  });
});
