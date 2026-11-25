"use client";

import { isNativeApp } from "./NativeBridge";

/** A Who'll Pro product as the App Store describes it (prices in the person's own currency). */
export type StoreProduct = {
  id: string;
  displayName: string;
  displayPrice: string;
  periodUnit: "day" | "week" | "month" | "year";
  periodValue: number;
  /** Set when this Apple ID can still get the free trial. */
  freeTrialDays?: number;
};
export type Signed = { transactions: string[]; renewals: string[] };

/** The iOS app's StoreKit 2 plugin (ios/App/App/SubscriptionsPlugin.swift). */
type SubscriptionsPlugin = {
  products(o: { ids: string[] }): Promise<{ products: StoreProduct[] }>;
  purchase(o: { id: string; appAccountToken: string }): Promise<{
    status: "purchased" | "pending" | "cancelled";
    transaction?: string;
    renewals?: string[];
  }>;
  entitlements(o: { ids: string[] }): Promise<Signed>;
  restore(o: { ids: string[] }): Promise<Signed & { cancelled?: boolean }>;
  manage(): Promise<void>;
  addListener(event: "transaction", cb: (e: { transaction: string }) => void): Promise<{ remove(): Promise<void> }>;
};

/** True in app builds that can buy Who'll Pro (1.1 and later). */
export function canBuyInApp() {
  const cap = (globalThis as { Capacitor?: { isPluginAvailable?: (name: string) => boolean } }).Capacitor;
  return isNativeApp() && !!cap?.isPluginAvailable?.("Subscriptions");
}

/**
 * The plugin inside the iOS app; null on the web and in older app builds (subscriptions are bought in the app).
 * Wrapped in an object: a Capacitor plugin is a Proxy that answers every property, `then` included, so returning
 * it bare from an async function makes the promise treat it as a thenable and fail ("then() is not implemented").
 */
export async function storeKit(): Promise<{ kit: SubscriptionsPlugin } | null> {
  if (!canBuyInApp()) return null;
  const { registerPlugin } = await import("@capacitor/core");
  return { kit: registerPlugin<SubscriptionsPlugin>("Subscriptions") };
}

/** "month" → "month", 1 year → "year", 3 months → "3 months". */
export function periodLabel(p: Pick<StoreProduct, "periodUnit" | "periodValue">) {
  return p.periodValue === 1 ? p.periodUnit : `${p.periodValue} ${p.periodUnit}s`;
}
