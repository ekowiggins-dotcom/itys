/**
 * THE one place that decides who may see what about a call. Every surface that shows call data
 * (group page, share links, notifications, audit, widgets) must build its output from this.
 * The rules are tested as a table in tests/visibility.test.ts: a leak fix is a new row there.
 */

export type CallState = {
  lockAt: Date;
  status: "active" | "cancelled" | "settled" | "void";
  subjectId: string | null;
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
  /** Which person picked what. Only once the result is in. */
  canSeeWhoPicked: boolean;
  /** Whether this viewer may pick or change their pick right now. */
  canPick: boolean;
};

export function isLocked(call: Pick<CallState, "lockAt">, now: Date) {
  return now.getTime() >= call.lockAt.getTime();
}

export function callVisibility(call: CallState, viewer: Viewer, now: Date): CallVisibility {
  const member = viewer.isMember && viewer.userId !== null;
  const locked = isLocked(call, now);
  const isSubject = member && viewer.userId === call.subjectId;
  const live = call.status === "active" || call.status === "settled";
  const finished = call.status === "settled";

  return {
    canSeeCall: member,
    canSeePickCount: member && call.status !== "cancelled",
    canSeeOwnPick: member && !isSubject,
    canSeeSplit: member && live && locked,
    canSeeWhoPicked: member && finished,
    canPick: member && !isSubject && call.status === "active" && !locked,
  };
}
