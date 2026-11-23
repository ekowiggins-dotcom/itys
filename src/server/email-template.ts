/**
 * Branded emails: one simple layout (wordmark, a short message, one button, a footer), as HTML and plain text.
 * Inline styles and tables only, because many email apps ignore everything else.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type EmailContent = {
  /** Shown as the inbox preview line. */
  preview: string;
  heading: string;
  body: string;
  button: { label: string; url: string };
  footer: string;
};

export function renderEmail(c: EmailContent) {
  const text = `${c.heading}\n\n${c.body}\n\n${c.button.label}: ${c.button.url}\n\n${c.footer}\n`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f3ec;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ec;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:2px solid #17201b;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;font:700 24px/1 Arial,Helvetica,sans-serif;color:#17201b;">
<span style="display:inline-block;background:#17201b;color:#d7f25a;border-radius:8px;padding:4px 8px;margin-right:8px;">w</span>Who’ll
</td></tr>
<tr><td style="padding:16px 28px 0;font:700 22px/1.3 Arial,Helvetica,sans-serif;color:#17201b;">${esc(c.heading)}</td></tr>
<tr><td style="padding:12px 28px 0;font:16px/1.5 Arial,Helvetica,sans-serif;color:#2b362f;">${esc(c.body)}</td></tr>
<tr><td style="padding:24px 28px 28px;">
<a href="${esc(c.button.url)}" style="display:inline-block;background:#d7f25a;color:#17201b;border:2px solid #17201b;border-radius:999px;padding:14px 26px;font:700 16px/1 Arial,Helvetica,sans-serif;text-decoration:none;">${esc(c.button.label)}</a>
</td></tr>
</table>
<p style="max-width:480px;margin:16px auto 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#5e675f;">${esc(c.footer)}</p>
</td></tr></table>
</body></html>`;
  return { text, html };
}
