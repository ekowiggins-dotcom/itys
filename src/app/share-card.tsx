/**
 * Share card layouts for next/og (Satori). Satori supports a subset of CSS: every element with children
 * needs display:flex, and styles are inline.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const CARD_SIZE = { width: 1200, height: 630 };

type Font = { name: string; data: ArrayBuffer | Buffer; weight: 400 | 800; style: "normal" };
let fonts: Promise<Font[]> | undefined;

/** Inter regular + extra bold, Latin and Latin Extended (Turkish letters), loaded once. */
export function cardFonts(): Promise<Font[]> {
  const dir = join(process.cwd(), "node_modules/@fontsource/inter/files");
  return (fonts ??= Promise.all(
    (["latin", "latin-ext"] as const).flatMap((set) =>
      ([400, 800] as const).map(async (weight) => ({
        name: "Inter",
        data: await readFile(join(dir, `inter-${set}-${weight}-normal.woff`)),
        weight,
        style: "normal" as const,
      })),
    ),
  ));
}

const BG = "#17201b";
const CARD = "#1f2a24";
const TEXT = "#eef2ef";
const MUTED = "#9aa8a0";
const ACCENT = "#43b78a";

function Frame({ children, footer }: { children: React.ReactNode; footer: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: 64, color: TEXT, fontFamily: "Inter" }}>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: TEXT }}>Who’ll</div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{footer}</div>
    </div>
  );
}

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function ResultCard(p: { text: string; answer: string; rightCount: number; pickers: number; sharerName: string; sharerCalledIt: boolean | null; sharerPoints: number | null }) {
  const headline =
    p.sharerCalledIt === true
      ? `${p.sharerName} called it${p.sharerPoints ? ` · +${p.sharerPoints}` : ""} 🏆`
      : p.sharerCalledIt === false
        ? `${p.sharerName} didn’t see it coming`
        : `Shared by ${p.sharerName}`;
  return (
    <Frame footer="Friendly predictions with friends · free points, no money">
      <div style={{ display: "flex", fontSize: 30, color: ACCENT, fontWeight: 700, marginBottom: 20 }}>{headline}</div>
      <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.15, marginBottom: 32 }}>{clamp(p.text, 110)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", background: ACCENT, color: BG, borderRadius: 999, padding: "14px 32px", fontSize: 40, fontWeight: 800 }}>
          {clamp(p.answer, 30)}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: MUTED }}>
          {p.rightCount} of {p.pickers} called it
        </div>
      </div>
    </Frame>
  );
}

export function InviteCard(p: { name: string; memberCount: number }) {
  return (
    <Frame footer="Join and make your calls · free points, no money">
      <div style={{ display: "flex", fontSize: 34, color: ACCENT, fontWeight: 700, marginBottom: 16 }}>You’re invited</div>
      <div style={{ display: "flex", fontSize: 76, fontWeight: 800, marginBottom: 24 }}>{clamp(p.name, 40)}</div>
      <div style={{ display: "flex", background: CARD, borderRadius: 24, padding: "16px 28px", fontSize: 34, color: TEXT, alignSelf: "flex-start" }}>
        {p.memberCount} {p.memberCount === 1 ? "person" : "people"} making calls
      </div>
    </Frame>
  );
}

export function GenericCard() {
  return (
    <Frame footer="Free points, no money, just bragging rights">
      <div style={{ display: "flex", fontSize: 72, fontWeight: 800 }}>Call it before it happens.</div>
    </Frame>
  );
}
