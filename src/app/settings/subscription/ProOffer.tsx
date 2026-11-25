"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncSubscriptionAction } from "../../actions";
import { haptic, isNativeApp } from "../../NativeBridge";
import { periodLabel, storeKit, type StoreProduct } from "../../subscriptions-native";

/**
 * Buying Who'll Pro in the iOS app: the plans with their App Store prices, the free week for people who can
 * still get it, "Restore purchases", and the subscription terms Apple asks for next to the buy buttons.
 * On the website it explains that Pro is bought in the iPhone app.
 */
export function ProOffer({ userId, productIds, active }: { userId: string; productIds: string[]; active: boolean }) {
  const router = useRouter();
  /** "store": this app can buy; "old-app": an app build from before Pro; "web": the website. */
  const [where, setWhere] = useState<"store" | "old-app" | "web" | null>(null);
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});

  const ids = productIds.join(",");
  useEffect(() => {
    let gone = false;
    (async () => {
      const kit = (await storeKit())?.kit;
      if (gone) return;
      setWhere(kit ? "store" : isNativeApp() ? "old-app" : "web");
      if (!kit) return;
      try {
        const { products } = await kit.products({ ids: ids.split(",") });
        // Yearly first: it's the better deal.
        if (!gone) setProducts([...products].sort((a, b) => (a.periodUnit === "year" ? -1 : b.periodUnit === "year" ? 1 : 0)));
      } catch {
        if (!gone) setMessage({ error: "Couldn’t reach the App Store. Check your connection and try again." });
      }
    })();
    return () => {
      gone = true;
    };
  }, [ids]);

  async function buy(p: StoreProduct) {
    const kit = (await storeKit())?.kit;
    if (!kit) return;
    setBusy(p.id);
    setMessage({});
    try {
      const r = await kit.purchase({ id: p.id, appAccountToken: userId });
      if (r.status === "pending") setMessage({ ok: "Waiting for approval. Pro turns on as soon as it’s approved." });
      if (r.status === "purchased" && r.transaction) {
        const s = await syncSubscriptionAction({ transactions: [r.transaction], renewals: r.renewals ?? [] });
        if (s.error) setMessage({ error: s.error });
        else {
          setMessage({ ok: "You’ve got Who’ll Pro. Your groups can now have up to 20 people." });
          void haptic("success");
          router.refresh();
        }
      }
    } catch (e) {
      setMessage({ error: e instanceof Error && e.message ? e.message : "The purchase didn’t go through. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    const kit = (await storeKit())?.kit;
    if (!kit) return;
    setBusy("restore");
    setMessage({});
    try {
      const r = await kit.restore({ ids: productIds });
      if (r.cancelled) return;
      if (r.transactions.length === 0) {
        setMessage({ error: "No Who’ll Pro subscription was found for this Apple ID." });
        return;
      }
      const s = await syncSubscriptionAction({ ...r, restore: true });
      if (s.error) setMessage({ error: s.error });
      else if (s.active) {
        setMessage({ ok: "Restored. Who’ll Pro is on for this account." });
        router.refresh();
      } else setMessage({ error: "Your Who’ll Pro subscription has ended. You can subscribe again above." });
    } catch {
      setMessage({ error: "Couldn’t restore right now. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    const kit = (await storeKit())?.kit;
    try {
      if (kit) await kit.manage();
    } catch {
      location.href = "https://apps.apple.com/account/subscriptions";
    }
  }

  if (where === "old-app") {
    return <p className="small">Update Who’ll from the App Store to get Who’ll Pro.</p>;
  }
  if (where === "web") {
    return (
      <p className="small">
        Who’ll Pro is bought in the Who’ll app for iPhone: open it and go to <strong>Settings → Who’ll Pro</strong>. If
        you already have it, it works here too.
      </p>
    );
  }

  const trial = products?.find((p) => p.freeTrialDays)?.freeTrialDays;
  return (
    <div className="stack pro-offer">
      {active ? (
        <button type="button" className="secondary" onClick={manage}>
          Manage or cancel subscription
        </button>
      ) : products === null && !message.error ? (
        <p className="muted small" aria-live="polite">
          Loading prices…
        </p>
      ) : (
        products?.map((p) => (
          <button key={p.id} type="button" className={p.periodUnit === "year" ? undefined : "secondary"} disabled={!!busy} onClick={() => buy(p)}>
            {busy === p.id
              ? "…"
              : p.freeTrialDays
                ? `Try ${p.freeTrialDays === 7 ? "1 week" : `${p.freeTrialDays} days`} free, then ${p.displayPrice}/${periodLabel(p)}`
                : `${p.displayPrice} per ${periodLabel(p)}`}
          </button>
        ))
      )}
      <button type="button" className="link" disabled={!!busy} onClick={restore}>
        {busy === "restore" ? "Restoring…" : "Restore purchases"}
      </button>
      {message.error && (
        <p className="error" role="alert">
          {message.error}
        </p>
      )}
      {message.ok && (
        <p className="ok" role="status">
          {message.ok}
        </p>
      )}
      <p className="muted small">
        {trial ? "After the free week, payment" : "Payment"} is charged to your Apple ID. The subscription renews
        automatically at the same price unless you cancel at least 24 hours before the end of the current period. You can
        manage or cancel it in your iPhone’s Settings → your name → Subscriptions. Points stay free: Pro only lets your
        groups have more people. <Link href="/terms">Terms of Use</Link> · <Link href="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
}
