'use client';
// One place for talking to the server, so the same screens work on the web and inside the iOS app.
// Web: same-origin requests with the session cookie. App: absolute API URL + Bearer token kept on the phone.
export const NATIVE = process.env.NEXT_PUBLIC_NATIVE === '1';
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const KEY = 'sidebet.session', LAST = 'sidebet.lastInvite';

// Never return a Capacitor plugin from an async function: plugins are proxies, so `await` would call a
// non-existent native `then` method. Import the module and use the plugin within the same call.
const prefs = () => import('@capacitor/preferences');
async function read(key: string) { const m = await prefs(); return (await m.Preferences.get({ key })).value; }
async function write(key: string, value: string) { const m = await prefs(); await m.Preferences.set({ key, value }); }
export async function getSession() { return NATIVE ? read(KEY) : null; }
export async function setSession(v: string) { if (NATIVE) await write(KEY, v); }
export async function lastInvite() { return NATIVE ? read(LAST) : null; }
export async function rememberInvite(v: string) { if (NATIVE && v) await write(LAST, v); }

/** Public web address used in share links (in the app, location.origin is capacitor://localhost). */
export function webOrigin() { return NATIVE ? (process.env.NEXT_PUBLIC_WEB_ORIGIN || API_BASE) : location.origin; }

export async function api(path: string, init: RequestInit = {}) {
  if (!NATIVE) return fetch(path, init);
  const headers = new Headers(init.headers);
  headers.set('X-Sidebet-Client', 'ios');
  const session = await getSession();
  if (session) headers.set('Authorization', 'Bearer ' + session);
  const res = await fetch(API_BASE + path, { ...init, headers, credentials: 'omit' });
  return res;
}
/** After deleting the account: forget the session and the last group on this phone. */
export async function forgetAccount() { if (NATIVE) { await write(KEY, ''); await write(LAST, ''); } }
