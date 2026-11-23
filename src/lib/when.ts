/**
 * Friendly times in a group's time zone: "Today 21:00", "Tomorrow 12:34", "Fri 14:00", "24 Nov, 14:00",
 * and short countdowns ("in 3h 20m"). Safe to import anywhere.
 */

const DAY = 86_400_000;

/** The calendar day number of an instant in a time zone (days since 1970-01-01 local). */
function dayNumber(d: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [y, m, day] = p.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / DAY);
}

export function friendlyTime(at: Date, now: Date, timeZone: string, locale = "en-GB") {
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(at);
  const diff = dayNumber(at, timeZone) - dayNumber(now, timeZone);
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff === -1) return `Yesterday ${time}`;
  if (diff > 1 && diff < 7) {
    return `${new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(at)} ${time}`;
  }
  const date = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short" }).format(at);
  return `${date}, ${time}`;
}

/** "in 45m", "in 3h 20m", "in 2d"; past times give "now". */
export function countdown(at: Date, now: Date) {
  const ms = at.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `in ${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
  return `in ${Math.round(h / 24)}d`;
}

/** How urgent a deadline is, for colouring chips: soon (under 6 hours), later, or past. */
export function urgency(at: Date, now: Date): "soon" | "later" | "past" {
  const ms = at.getTime() - now.getTime();
  if (ms <= 0) return "past";
  return ms < 6 * 3_600_000 ? "soon" : "later";
}
