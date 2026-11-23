import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/session";
import { LegalFooter } from "./(legal)/LegalFooter";

export default async function Home() {
  if (await currentUser()) redirect("/groups");
  return (
    <section className="hero">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG */}
      <img src="/brand/stamp-lime.svg" alt="" className="hero-stamp" />
      <h1 className="hero-title">Call it before it happens.</h1>
      <p className="hero-text">
        Friendly predictions about your group&apos;s plans and life. Points are free and only earned by being right. No
        money, no prizes, just bragging rights.
      </p>
      <Link href="/login" className="btn">
        Get started
      </Link>
      <LegalFooter />
    </section>
  );
}
