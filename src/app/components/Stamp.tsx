/**
 * The "Called it" stamp for a call you got right: a rubber-stamp circle with your points in the middle.
 * Pure SVG, so it's crisp at any size and works in both themes. It thumps in once (CSS), unless the viewer
 * prefers reduced motion.
 */
export function CalledItStamp({ points, date, size = 112 }: { points: number; date: string; size?: number }) {
  return (
    <svg
      className="stamp"
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Called it: plus ${points} points`}
    >
      <defs>
        <path id="stamp-top" d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id="stamp-bottom" d="M 22 100 A 78 78 0 0 0 178 100" />
      </defs>
      <circle cx="100" cy="100" r="94" fill="var(--lime)" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--brand-ink)" strokeWidth="5" />
      <circle cx="100" cy="100" r="62" fill="none" stroke="var(--brand-ink)" strokeWidth="2.5" />
      <text className="stamp-ring" fill="var(--brand-ink)">
        <textPath href="#stamp-top" startOffset="50%" textAnchor="middle">
          WHO’LL
        </textPath>
      </text>
      <text className="stamp-ring" fill="var(--brand-ink)">
        <textPath href="#stamp-bottom" startOffset="50%" textAnchor="middle">
          CALLED IT
        </textPath>
      </text>
      <text x="100" y="108" textAnchor="middle" className="stamp-points" fill="var(--brand-ink)">
        +{points}
      </text>
      <text x="100" y="132" textAnchor="middle" className="stamp-date" fill="var(--brand-ink)">
        {date}
      </text>
      <circle cx="31" cy="100" r="4" fill="var(--brand-ink)" />
      <circle cx="169" cy="100" r="4" fill="var(--brand-ink)" />
    </svg>
  );
}
