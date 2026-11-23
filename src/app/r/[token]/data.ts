import { cache } from "react";
import { getDb } from "@/server/db";
import { publicResult } from "@/server/sharing";
import { clientIp } from "@/server/session";

/** One lookup per request, shared by the page, its metadata and its image. Rate-limited per IP. */
export const resultFor = cache(async (token: string) => {
  try {
    return await publicResult(await getDb(), token, await clientIp());
  } catch {
    return null; // rate-limited: show nothing rather than an error page
  }
});
