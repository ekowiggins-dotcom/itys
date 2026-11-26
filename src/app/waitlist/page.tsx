import type { Metadata } from "next";
import { headers } from "next/headers";
import { WaitlistForm } from "./WaitlistForm";
import { pickLocale, WAITLIST_COPY } from "@/lib/waitlist-copy";

export async function generateMetadata({ searchParams }: PageProps<"/waitlist">): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = pickLocale(typeof lang === "string" ? lang : null, (await headers()).get("accept-language"));
  const t = WAITLIST_COPY[locale];
  return { title: `${t.title} · Who’ll`, description: `${t.lede} ${t.free}` };
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/**
 * Where the Instagram ads land: English or Turkish (?lang=tr, else the browser's language). The ad's tags
 * (?src= or utm_source, utm_campaign, utm_content) are kept with the sign-up so each ad can be measured.
 * No tracking scripts.
 */
export default async function Waitlist({ searchParams }: PageProps<"/waitlist">) {
  const q = await searchParams;
  const locale = pickLocale(one(q.lang), (await headers()).get("accept-language"));
  const t = WAITLIST_COPY[locale];
  return (
    <div lang={locale} className="waitlist">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG */}
      <img src="/brand/stamp-lime.svg" alt="" className="waitlist-stamp" />
      <h1>{t.title}</h1>
      <p className="mk-lede">{t.lede}</p>
      <p>
        <strong>{t.free}</strong>
      </p>
      <WaitlistForm
        locale={locale}
        source={one(q.src) ?? one(q.utm_source) ?? null}
        campaign={one(q.utm_campaign) ?? null}
        content={one(q.utm_content) ?? null}
      />
    </div>
  );
}
