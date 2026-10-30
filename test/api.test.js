// Runs the real endpoint handlers against the in-memory store.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
delete process.env.RESEND_API_KEY;
process.env.ADMIN_PASSWORD = 'correct horse battery staple';

const { useStore, memoryStore } = await import('../api/_lib/store.js');
const enquiries = await import('../api/enquiries.js');
const availability = await import('../api/availability.js');
const session = await import('../api/admin/session.js');
const adminEnq = await import('../api/admin/enquiries.js');
const blocks = await import('../api/admin/blocks.js');
const { addDays, todayInSA } = await import('../api/_lib/dates.js');

const ARRIVE = addDays(todayInSA(), 30);
const req = (method, path, body, headers = {}) => new Request('http://localhost' + path, {
  method,
  headers: body ? { 'content-type': 'application/json', ...headers } : headers,
  body: body ? JSON.stringify(body) : undefined,
});
const call = async (fn, ...args) => { const r = await fn(req(...args)); return { status: r.status, body: await r.json(), headers: r.headers }; };
const enquiry = over => ({ lodge: 'main', stay: 'rooms', arrival: ARRIVE, nights: 2, rooms: 4, guests: 8, occasion: 'Celebration', name: 'Sipho Dlamini', email: 'sipho@example.com', ...over });

async function login() {
  const r = await call(session.POST, 'POST', '/api/admin/session', { password: process.env.ADMIN_PASSWORD });
  assert.equal(r.status, 200);
  return { cookie: r.headers.get('set-cookie').split(';')[0] };
}

// A fresh store per test; `store` lets tests add rows directly.
let store;
beforeEach(() => { store = memoryStore(); useStore(store); });

test('a guest can send an enquiry; the rate is computed on the server', async t => {
  t.mock.method(console, 'log', () => {}); // emails are printed without RESEND_API_KEY
  const r = await call(enquiries.POST, 'POST', '/api/enquiries', enquiry({ estTotal: 5 }));
  assert.equal(r.status, 201);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.emailed, false);
  const admin = await login();
  const list = await call(adminEnq.GET, 'GET', '/api/admin/enquiries', null, admin);
  assert.equal(list.body.enquiries.length, 1);
  assert.equal(list.body.enquiries[0].estTotal, 4 * 2 * 1500);
  assert.equal(list.body.enquiries[0].status, 'new');
});

test('invalid enquiries get field errors; non-JSON and honeypot are handled', async () => {
  const bad = await call(enquiries.POST, 'POST', '/api/enquiries', enquiry({ email: 'x', rooms: 12 }));
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.email && bad.body.errors.rooms);

  const form = await enquiries.POST(new Request('http://localhost/api/enquiries', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1' }));
  assert.equal(form.status, 415);

  const bot = await call(enquiries.POST, 'POST', '/api/enquiries', enquiry({ website: 'spam.example' }));
  assert.equal(bot.status, 201);
  const admin = await login();
  assert.equal((await call(adminEnq.GET, 'GET', '/api/admin/enquiries', null, admin)).body.enquiries.length, 0);
});

test('admin endpoints need a valid session', async () => {
  assert.equal((await call(adminEnq.GET, 'GET', '/api/admin/enquiries')).status, 401);
  assert.equal((await call(blocks.GET, 'GET', '/api/admin/blocks', null, { cookie: 'bp_admin=admin.9999999999.forged' })).status, 401);
  const wrong = await call(session.POST, 'POST', '/api/admin/session', { password: 'guess' });
  assert.equal(wrong.status, 401);
  const admin = await login();
  assert.equal((await call(session.GET, 'GET', '/api/admin/session', null, admin)).body.admin, true);
  const cookie = (await call(session.DELETE, 'DELETE', '/api/admin/session', null, admin)).headers.get('set-cookie');
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
});

test('blocks and confirmed enquiries show on availability and stop double booking', async t => {
  t.mock.method(console, 'log', () => {});
  const admin = await login();

  // The lodge blocks 7 chalets on the first night by phone.
  const b = await call(blocks.POST, 'POST', '/api/admin/blocks', { lodge: 'main', startDate: ARRIVE, endDate: addDays(ARRIVE, 1), rooms: 7, note: 'Phone booking' }, admin);
  assert.equal(b.status, 201);

  let a = await call(availability.GET, 'GET', `/api/availability?lodge=main&from=${ARRIVE}&to=${addDays(ARRIVE, 5)}`);
  assert.deepEqual(a.body.nights, { [ARRIVE]: { full: false, left: 3 } });

  // 4 rooms no longer fit; 3 do.
  const tooMany = await call(enquiries.POST, 'POST', '/api/enquiries', enquiry({ rooms: 4 }));
  assert.equal(tooMany.status, 409);
  assert.deepEqual(tooMany.body.conflicts, [ARRIVE]);
  const fits = await call(enquiries.POST, 'POST', '/api/enquiries', enquiry({ rooms: 3 }));
  assert.equal(fits.status, 201);

  // Confirming it fills the night.
  const ok = await call(adminEnq.PATCH, 'PATCH', `/api/admin/enquiries?id=${fits.body.id}`, { status: 'confirmed', adminNotes: 'Paid deposit' }, admin);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.enquiry.adminNotes, 'Paid deposit');
  a = await call(availability.GET, 'GET', `/api/availability?lodge=main&from=${ARRIVE}&to=${addDays(ARRIVE, 5)}`);
  assert.deepEqual(a.body.nights[ARRIVE], { full: true });

  // A second confirmation for the same nights is refused unless forced.
  const other = await store.insertEnquiry({ ...enquiry({ rooms: 1 }), estTotal: 3000 });
  const clash = await call(adminEnq.PATCH, 'PATCH', `/api/admin/enquiries?id=${other.id}`, { status: 'confirmed' }, admin);
  assert.equal(clash.status, 409);
  assert.deepEqual(clash.body.conflicts, [ARRIVE]);
  const forced = await call(adminEnq.PATCH, 'PATCH', `/api/admin/enquiries?id=${other.id}`, { status: 'confirmed', force: true }, admin);
  assert.equal(forced.status, 200);

  // Removing the block frees the rooms again.
  assert.equal((await call(blocks.DELETE, 'DELETE', `/api/admin/blocks?id=${b.body.block.id}`, null, admin)).status, 200);
  a = await call(availability.GET, 'GET', `/api/availability?lodge=main&from=${ARRIVE}&to=${addDays(ARRIVE, 5)}`);
  assert.deepEqual(a.body.nights[ARRIVE], { full: false, left: 6 });
});

test('availability rejects bad input', async () => {
  assert.equal((await call(availability.GET, 'GET', '/api/availability?lodge=nope')).status, 400);
  assert.equal((await call(availability.GET, 'GET', '/api/availability?lodge=main&from=2026-01-01&to=2028-01-01')).status, 400);
});

test('on Vercel without a database, endpoints answer 503 instead of losing data', async t => {
  t.mock.method(console, 'error', () => {});
  const { useStore: reset, getStore } = await import('../api/_lib/store.js');
  reset(undefined);
  process.env.VERCEL = '1';
  try {
    const r = await call(enquiries.POST, 'POST', '/api/enquiries', enquiry());
    assert.equal(r.status, 503);
    await assert.rejects(getStore());
  } finally {
    delete process.env.VERCEL;
  }
});
