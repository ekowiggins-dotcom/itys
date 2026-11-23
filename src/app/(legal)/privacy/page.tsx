import type { Metadata } from "next";
import Link from "next/link";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy · Who’ll" };

export default function Privacy() {
  const { supportEmail, operator, updated } = siteInfo();
  return (
    <article className="legal">
      <h1>Privacy</h1>
      <p className="muted small">Last updated {updated}</p>
      <p>
        Who’ll is a game of friendly predictions inside private groups. It’s run by {operator}. This page says what we
        keep, why, and how to delete it. In short: only what the game needs, no ads, no tracking, no selling.
      </p>

      <h2>What we keep</h2>
      <ul>
        <li><strong>Your email address</strong>, to sign you in with a link. We never show it to other people.</li>
        <li><strong>Your name</strong>, and the name you use in each group, so friends know who’s who.</li>
        <li><strong>What you do in groups</strong>: calls you make, your picks, results you enter, disputes and votes, reports and blocks. Your group sees calls and, after a call is settled, who picked what. Before picks close, nobody sees how anyone picked.</li>
        <li><strong>Points and rankings</strong>, worked out from settled calls.</li>
        <li><strong>Notifications</strong> we’ve sent you, and whether you’ve read them.</li>
        <li><strong>Your phone’s push token</strong>, if you allow notifications in the iOS app, tied to the sign-in that registered it.</li>
        <li><strong>Technical data</strong>: a sign-in session (stored as a fingerprint, not the session itself), and your IP address for at most two days, only to stop abuse (rate limits).</li>
      </ul>

      <h2>What we don’t do</h2>
      <ul>
        <li>No ads, no analytics or tracking tools, no selling or sharing your data for marketing.</li>
        <li>No money: points can’t be bought, spent, traded or cashed out, and there are no prizes.</li>
        <li>Shared result links show the call, the answer, how many called it and the sharer’s own result. Never anyone else’s name or pick, or the group’s name.</li>
      </ul>

      <h2>Who helps us run it</h2>
      <ul>
        <li><strong>Railway</strong> hosts the app and its database.</li>
        <li><strong>Resend</strong> sends sign-in and alert emails.</li>
        <li><strong>Apple</strong> delivers push notifications to the iOS app.</li>
      </ul>
      <p>They only process data to provide these services to us.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Turn email alerts off in <Link href="/settings">Settings</Link>, and notifications off in your phone’s settings.</li>
        <li>Hide a call about you with one tap; report or block anyone.</li>
        <li>
          <strong>Delete your account</strong> in <Link href="/settings">Settings</Link>. It removes your account, names,
          picks, votes, points, notifications and sign-in links straight away, and takes down calls about you. Calls you
          wrote stay for your friends, shown as by “Former member”.
        </li>
      </ul>

      <h2>Children</h2>
      <p>Who’ll isn’t meant for children under 13, and we don’t knowingly keep their data.</p>

      <h2>Questions</h2>
      <p>
        {supportEmail ? (
          <>Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</>
        ) : (
          <>See <Link href="/support">Help</Link>.</>
        )}
      </p>
    </article>
  );
}
