import { APP_STORE_URL } from "@/lib/app-client";

/**
 * Shown in a web browser where sign-in would be: Who'll is played in the iPhone app.
 * `invite`: the person came from an invite link, which opens in the app once it's installed.
 */
export function GetTheApp({ invite = false, title }: { invite?: boolean; title?: string }) {
  return (
    <div className="card get-app stack">
      {title && <h2 style={{ margin: 0 }}>{title}</h2>}
      <p style={{ margin: 0 }}>
        {invite
          ? "Who’ll is an iPhone app. Get it from the App Store, then tap your invite link again: it opens right in the app, where you sign in and join."
          : "Who’ll is an iPhone app. Signing in happens in the app."}
      </p>
      <a href={APP_STORE_URL} className="btn">
        Download for iPhone
      </a>
      <p className="muted small" style={{ margin: 0 }}>
        {invite
          ? "Already have Who’ll? Open this link from Messages or WhatsApp on your iPhone and it goes straight to the app."
          : "Already have it? Open Who’ll on your iPhone."}
      </p>
    </div>
  );
}
