/**
 * Apple Push Notification service (APNs) over HTTP/2 with a token-based (.p8) key.
 * Configure APNS_KEY (the .p8 contents; "\n" escapes allowed), APNS_KEY_ID, APNS_TEAM_ID and IOS_BUNDLE_ID.
 * Without them (development), pushes are printed to the console instead.
 */
import { connect, type ClientHttp2Session } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

export type PushPayload = { title: string; body: string; href: string; badge?: number };
export type PushResult = { token: string; ok: boolean; environment?: "production" | "sandbox"; gone?: boolean; error?: string };
/** Sends one payload to some device tokens. Each token reports back separately. */
export type SendPush = (devices: { token: string; environment: string | null }[], payload: PushPayload) => Promise<PushResult[]>;

const HOSTS = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;

let jwt: { value: string; at: number } | undefined;
function providerToken() {
  // Apple accepts a token for up to an hour and rejects refreshing more than every 20 minutes.
  if (jwt && Date.now() - jwt.at < 40 * 60_000) return jwt.value;
  const key = createPrivateKey(process.env.APNS_KEY!.replace(/\\n/g, "\n"));
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = `${b64({ alg: "ES256", kid: process.env.APNS_KEY_ID })}.${b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
  const sig = sign("sha256", Buffer.from(head), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  jwt = { value: `${head}.${sig}`, at: Date.now() };
  return jwt.value;
}

const sessions: Partial<Record<keyof typeof HOSTS, ClientHttp2Session>> = {};
function session(env: keyof typeof HOSTS) {
  const s = sessions[env];
  if (s && !s.closed && !s.destroyed) return s;
  const fresh = connect(HOSTS[env]);
  fresh.on("error", () => fresh.destroy());
  fresh.unref();
  sessions[env] = fresh;
  return fresh;
}

function post(env: keyof typeof HOSTS, token: string, body: string): Promise<{ status: number; reason?: string }> {
  return new Promise((resolve, reject) => {
    const req = session(env).request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${providerToken()}`,
      "apns-topic": process.env.IOS_BUNDLE_ID ?? "app.wholl.ios",
      "apns-push-type": "alert",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.setTimeout(10_000, () => req.close());
    req.on("response", (h) => (status = Number(h[":status"])));
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve({ status, reason: data ? (JSON.parse(data) as { reason?: string }).reason : undefined }));
    req.on("error", reject);
    req.end(body);
  });
}

export const apnsConfigured = () => !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

/**
 * Sends a push. Tokens from development builds only work on the sandbox: if production says BadDeviceToken
 * for a device we haven't placed yet, sandbox is tried and remembered.
 */
export const sendPush: SendPush = async (devices, p) => {
  const body = JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: "default", badge: p.badge }, href: p.href });
  if (!apnsConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("APNs is not configured.");
    for (const d of devices) console.info(`[dev push] ${d.token.slice(0, 8)}…: ${p.title} — ${p.body} (${p.href})`);
    return devices.map((d) => ({ token: d.token, ok: true }));
  }
  const out: PushResult[] = [];
  for (const d of devices) {
    const order: (keyof typeof HOSTS)[] =
      d.environment === "sandbox" ? ["sandbox"] : d.environment === "production" ? ["production"] : ["production", "sandbox"];
    let result: PushResult = { token: d.token, ok: false };
    for (const env of order) {
      try {
        const r = await post(env, d.token, body);
        if (r.status === 200) {
          result = { token: d.token, ok: true, environment: env };
          break;
        }
        const gone = r.status === 410 || r.reason === "Unregistered" || (r.reason === "BadDeviceToken" && env === order.at(-1));
        result = { token: d.token, ok: false, gone, error: `${r.status} ${r.reason ?? ""}`.trim() };
        if (r.reason !== "BadDeviceToken") break;
      } catch (e) {
        result = { token: d.token, ok: false, error: e instanceof Error ? e.message : String(e) };
        break;
      }
    }
    out.push(result);
  }
  return out;
};
