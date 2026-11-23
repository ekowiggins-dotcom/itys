/**
 * Share card layouts for next/og (Satori), 1200x630. Satori supports a subset of CSS: every element with
 * children needs display:flex, and styles are inline.
 * Brand: the group's colour as the background, ink text, a lime "called it" stamp, Space Grotesk + DM Sans.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FACE_COLORS, initials } from "@/lib/faces";

export const CARD_SIZE = { width: 1200, height: 630 };

type Font = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fonts: Promise<Font[]> | undefined;

/** Space Grotesk (display) and DM Sans (text), Latin + Latin Extended for Turkish letters. Loaded once. */
export function cardFonts(): Promise<Font[]> {
  const root = process.cwd();
  const sg = (set: string) =>
    join(root, `assets/fonts/space-grotesk-${set}-700-normal.woff`);
  const dm = (set: string, w: number) =>
    join(
      root,
      `node_modules/@fontsource/dm-sans/files/dm-sans-${set}-${w}-normal.woff`,
    );
  const load = async (
    name: string,
    path: string,
    weight: 400 | 700,
  ): Promise<Font> => ({
    name,
    data: await readFile(path),
    weight,
    style: "normal",
  });
  return (fonts ??= Promise.all([
    load("Space Grotesk", sg("latin"), 700),
    load("Space Grotesk", sg("latin-ext"), 700),
    load("DM Sans", dm("latin", 400), 400),
    load("DM Sans", dm("latin-ext", 400), 400),
    load("DM Sans", dm("latin", 700), 700),
    load("DM Sans", dm("latin-ext", 700), 700),
  ]));
}

const INK = "#17201B";
const LIME = "#D7F25A";
const PAPER = "#F5F3EC";
const DISPLAY = "Space Grotesk";
const TEXT = "DM Sans";

const clamp = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

/** Long questions get a smaller size so they never overflow. */
const headlineSize = (text: string) =>
  text.length > 80 ? 54 : text.length > 50 ? 64 : 76;

function Frame({
  bg,
  children,
  left,
  right,
}: {
  bg: string;
  children: React.ReactNode;
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: bg,
        color: INK,
        fontFamily: TEXT,
        overflow: "hidden",
      }}
    >
      {/* A soft disc in the corner, like the old cards. */}
      <div
        style={{
          position: "absolute",
          right: -160,
          top: -200,
          width: 560,
          height: 560,
          borderRadius: 999,
          background: "rgba(255,255,255,0.22)",
          display: "flex",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "56px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 34,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 12,
              background: INK,
            }}
          >
            <svg width="30" height="26" viewBox="190 230 680 560">
              <path
                d="M270 430 L380 690 L492 486 L602 690 L780 250"
                fill="none"
                stroke={LIME}
                strokeWidth="110"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Who’ll
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          {children}
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
            {left}
          </div>
          {right ? (
            <div style={{ display: "flex", flexShrink: 0 }}>{right}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Face({
  name,
  color,
  size = 84,
}: {
  name?: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        border: `5px solid ${PAPER}`,
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: size * 0.42,
        color: INK,
      }}
    >
      {name ? initials(name) : ""}
    </div>
  );
}

function Pill({
  children,
  dark = true,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 32px",
        borderRadius: 999,
        background: dark ? INK : "rgba(255,255,255,0.55)",
        color: dark ? "#fff" : INK,
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: 36,
      }}
    >
      {children}
    </div>
  );
}

export type ResultCardProps = {
  text: string;
  answer: string;
  rightCount: number;
  pickers: number;
  sharerName: string;
  sharerCalledIt: boolean | null;
  sharerPoints: number | null;
  color: string;
  sharerColor: string;
};

export function ResultCard(p: ResultCardProps) {
  const won = p.sharerCalledIt === true && !!p.sharerPoints;
  return (
    <Frame
      bg={p.color}
      right={
        <Pill>
          <svg width="30" height="30" viewBox="0 0 24 24">
            <path
              d="M4 12.5l5 5L20 6.5"
              fill="none"
              stroke={LIME}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {clamp(p.answer, 22)}
        </Pill>
      }
      left={
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Face name={p.sharerName} color={p.sharerColor} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 34,
              }}
            >
              {won
                ? `${clamp(p.sharerName, 18)} called it`
                : p.sharerCalledIt === false
                  ? `${clamp(p.sharerName, 18)} missed this one`
                  : clamp(p.sharerName, 18)}
            </div>
            <div style={{ display: "flex", fontSize: 26 }}>
              {p.rightCount} of {p.pickers} friends called it
            </div>
          </div>
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: headlineSize(p.text),
          lineHeight: 1.06,
          letterSpacing: -2,
          maxWidth: won ? 740 : 1050,
        }}
      >
        {clamp(p.text, 120)}
      </div>
      {won && (
        <div
          style={{
            position: "absolute",
            right: 56,
            top: 120,
            width: 230,
            height: 230,
            borderRadius: 999,
            background: LIME,
            border: `8px solid ${INK}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-10deg)",
            boxShadow: `0 8px 0 ${INK}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: 4,
            }}
          >
            CALLED IT
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 76,
              lineHeight: 1,
            }}
          >
            +{p.sharerPoints}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: 3,
            }}
          >
            POINTS
          </div>
        </div>
      )}
    </Frame>
  );
}

/** Invite preview: the group's name and size (what the join page shows too), and anonymous faces. */
export function InviteCard({
  name,
  memberCount,
  color,
}: {
  name: string;
  memberCount: number;
  color: string;
}) {
  const shown = Math.min(memberCount, 7);
  return (
    <Frame
      bg={color}
      right={<Pill>Join →</Pill>}
      left={
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex" }}>
            {Array.from({ length: shown }, (_, i) => (
              <div key={i} style={{ display: "flex", marginLeft: i ? -22 : 0 }}>
                <Face color={FACE_COLORS[i % FACE_COLORS.length]} size={72} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
            {memberCount} {memberCount === 1 ? "friend is" : "friends are"}{" "}
            making calls
          </div>
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 34,
          marginBottom: 12,
        }}
      >
        You’re invited to
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: name.length > 20 ? 88 : 112,
          lineHeight: 1,
          letterSpacing: -3,
        }}
      >
        {clamp(name, 36)}
      </div>
    </Frame>
  );
}

export function GenericCard() {
  return (
    <Frame
      bg={LIME}
      left={
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
          Free points, no money, just bragging rights
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 96,
          lineHeight: 1,
          letterSpacing: -3,
          maxWidth: 900,
        }}
      >
        Call it before it happens.
      </div>
    </Frame>
  );
}
