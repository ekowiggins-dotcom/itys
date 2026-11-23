import { describe, expect, it } from "vitest";
import { faceColor, faceColors, facePalette, GROUP_COLORS, groupColorKey, initials } from "@/lib/faces";
import { countdown, friendlyTime, urgency } from "@/lib/when";

describe("faces", () => {
  it("gives friends in a group different colours, in join order", () => {
    const colors = Object.values(faceColors(["a", "b", "c", "d"], "violet"));
    expect(new Set(colors).size).toBe(4);
  });

  it("never uses the face colour closest to the group's own colour", () => {
    expect(facePalette("coral")).not.toContain("#FF8A5B");
    expect(faceColor(0, "coral")).not.toBe(GROUP_COLORS.coral);
  });

  it("derives a stable colour for groups without one, and keeps a picked one", () => {
    expect(groupColorKey(null, "group-1")).toBe(groupColorKey(null, "group-1"));
    expect(groupColorKey("teal", "x")).toBe("teal");
    expect(groupColorKey("not-a-colour", "x")).toMatch(/^(coral|sky|violet|mint|sun|pink|teal)$/);
  });

  it("makes initials, including Turkish letters", () => {
    expect(initials("ada")).toBe("A");
    expect(initials("Ömer Şahin")).toBe("ÖŞ");
    expect(initials("  ")).toBe("?");
    expect(initials("ilknur")).toBe("İ"); // Turkish capital dotted I
  });
});

describe("friendly times", () => {
  const tz = "Europe/Istanbul"; // UTC+3
  const now = new Date("2026-11-23T09:00:00Z"); // Mon 12:00 in Istanbul

  it("uses today, tomorrow, yesterday and weekdays in the group's time zone", () => {
    expect(friendlyTime(new Date("2026-11-23T18:00:00Z"), now, tz)).toBe("Today 21:00");
    expect(friendlyTime(new Date("2026-11-23T21:30:00Z"), now, tz)).toBe("Tomorrow 00:30"); // after local midnight
    expect(friendlyTime(new Date("2026-11-22T18:00:00Z"), now, tz)).toBe("Yesterday 21:00");
    expect(friendlyTime(new Date("2026-11-27T11:00:00Z"), now, tz)).toBe("Fri 14:00");
    expect(friendlyTime(new Date("2026-12-24T11:00:00Z"), now, tz)).toBe("24 Dec, 14:00");
  });

  it("counts down and rates urgency", () => {
    expect(countdown(new Date(now.getTime() + 45 * 60_000), now)).toBe("in 45m");
    expect(countdown(new Date(now.getTime() + 200 * 60_000), now)).toBe("in 3h 20m");
    expect(countdown(new Date(now.getTime() + 3 * 86_400_000), now)).toBe("in 3d");
    expect(countdown(new Date(now.getTime() - 1000), now)).toBe("now");
    expect(urgency(new Date(now.getTime() + 2 * 3_600_000), now)).toBe("soon");
    expect(urgency(new Date(now.getTime() + 20 * 3_600_000), now)).toBe("later");
    expect(urgency(new Date(now.getTime() - 1), now)).toBe("past");
  });
});
