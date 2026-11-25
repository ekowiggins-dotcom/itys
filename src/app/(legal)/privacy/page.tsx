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
        <li>
          <strong>Your Sign in with Apple details</strong>: the ID Apple gives us for you, and the email Apple shares
          (this can be a private relay address if you chose “Hide My Email”). In the app you can also sign in with an
          email link. We never show your email to other people.
        </li>
        <li>
          <strong>A Sign in with Apple token</strong>, so that when you delete your account we can also end Who’ll’s
          access at Apple.
        </li>
        <li><strong>Your name</strong>, and the name you use in each group, so friends know who’s who.</li>
        <li><strong>What you do in groups</strong>: calls you make, your picks, results you enter, disputes and votes, reports and blocks. Your group sees calls and, after a call is settled, who picked what. Before picks close, nobody sees how anyone picked.</li>
        <li><strong>Points and rankings</strong>, worked out from settled calls.</li>
        <li>
          <strong>Your Who’ll Pro subscription</strong>, if you buy one: Apple tells us which plan, its transaction
          numbers, when it started, renews or ends, whether it will renew, and any refund. The app gives Apple your
          Who’ll account ID at purchase so we know whose it is. Payment happens at Apple: we never see your card or
          payment details.
        </li>
        <li><strong>Notifications</strong> we’ve sent you, and whether you’ve read them.</li>
        <li><strong>Your phone’s push token</strong>, if you allow notifications in the iOS app, tied to the sign-in that registered it.</li>
        <li><strong>Technical data</strong>: a sign-in session (stored as a fingerprint, not the session itself), and your IP address for at most two days, only to stop abuse (rate limits).</li>
      </ul>

      <h2>What we don’t do</h2>
      <ul>
        <li>No ads, no analytics or tracking tools, no selling or sharing your data for marketing.</li>
        <li>No money in the game: points can’t be bought, spent, traded or cashed out, and there are no prizes.</li>
      </ul>

      <h2>Links you share</h2>
      <ul>
        <li>
          <strong>Result links</strong> show the call, the answer, how many called it and the sharer’s own result.
          Never anyone else’s name or pick, or the group’s name.
        </li>
        <li>
          <strong>Call invites</strong> (sharing a call that’s still open, to invite friends) show the group’s name and
          size, the call and its options, and the names of who has picked so far. Never what anyone picked. On a “who”
          call the options are the group members’ names. An invite stops working once picks close, the call is removed,
          or the person who shared it leaves the group.
        </li>
      </ul>

      <h2>Who helps us run it</h2>
      <ul>
        <li><strong>Railway</strong> hosts the app and its database.</li>
        <li><strong>Resend</strong> sends sign-in and alert emails.</li>
        <li>
          <strong>Apple</strong> runs Sign in with Apple, delivers push notifications to the iOS app, and sells and bills
          Who’ll Pro subscriptions.
        </li>
      </ul>
      <p>They only process data to provide these services to us.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Turn email alerts off in <Link href="/settings">Settings</Link>, and notifications off in your phone’s settings.</li>
        <li>Hide a call about you with one tap; report or block anyone.</li>
        <li>
          <strong>Delete your account</strong> in <Link href="/settings">Settings</Link>. It removes your account, names,
          picks, votes, points, notifications, sign-in links and subscription records straight away, ends Who’ll’s access to your Apple sign-in,
          and takes down calls about you. Calls you wrote stay for your friends, shown as by “Former member”. Call
          invites you shared stop working. A Who’ll Pro subscription is billed by Apple, so cancel it there too.
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
