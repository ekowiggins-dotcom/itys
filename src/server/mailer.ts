/**
 * Sends email. With RESEND_API_KEY set it goes out through Resend; otherwise (development) the message is
 * printed to the server console instead.
 */
export type SendEmail = (to: string, subject: string, text: string) => Promise<void>;

export const sendEmail: SendEmail = async (to, subject, text) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required in production.");
    console.info(`\n[dev email] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Who'll <login@example.com>", to, subject, text }),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
};

export async function sendLoginEmail(email: string, link: string): Promise<void> {
  await sendEmail(
    email,
    "Your sign-in link",
    `Tap to sign in to Who'll:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
  );
}
