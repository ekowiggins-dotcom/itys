import http2 from 'node:http2';
import { createPrivateKey, sign } from 'node:crypto';

export type ApnsConfig = { teamId: string; keyId: string; key: string; bundleId: string };
export type ApnsResult = { status: number; reason?: string };
export type Transport = (env: 'sandbox' | 'production', token: string, headers: Record<string, string>, body: string) => Promise<ApnsResult>;

/** Reads APNS_TEAM_ID, APNS_KEY_ID, APNS_KEY (the .p8 contents, \n allowed) and IOS_BUNDLE_ID. */
export function apnsConfig(env: Record<string, string | undefined> = process.env): ApnsConfig | null {
  const { APNS_TEAM_ID: teamId, APNS_KEY_ID: keyId, APNS_KEY: raw, IOS_BUNDLE_ID: bundleId } = env;
  if (!teamId || !keyId || !raw || !bundleId) return null;
  return { teamId, keyId, key: raw.replace(/\\n/g, '\n'), bundleId };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
let cached: { jwt: string; at: number; keyId: string } | null = null;

/** Provider token: ES256 JWT, valid up to 60 minutes; Apple asks for reuse rather than one per request. */
export function providerToken(cfg: ApnsConfig, nowMs = Date.now()) {
  if (cached && cached.keyId === cfg.keyId && nowMs - cached.at < 50 * 60000) return cached.jwt;
  const iat = Math.floor(nowMs / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat }));
  const signature = sign('sha256', Buffer.from(head + '.' + claims), { key: createPrivateKey(cfg.key), dsaEncoding: 'ieee-p1363' });
  const jwt = head + '.' + claims + '.' + b64url(signature);
  cached = { jwt, at: nowMs, keyId: cfg.keyId };
  return jwt;
}

const sessions: Partial<Record<'sandbox' | 'production', http2.ClientHttp2Session>> = {};
export const http2Transport: Transport = (env, token, headers, body) => new Promise((resolve, reject) => {
  const host = env === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  let s = sessions[env];
  if (!s || s.closed || s.destroyed) { s = http2.connect(host); s.on('error', () => { delete sessions[env]; }); s.unref(); sessions[env] = s; }
  const req = s.request({ ':method': 'POST', ':path': '/3/device/' + token, ...headers });
  let status = 0, data = '';
  req.setTimeout(10000, () => req.close(http2.constants.NGHTTP2_CANCEL));
  req.on('response', h => { status = Number(h[':status']); });
  req.on('data', c => { data += c; });
  req.on('end', () => { let reason: string | undefined; try { reason = data ? JSON.parse(data).reason : undefined; } catch {} resolve({ status, reason }); });
  req.on('error', reject);
  req.end(body);
});

export type Alert = { title: string; body: string; threadId: string; data: Record<string, string> };
export async function sendAlert(cfg: ApnsConfig, env: 'sandbox' | 'production', token: string, alert: Alert, transport: Transport = http2Transport, nowMs = Date.now()) {
  const body = JSON.stringify({ aps: { alert: { title: alert.title, body: alert.body }, sound: 'default', 'thread-id': alert.threadId }, ...alert.data });
  return transport(env, token, {
    authorization: 'bearer ' + providerToken(cfg, nowMs),
    'apns-topic': cfg.bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'content-type': 'application/json',
  }, body);
}
/** Apple says these mean the token will never work again. */
export const deadToken = (r: ApnsResult) => r.status === 410 || (r.status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(r.reason || ''));
