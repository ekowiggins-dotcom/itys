/**
 * Time-zone helpers. Everything is stored in UTC; a group's time zone only decides where its weeks start.
 * Weeks run Monday 00:00 to the next Monday 00:00 in the group's time zone (DST-safe).
 */

/** Wall-clock parts of an instant in a time zone. */
function parts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday),
  };
}

/** The UTC offset (ms) of a time zone at an instant. */
function offsetAt(date: Date, timeZone: string) {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant of a wall-clock midnight (y-m-d 00:00) in a time zone. */
export function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - offsetAt(new Date(guess), timeZone);
  t = guess - offsetAt(new Date(t), timeZone); // second pass settles DST edges
  return new Date(t);
}

/** Start of the week (Monday 00:00 local) containing `date`. */
export function weekStart(date: Date, timeZone: string): Date {
  const p = parts(date, timeZone);
  const mondayUtc = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday));
  return zonedMidnight(mondayUtc.getUTCFullYear(), mondayUtc.getUTCMonth() + 1, mondayUtc.getUTCDate(), timeZone);
}

/** The week `offset` weeks from the one containing `date` (0 = this week, -1 = last week). */
export function weekRange(date: Date, timeZone: string, offset = 0) {
  const start = weekStart(date, timeZone);
  const p = parts(start, timeZone);
  const from = zonedMidnight(p.year, p.month, p.day + 7 * offset, timeZone);
  const q = parts(from, timeZone);
  const to = zonedMidnight(q.year, q.month, q.day + 7, timeZone);
  return { from, to };
}
