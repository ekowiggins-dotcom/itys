/**
 * Sends email. With RESEND_API_KEY set it goes out through Resend; otherwise (development) the message is
 * printed to the server console instead.
 */
export type SendEmail = (to: string, subject: string, text: string, html?: string) => Promise<void>;

export const sendEmail: SendEmail = async (to, subject, text, html) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required in production.");
    console.info(`\n[dev email] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Who'll <login@example.com>", to, subject, text, ...(html ? { html } : {}) }),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
};
