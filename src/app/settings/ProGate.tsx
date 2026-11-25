"use client";

import { useEffect, useState } from "react";
import { canBuyInApp } from "../subscriptions-native";

/**
 * Shows Who'll Pro only where it makes sense: everywhere once limits are on (PRO_LIMITS), and before that only in
 * app builds that can buy it, so older apps (and their App Review) never see something they can't get.
 */
export function ProGate({ enforced, children }: { enforced: boolean; children: React.ReactNode }) {
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(canBuyInApp()), []); // eslint-disable-line react-hooks/set-state-in-effect -- needs the browser check
  return enforced || inApp ? <>{children}</> : null;
}
