// GET /api/availability?lodge=main&from=2026-11-01&to=2027-01-01
// Booked nights for one lodge, for the booking calendar and the admin page.
// Only nights with something booked are listed. Guest details never leave
// the server here: just "full" or how many rooms are left.

import { handle, json, HttpError } from './_lib/http.js';
import { LODGES } from './_lib/lodges.js';
import { getStore } from './_lib/store.js';
import { occupancyByNight } from './_lib/availability.js';
import { isIsoDate, addDays, daysBetween, todayInSA } from './_lib/dates.js';

export const GET = handle(async request => {
  const p = new URL(request.url).searchParams;
  const lodge = p.get('lodge');
  if (!LODGES[lodge]) throw new HttpError(400, 'Unknown lodge.');

  const from = p.get('from') || todayInSA();
  const to = p.get('to') || addDays(from, 365);
  if (!isIsoDate(from) || !isIsoDate(to) || to <= from) throw new HttpError(400, 'Invalid date range.');
  if (daysBetween(from, to) > 400) throw new HttpError(400, 'Ask for at most 400 days at a time.');

  const store = await getStore();
  const nights = occupancyByNight(lodge, await store.occupancies(lodge, from, to), from, to);

  return json(200, { lodge, rooms: LODGES[lodge].rooms, from, to, nights },
    // Short CDN cache: busy calendars stay fast, new bookings show within a minute.
    { 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=60' });
});
