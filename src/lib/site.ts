/**
 * Public details shown on the legal and support pages. Set them in the host's environment:
 * SUPPORT_EMAIL (required before App Store submission), OPERATOR_NAME (who runs the service).
 */
export function siteInfo() {
  return {
    supportEmail: process.env.SUPPORT_EMAIL || null,
    operator: process.env.OPERATOR_NAME || "the Who’ll team",
    updated: "26 November 2026",
  };
}
