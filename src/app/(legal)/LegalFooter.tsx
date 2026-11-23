import Link from "next/link";

/** Links to the public pages, for the landing, login and settings screens. */
export function LegalFooter() {
  return (
    <p className="legal-footer small muted">
      <Link href="/support">Help</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
    </p>
  );
}
