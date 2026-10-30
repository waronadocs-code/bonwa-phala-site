import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

// The admin page has a single shared password (ADMIN_PASSWORD). Logging in
// sets a signed, HttpOnly cookie that lasts 12 hours. Changing the password
// (or SESSION_SECRET) logs everyone out.

const COOKIE = 'bp_admin';
const TTL_SECONDS = 12 * 60 * 60;

function key() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!process.env.ADMIN_PASSWORD || !secret) throw new HttpError(503, 'The admin page isn’t set up yet: ADMIN_PASSWORD is missing.');
  return createHmac('sha256', 'bonwa-phala-admin').update(secret).digest();
}

const sign = payload => createHmac('sha256', key()).update(payload).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passwordMatches(given) {
  key(); // throws if not configured
  // Hash both sides so the comparison takes the same time whatever the length.
  const h = s => createHmac('sha256', 'pw').update(String(s)).digest();
  return timingSafeEqual(h(given), h(process.env.ADMIN_PASSWORD));
}

function cookieAttrs(request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(request) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `admin.${exp}`;
  return `${COOKIE}=${payload}.${sign(payload)}; ${cookieAttrs(request, TTL_SECONDS)}`;
}

export function clearedCookie(request) {
  return `${COOKIE}=; ${cookieAttrs(request, 0)}`;
}

export function isAdmin(request) {
  const raw = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [who, exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (who !== 'admin' || !/^\d+$/.test(exp || '') || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(`${who}.${exp}`));
}

export function requireAdmin(request) {
  if (!isAdmin(request)) throw new HttpError(401, 'Please log in.');
}

// Slows down password guessing. Serverless instances don't share memory, so
// this is a speed bump rather than a hard limit.
const failures = new Map();
export function checkLoginRate(ip) {
  const now = Date.now(), windowMs = 15 * 60 * 1000;
  const recent = (failures.get(ip) || []).filter(t => now - t < windowMs);
  failures.set(ip, recent);
  if (recent.length >= 5) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
}
export function recordLoginFailure(ip) {
  failures.set(ip, [...(failures.get(ip) || []), Date.now()]);
}
