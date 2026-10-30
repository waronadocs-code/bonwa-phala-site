// Dates are plain 'YYYY-MM-DD' strings throughout. All arithmetic is done in
// UTC so a server in another time zone can't shift a booking by a day.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

// Today's date in South Africa, which is what guests and the lodge mean by "today".
export function todayInSA(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(now);
}

// Every night from `from` up to (not including) `to`.
export function* nights(from, to) {
  for (let d = from; d < to; d = addDays(d, 1)) yield d;
}
