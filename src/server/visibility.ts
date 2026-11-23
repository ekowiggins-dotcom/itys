/**
 * THE one place that decides who may see what about a call. Every surface that shows call data
 * (group page, share links, notifications, widgets) must build its output from this.
 * The rules are tested as a table in tests/visibility.test.ts: a leak fix is a new row there.
 */
import type { CallStatus } from "./db/schema";

export type CallState = {
  lockAt: Date;
  status: CallStatus;
  subjectId: string | null;
  /** Hidden (under review) and removed calls are shown to nobody; reviewers use the review queue. */
  moderation: "visible" | "hidden" | "removed";
};

export type Viewer = {
  userId: string | null;
  /** Active member of the call's group. */
  isMember: boolean;
};

export type CallVisibility = {
  /** The call's text and options. */
  canSeeCall: boolean;
  /** How many people have picked ("4 of 6 picked"), never which answers. */
  canSeePickCount: boolean;
  /** Your own pick. */
  canSeeOwnPick: boolean;
  /** How the group split across answers. Only once picks are closed, so nobody can pick by the crowd. */
  canSeeSplit: boolean;
  /** Which person picked what. Only once the result is final. */
  canSeeWhoPicked: boolean;
  /** How a dispute vote went. Only once the vote is over, so nobody votes with the crowd. */
  canSeeVoteTally: boolean;
  /** Whether this viewer may pick or change their pick right now. */
  canPick: boolean;
};

export function isLocked(call: Pick<CallState, "lockAt">, now: Date) {
  return now.getTime() >= call.lockAt.getTime();
}

/** Calls that are still in play or settled show their split after lock; cancelled and void ones don't. */
const LIVE: CallStatus[] = ["active", "proposed", "disputed", "settled"];

export function callVisibility(call: CallState, viewer: Viewer, now: Date): CallVisibility {
  const member = viewer.isMember && viewer.userId !== null && call.moderation === "visible";
  const locked = isLocked(call, now);
  const isSubject = member && viewer.userId === call.subjectId;
  const final = call.status === "settled" || call.status === "void";

  return {
    canSeeCall: member,
    canSeePickCount: member && call.status !== "cancelled",
    canSeeOwnPick: member && !isSubject,
    canSeeSplit: member && LIVE.includes(call.status) && locked,
    canSeeWhoPicked: member && call.status === "settled",
    canSeeVoteTally: member && final,
    canPick: member && !isSubject && call.status === "active" && !locked,
  };
}
