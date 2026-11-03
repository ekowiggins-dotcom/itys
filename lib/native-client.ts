// Rules for the iOS app talking to the API from its own origin.
export const NATIVE_CLIENT_HEADER = 'x-sidebet-client';

/** Origins the bundled app runs on (Capacitor serves iOS apps from capacitor://localhost). */
export function nativeOrigins(env: Record<string, string | undefined> = process.env) {
  return (env.NATIVE_ORIGINS || 'capacitor://localhost').split(',').map(s => s.trim()).filter(Boolean);
}
export function isNativeOrigin(origin: string | null, env = process.env) {
  return !!origin && nativeOrigins(env).includes(origin);
}
/** Session token from the cookie (web) or an Authorization: Bearer header (app). */
export function sessionToken(cookie: string | undefined, authorization: string | null) {
  if (cookie) return cookie;
  const m = authorization?.match(/^Bearer ([0-9a-f]{64})$/i);
  return m ? m[1] : undefined;
}
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isNativeOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sidebet-Client',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
