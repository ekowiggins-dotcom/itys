// Every duration the game runs on, in one place.
// Practice groups run the same rules on a fast clock so a whole week can be tested in about an hour.
// They're only creatable when the server sets PRACTICE_GROUPS=1, and normal groups never use these values.
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

export type Timing = {
  practice: boolean;
  disputeMs: number;      // window to dispute a proposed result
  takeoverMs: number;     // after the event, when the admin may propose instead of the creator
  resolutionMs: number;   // after the event, when anything unresolved is voided
  lockReminderMs: number; // reminder before the first lock
  suggestionMs: number;   // when an empty Friends round gets a suggested call
  longTermMinMs: number;  // long-term calls must resolve at least this far ahead
};

export const NORMAL: Timing = { practice: false, disputeMs: DAY, takeoverMs: 2 * DAY, resolutionMs: 7 * DAY, lockReminderMs: HOUR, suggestionMs: 2 * DAY, longTermMinMs: 0 };
export const PRACTICE: Timing = { practice: true, disputeMs: 3 * MIN, takeoverMs: 3 * MIN, resolutionMs: 10 * MIN, lockReminderMs: 5 * MIN, suggestionMs: 10 * MIN, longTermMinMs: 15 * MIN };

/** Practice round: calls lock by +45 min, provisional standings at +50, next round at +60. */
export const PRACTICE_ROUND = { lockByMs: 45 * MIN, publishMs: 50 * MIN, nextMs: 60 * MIN };

export const timingFor = (practice?: boolean | null) => (practice ? PRACTICE : NORMAL);
export const practiceAllowed = (env: Record<string, string | undefined> = process.env) => env.PRACTICE_GROUPS === '1';
