import { LODGES } from './lodges.js';
import { addDays, nights } from './dates.js';

// An occupancy is anything that takes up rooms at a lodge: a block the lodge
// entered on the admin page, or a confirmed enquiry.
//   { startDate: first night, endDate: check-out day, rooms: number | null }
// rooms === null means the whole lodge.

// Works out, for each night in [from, to), how busy a lodge is. Only nights
// with something booked are returned:
//   { '2026-12-24': { full: true }, '2026-12-27': { full: false, left: 4 } }
export function occupancyByNight(lodgeKey, occupancies, from, to) {
  const L = LODGES[lodgeKey];
  const used = new Map();
  for (const o of occupancies) {
    const start = o.startDate > from ? o.startDate : from;
    const end = o.endDate < to ? o.endDate : to;
    for (const d of nights(start, end)) {
      const u = used.get(d) || { rooms: 0, whole: false };
      if (o.rooms === null) u.whole = true;
      else u.rooms += o.rooms;
      used.set(d, u);
    }
  }
  const out = {};
  for (const [d, u] of [...used].sort()) {
    if (u.whole) out[d] = { full: true };
    else if (L.rooms) out[d] = u.rooms >= L.rooms ? { full: true } : { full: false, left: L.rooms - u.rooms };
    // Room count unknown (Bush Lodge for now): partial bookings don't close a date.
    else out[d] = { full: false };
  }
  return out;
}

// Nights in a requested stay that can't take it. A whole-lodge request needs
// every night completely free; a rooms request needs enough rooms left.
export function stayConflicts(lodgeKey, occupancies, { arrival, nights: n, stay, rooms }) {
  if (!arrival) return [];
  const end = addDays(arrival, n);
  const busy = occupancyByNight(lodgeKey, occupancies, arrival, end);
  const L = LODGES[lodgeKey];
  return Object.entries(busy)
    .filter(([, b]) => b.full || stay === 'whole' || (L.rooms && b.left < rooms))
    .map(([d]) => d);
}

// Turns stored rows into occupancies. Confirmed enquiries count; a flexible
// enquiry (no arrival date) can't occupy anything.
export function enquiryToOccupancy(e) {
  if (!e.arrival) return null;
  return { startDate: e.arrival, endDate: addDays(e.arrival, e.nights), rooms: e.stay === 'whole' ? null : e.rooms };
}
