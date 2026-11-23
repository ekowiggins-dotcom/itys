/**
 * Colours for groups and people. Shared by the app and the share cards, and safe to import anywhere
 * (no server code).
 */

/** The colours a group can pick when it's created. */
export const GROUP_COLORS = {
  coral: "#FF8A5B",
  sky: "#7CC0FF",
  violet: "#B9A2FF",
  mint: "#5FDDA6",
  sun: "#FFC94D",
  pink: "#FF8EC2",
  teal: "#1E9E94",
} as const;
export type GroupColor = keyof typeof GROUP_COLORS;
export const GROUP_COLOR_KEYS = Object.keys(GROUP_COLORS) as GroupColor[];

/** People's colours. Within a group they follow join order, so friends never share one. */
export const FACE_COLORS = [
  "#FF8A5B",
  "#6FB7FF",
  "#A98BFF",
  "#4FD39A",
  "#FFC145",
  "#FF7EB6",
  "#3FBFB3",
  "#D9A877",
  "#B5E06B",
  "#8E9BB0",
] as const;

/** The face colour closest to each group colour, left out of that group's faces so a face never melts into it. */
const NEAREST_FACE: Record<GroupColor, string> = {
  coral: "#FF8A5B",
  sky: "#6FB7FF",
  violet: "#A98BFF",
  mint: "#4FD39A",
  sun: "#FFC145",
  pink: "#FF7EB6",
  teal: "#3FBFB3",
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return h;
}

/** A group's colour: the one it picked, or one derived from its id for groups made before colours existed. */
export function groupColorKey(color: string | null | undefined, seed: string): GroupColor {
  if (color && color in GROUP_COLORS) return color as GroupColor;
  return GROUP_COLOR_KEYS[hash(seed) % GROUP_COLOR_KEYS.length];
}

export function facePalette(group?: GroupColor | null): string[] {
  if (!group) return [...FACE_COLORS];
  return FACE_COLORS.filter((c) => c !== NEAREST_FACE[group]);
}

/** Colour for the person at `index` in the group's join order. */
export function faceColor(index: number, group?: GroupColor | null) {
  const p = facePalette(group);
  return p[((index % p.length) + p.length) % p.length];
}

/** Colours for every member (by user id), from the group's members in join order. */
export function faceColors(memberIdsInJoinOrder: string[], group?: GroupColor | null): Record<string, string> {
  return Object.fromEntries(memberIdsInJoinOrder.map((id, i) => [id, faceColor(i, group)]));
}

/** One or two initials, Unicode-safe ("Ömer Şahin" → "ÖŞ"). */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0];
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
  return (first + last).toLocaleUpperCase("tr");
}
