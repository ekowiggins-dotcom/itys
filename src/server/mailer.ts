import "server-only";

/**
 * Sends the sign-in email. With RESEND_API_KEY set it goes out through Resend; otherwise (development)
 * the link is printed to the server console instead.
 */
export async function sendLoginEmail(email: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required in production.");
    console.info(`\n[dev] Sign-in link for ${email}:\n${link}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Who'll <login@example.com>",
      to: email,
      subject: "Your sign-in link",
      text: `Tap to sign in to Who'll:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
}
