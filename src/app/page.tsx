import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LegalFooter } from "./(legal)/LegalFooter";
import { WebOnly } from "./components/WebOnly";
import { currentUser, isAppRequest } from "@/server/session";
import { appBannerMeta, APP_STORE_URL } from "@/lib/app-client";
import { FREE_MEMBERS, MAX_WITH_PRO, proLimitsOn } from "@/server/subscriptions";


export const metadata: Metadata = {
  title: "Who’ll: call it before it happens",
  description:
    "Friendly predictions about your group’s plans and life. Make a call, everyone picks, and points go to whoever called it. Free points, no money, just bragging rights.",
  openGraph: {
    title: "Who’ll: call it before it happens",
    description: "Friendly predictions with your friends. Free points, no money, just bragging rights.",
    type: "website",
    images: ["/brand/og.png"],
  },
  // Safari on iPhone shows a "Get the app" banner at the top.
  other: appBannerMeta(),
};

function Phone({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="phone">
      <Image src={src} alt={alt} width={660} height={1434} sizes="(min-width: 860px) 300px, 260px" priority={priority} />
    </div>
  );
}

function GetIt() {
  return (
    <div className="mk-ctas">
      <WebOnly>
        <a href={APP_STORE_URL} className="btn">
          Download for iPhone
        </a>
      </WebOnly>
    </div>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Make a call",
    text: "“Who’ll be late on Saturday?” “Will the landlord fix the heating by Friday?” Yes/no, a few options, or pick a friend.",
  },
  {
    n: "2",
    title: "Everyone picks",
    text: "Picks stay hidden until they close, so nobody just follows the crowd. Then the split is revealed.",
  },
  {
    n: "3",
    title: "Call it",
    text: "Someone neutral enters what happened. Friends can dispute it and vote. Right picks score points.",
  },
];

const FAQ = [
  {
    q: "Is it free?",
    a: proLimitsOn()
      ? `Yes. Groups of up to ${FREE_MEMBERS} people are free. For bigger groups (up to ${MAX_WITH_PRO}), the person who made the group can get Who’ll Pro; everyone else still plays free. Points are always free.`
      : "Yes. Make a group, invite your friends and play. Points are free.",
  },
  {
    q: "Is there money involved?",
    a: "No. Points are only earned by being right. They can’t be bought, spent, traded or cashed out, and there are no prizes. It’s for bragging rights.",
  },
  {
    q: "How do points work?",
    a: "A right pick scores 10 to 40 points: the fewer people who saw it coming, the more you get. Rankings sort by average points per call, every week and all time.",
  },
  {
    q: "What if a call is about me?",
    a: "Calls about a person always tag a real member of the group, who doesn’t pick on it and can hide it with one tap. Anyone can report a call or block someone.",
  },
  {
    q: "Who can see my picks?",
    a: "Only your group, and only after picks close. Groups are private: people outside a group can’t see anything in it.",
  },
  {
    q: "Is there an Android version?",
    a: "Not yet: Who’ll is an iPhone app for now. You sign in inside the app with your Apple ID.",
  },
];

/** The public home page. Signed-in people go straight to their groups. */
export default async function Home() {
  if (await currentUser()) redirect("/groups");
  // In the app, signed-out people go straight to sign-in.
  if (await isAppRequest()) redirect("/login");
  return (
    <div className="marketing">
      <section className="mk-hero">
        <div className="mk-hero-copy">
          <p className="mk-eyebrow">For friend groups, flatmates and families</p>
          <h1 className="mk-title">Call it before it happens.</h1>
          <p className="mk-lede">
            Friendly predictions about your group’s plans and life. Make a call, everyone picks, and points go to whoever
            saw it coming. No money, no prizes, just bragging rights.
          </p>
          <GetIt />
        </div>
        <div className="mk-hero-phone">
          <Phone src="/marketing/1-your-turn.jpg" alt="A group’s calls in Who’ll: “Will Cem cook dinner this week?” waiting for picks" priority />
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG */}
          <img src="/brand/stamp-lime.svg" alt="" className="mk-stamp" />
        </div>
      </section>

      <section className="mk-section" aria-labelledby="how">
        <h2 id="how" className="mk-h2">
          How it works
        </h2>
        <ol className="mk-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="card mk-step">
              <span className="mk-step-n" aria-hidden="true">
                {s.n}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mk-feature">
        <Phone src="/marketing/2-make-a-call.jpg" alt="Making a new call in Who’ll and choosing who it’s about" />
        <div>
          <h2 className="mk-h2">Calls about real life</h2>
          <p className="mk-lede">
            Dinner plans, exams, first dates, the group chat’s longest-running saga. Set when picks close and when the answer
            should be known, and Who’ll handles reminders, settling and disputes.
          </p>
        </div>
      </section>

      <section className="mk-feature reverse">
        <Phone src="/marketing/4-ranking.jpg" alt="The weekly ranking in Who’ll, with points per call" />
        <div>
          <h2 className="mk-h2">A ranking worth arguing about</h2>
          <p className="mk-lede">
            The fewer friends who saw it coming, the more a right call is worth. Weekly and all-time tables, a stamp when you
            call it, and a result card to share.
          </p>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="kind">
        <h2 id="kind" className="mk-h2">
          Kind by design
        </h2>
        <ul className="mk-points">
          <li>
            <strong>Private groups.</strong> Only members see a group. Invite links can be reset any time.
          </li>
          <li>
            <strong>Protect first.</strong> The person a call is about can hide it in one tap. Reported calls are hidden and
            reviewed.
          </li>
          <li>
            <strong>Points, not money.</strong> Nothing to buy, spend or cash out. Ever.
          </li>
        </ul>
      </section>

      <section className="mk-section" aria-labelledby="faq">
        <h2 id="faq" className="mk-h2">
          Questions
        </h2>
        <div className="mk-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="card">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mk-final">
        <h2 className="mk-h2">Who’ll call it first?</h2>
        <p className="mk-lede">Get the app, start a group in a minute and send the link to your friends.</p>
        <GetIt />
      </section>

      <LegalFooter />
    </div>
  );
}
