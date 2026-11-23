/** A small rounded label. Tones: soon (coral), later (violet), done (lime), or neutral. */
export function Chip({ children, tone }: { children: React.ReactNode; tone?: "soon" | "later" | "done" | "past" }) {
  return <span className={`chip${tone && tone !== "past" ? ` ${tone}` : ""}`}>{children}</span>;
}
