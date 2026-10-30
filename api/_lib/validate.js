import { LODGES, OCCASIONS, MAX_NIGHTS, MAX_GUESTS, RATE_PER_ROOM_NIGHT } from './lodges.js';
import { isIsoDate, todayInSA, addDays, daysBetween } from './dates.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = v => (Number.isInteger(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN);

// Checks a booking enquiry from the public form. Returns either
// { ok: true, value } with clean, server-computed fields, or
// { ok: false, errors } keyed by field name for the form to show.
export function validateEnquiry(body, now = new Date()) {
  const errors = {};
  if (!body || typeof body !== 'object') return { ok: false, errors: { form: 'Invalid request.' } };

  const lodge = body.lodge;
  if (!LODGES[lodge]) errors.lodge = 'Choose a lodge.';
  const L = LODGES[lodge] || LODGES.main;

  const stay = body.stay === 'whole' ? 'whole' : body.stay === 'rooms' ? 'rooms' : null;
  if (!stay) errors.stay = 'Choose by the room or whole lodge.';

  let arrival = null;
  if (body.arrival) {
    if (!isIsoDate(body.arrival)) errors.arrival = 'Choose a valid arrival date.';
    else if (body.arrival < todayInSA(now)) errors.arrival = 'Arrival can’t be in the past.';
    else if (body.arrival > addDays(todayInSA(now), 730)) errors.arrival = 'We take bookings up to two years ahead.';
    else arrival = body.arrival;
  }

  const nights = int(body.nights);
  if (!(nights >= 1 && nights <= MAX_NIGHTS)) errors.nights = `Nights must be between 1 and ${MAX_NIGHTS}.`;

  let rooms = null;
  if (stay === 'rooms') {
    rooms = int(body.rooms);
    const maxRooms = L.rooms || 40;
    if (!(rooms >= 1 && rooms <= maxRooms)) errors.rooms = L.rooms ? `The ${L.name} has ${L.rooms} chalets.` : 'Choose how many rooms.';
  }

  const guests = int(body.guests);
  if (!(guests >= 1 && guests <= MAX_GUESTS)) errors.guests = 'Enter the number of guests.';
  else if (guests > L.cap) errors.guests = `The ${L.name} sleeps up to ${L.cap} guests.`;

  const occasion = OCCASIONS.includes(body.occasion) ? body.occasion : OCCASIONS[0];

  const name = str(body.name, 120);
  if (name.length < 2) errors.name = 'Enter your name.';

  const email = str(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';

  const phone = str(body.phone, 40);
  if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) errors.phone = 'Enter a valid phone number.';

  const message = str(body.message, 2000);

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      lodge, stay, arrival, nights, rooms, guests, occasion, name, email, phone, message,
      // Recomputed here so a tampered form can't change the quoted rate.
      estTotal: stay === 'rooms' ? RATE_PER_ROOM_NIGHT * rooms * nights : null,
    },
  };
}

// Checks a date block entered on the admin page.
export function validateBlock(body) {
  const errors = {};
  if (!body || typeof body !== 'object') return { ok: false, errors: { form: 'Invalid request.' } };
  if (!LODGES[body.lodge]) errors.lodge = 'Choose a lodge.';
  // startDate is the first booked night, endDate the check-out day (not booked).
  if (!isIsoDate(body.startDate)) errors.startDate = 'Choose the first night.';
  if (!isIsoDate(body.endDate)) errors.endDate = 'Choose the check-out date.';
  else if (isIsoDate(body.startDate) && body.endDate <= body.startDate) errors.endDate = 'Check-out must be after the first night.';
  else if (isIsoDate(body.startDate) && daysBetween(body.startDate, body.endDate) > 366) errors.endDate = 'Block at most a year at a time.';

  let rooms = null;
  if (body.rooms !== null && body.rooms !== undefined && body.rooms !== '') {
    rooms = int(body.rooms);
    const max = LODGES[body.lodge]?.rooms;
    if (!(rooms >= 1 && rooms <= (max || 40))) errors.rooms = max ? `Between 1 and ${max} rooms.` : 'Enter a number of rooms.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { lodge: body.lodge, startDate: body.startDate, endDate: body.endDate, rooms, note: str(body.note, 300) } };
}
