import { initials } from "@/lib/faces";

/** A person as a coloured circle with initials. Colour comes from the group (see lib/faces.ts). */
export function Avatar({ name, color, size = 32, me = false }: { name: string; color?: string; size?: number; me?: boolean }) {
  return (
    <span
      className={`avatar${me ? " me" : ""}`}
      style={{ "--size": `${size}px`, background: color ?? "var(--surface-2)" } as React.CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping faces, e.g. the people in a group. Shows "+N" past `max`. */
export function Faces({ people, size = 28, max = 5 }: { people: { name: string; color?: string }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="faces" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} color={p.color} size={size} />
      ))}
      {extra > 0 && (
        <span className="avatar more" style={{ "--size": `${size}px` } as React.CSSProperties} aria-hidden="true">
          +{extra}
        </span>
      )}
    </span>
  );
}
