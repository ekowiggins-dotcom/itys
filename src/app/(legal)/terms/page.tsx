import type { Metadata } from "next";
import Link from "next/link";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Terms · Who’ll" };

export default function Terms() {
  const { operator, updated } = siteInfo();
  return (
    <article className="legal">
      <h1>Terms</h1>
      <p className="muted small">Last updated {updated}</p>
      <p>By using Who’ll you agree to these terms. Who’ll is run by {operator}.</p>

      <h2>A free game, just for fun</h2>
      <ul>
        <li>
          Who’ll is free to play. An optional subscription, Who’ll Pro, lets groups you create have more people (see
          below). It never changes how points work.
        </li>
        <li>Points are only earned by being right and are just for fun.</li>
        <li>Points can’t be bought, spent, traded, transferred or exchanged for money, prizes or anything else.</li>
        <li>Don’t attach money, payments or prizes to calls or rankings, inside or outside the app.</li>
      </ul>

      <h2>Who’ll Pro (subscription)</h2>
      <ul>
        <li>
          Free groups have up to 4 people. With Who’ll Pro, every group you created can have up to 20. One subscription
          covers all of them; the people in them don’t pay.
        </li>
        <li>
          Pro is an auto-renewing subscription bought through Apple in the Who’ll iPhone app, monthly or yearly. The price
          is shown in the app before you buy. If you’re eligible, it starts with a free week.
        </li>
        <li>
          Payment is charged to your Apple ID when you confirm the purchase (or when the free week ends). It renews
          automatically for the same period and price unless you turn off auto-renew at least 24 hours before the end of
          the current period; your Apple ID is charged for the renewal within 24 hours before the end.
        </li>
        <li>
          Manage or cancel it at any time in your iPhone’s Settings → your name → Subscriptions. Cancelling stops the
          next renewal; Pro stays on until the end of the period you paid for. Refunds are handled by Apple under its
          policies. Deleting your Who’ll account doesn’t cancel the subscription, so cancel it at Apple first.
        </li>
        <li>
          If Pro ends, a group of yours with more than its free size is paused: nobody can make new calls or join until
          you subscribe again. Open calls carry on, nobody is removed and nothing is deleted.
        </li>
        <li>
          Apple’s{" "}
          <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Standard End User License Agreement</a>{" "}
          also applies to the iOS app.
        </li>
      </ul>

      <h2>Be kind</h2>
      <p>Calls are often about real people. Don’t post anything that:</p>
      <ul>
        <li>harasses, bullies, threatens or humiliates someone;</li>
        <li>is sexual, hateful or discriminatory;</li>
        <li>shares someone’s private information or things they wouldn’t want shared;</li>
        <li>breaks the law or encourages harm.</li>
      </ul>
      <p>
        The person a call is about can hide it at once, and anyone can report it. Reported calls are reviewed, and
        removed if they break these rules. A group’s admin can remove members. We may remove content or accounts that
        break these terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You sign in with your Apple ID, so keep it safe.</li>
        <li>You’re responsible for what you post. You keep ownership of it, and let us store and show it to your group so the game works.</li>
        <li>You can delete your account at any time in <Link href="/settings">Settings</Link>.</li>
      </ul>

      <h2>The service</h2>
      <p>
        We work to keep Who’ll running and your data safe, but it’s provided as is, without guarantees. We may change or
        stop features. As far as the law allows, we aren’t liable for indirect losses from using it. If these terms
        change, we’ll update this page and the date above.
      </p>

      <p>
        Questions? See <Link href="/support">Help</Link>.
      </p>
    </article>
  );
}
