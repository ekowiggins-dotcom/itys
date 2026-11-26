import type { Metadata } from "next";
import Link from "next/link";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Help · Who’ll" };

export default function Support() {
  const { supportEmail } = siteInfo();
  return (
    <article className="legal">
      <h1>Help</h1>
      {supportEmail && (
        <p className="card">
          Need a hand, found a bug, or want to report something urgent? Email{" "}
          <a href={`mailto:${supportEmail}`}>
            <strong>{supportEmail}</strong>
          </a>
          .
        </p>
      )}

      <h2>How does it work?</h2>
      <p>
        Someone in your group makes a call (“Who’ll be late on Saturday?”). Everyone picks before picks close. After it
        happens, one person enters the result, and anyone who picked has 24 hours to dispute it. A right call scores 10 to
        40 points: the fewer friends who saw it coming, the more it’s worth.
      </p>

      <h2>A call about me isn’t OK</h2>
      <p>Open the call’s “⋯” menu and choose “This is about me: hide it”. Nobody sees it while it’s reviewed.</p>

      <h2>Someone is being unkind</h2>
      <p>
        Report the call from its “⋯” menu, or block the person in the group’s People list. Blocking hides their calls
        from you and stops them making calls about you.
      </p>

      <h2>How do I sign in?</h2>
      <p>
        With Sign in with Apple, in the Who’ll app on your iPhone. You can choose to hide your email from us; your
        friends never see it either way.
      </p>

      <h2>Delete my account</h2>
      <p>
        Go to <Link href="/settings">Settings</Link> → Delete account. See <Link href="/privacy">Privacy</Link> for
        exactly what’s removed.
      </p>
    </article>
  );
}
