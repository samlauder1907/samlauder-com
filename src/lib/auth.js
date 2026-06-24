export const COOKIE_NAME = 'artchel_session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function hmacSign(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(secret) {
  const ts = Date.now().toString();
  const mac = await hmacSign(secret, ts);
  return `${ts}:${mac}`;
}

export async function verifySessionToken(token, secret) {
  if (!token) return false;
  const colonIdx = token.indexOf(':');
  if (colonIdx === -1) return false;
  const ts = token.slice(0, colonIdx);
  const mac = token.slice(colonIdx + 1);
  const n = parseInt(ts, 10);
  if (isNaN(n) || Date.now() - n > THIRTY_DAYS_MS) return false;
  const expected = await hmacSign(secret, ts);
  return expected === mac;
}

export async function isAuthenticated(cookies, env) {
  const token = cookies.get(COOKIE_NAME)?.value;
  return verifySessionToken(token, env.ART_LOG_PASSWORD);
}
