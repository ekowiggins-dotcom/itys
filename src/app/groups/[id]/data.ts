import { notFound } from "next/navigation";
import { cache } from "react";
import { callsForMember, type CallView } from "@/server/call-views";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { groupForMember } from "@/server/groups";
import { requireUser } from "@/server/session";
import { countdown, friendlyTime, urgency } from "@/lib/when";

/**
 * Group data for the layout and its tabs, loaded once per request (React cache).
 * Outsiders get the not-found page.
 */
export const loadGroup = cache(async (id: string) => {
  const user = await requireUser(`/groups/${id}`);
  try {
    const group = await groupForMember(await getDb(), user, id);
    return { user, group };
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
});

export type CallSections = {
  /** Things to do now: pick on, settle, check or vote. */
  turn: CallView[];
  /** You've picked (or can't), waiting for the result. */
  waiting: CallView[];
  /** Settled or called off, newest first. */
  results: CallView[];
};

export const loadCalls = cache(async (id: string) => {
  const { user } = await loadGroup(id);
  const calls = await callsForMember(await getDb(), user, id);
  const needsAction = (c: CallView) => c.canSettle || c.canDispute || c.canVote || (c.canPick && !c.myPick);
  const sections: CallSections = {
    turn: calls.filter(needsAction),
    waiting: calls.filter((c) => !needsAction(c) && ["active", "proposed", "disputed"].includes(c.status)),
    results: calls.filter((c) => c.status === "settled" || c.status === "void"),
  };
  const nextLock = calls
    .filter((c) => !c.locked && c.status === "active")
    .map((c) => c.lockAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return { calls, sections, nextLock: nextLock ?? null };
});

/** Friendly times for one call card, in the group's time zone. */
export function cardTimes(c: CallView, timeZone: string, now = new Date()) {
  const fmt = (d: Date) => friendlyTime(d, now, timeZone);
  return {
    lock: fmt(c.lockAt),
    event: fmt(c.eventAt),
    openToAll: fmt(c.openToAllAt),
    disputeEnds: c.disputeEndsAt ? fmt(c.disputeEndsAt) : null,
    voteCloses: c.voteClosesAt ? fmt(c.voteClosesAt) : null,
    lockUrgency: urgency(c.lockAt, now),
    lockCountdown: countdown(c.lockAt, now),
    /** For the stamp: "23 NOV". */
    settledStamp: c.settledAt
      ? new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "short" }).format(c.settledAt).toUpperCase()
      : null,
  };
}
