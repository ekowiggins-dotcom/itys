/** Words for call invites, shared by the invite page, its preview picture and the share sheet. */

/** "Burcu has picked…", "Burcu and Fehmi have picked…", "Burcu, Fehmi and 2 more have picked…". */
export function pickersLine(names: string[]) {
  if (names.length === 0) return "Nobody has picked yet. Be the first.";
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  return `${who} ${names.length === 1 ? "has" : "have"} picked. We’re not saying who.`;
}

/** The message that goes with the link in WhatsApp (the link brings its own picture). */
export function inviteMessage(callText: string) {
  return `${callText} Make your pick on Who’ll 👀`;
}
