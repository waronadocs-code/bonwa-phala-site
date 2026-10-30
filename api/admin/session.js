// /api/admin/session
//   GET     → { admin: true | false }
//   POST    { password } → logs in (sets the session cookie)
//   DELETE  → logs out

import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { isAdmin, passwordMatches, sessionCookie, clearedCookie, checkLoginRate, recordLoginFailure } from '../_lib/auth.js';

const clientIp = request => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';

export const GET = handle(async request => json(200, { admin: isAdmin(request) }));

export const POST = handle(async request => {
  const ip = clientIp(request);
  checkLoginRate(ip);
  const { password } = await readJson(request, 1000);
  if (typeof password !== 'string' || !passwordMatches(password)) {
    recordLoginFailure(ip);
    await new Promise(r => setTimeout(r, 400));
    throw new HttpError(401, 'Wrong password.');
  }
  return json(200, { admin: true }, { 'set-cookie': sessionCookie(request) });
});

export const DELETE = handle(async request => json(200, { admin: false }, { 'set-cookie': clearedCookie(request) }));
