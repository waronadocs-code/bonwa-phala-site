import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occupancyByNight, stayConflicts } from '../api/_lib/availability.js';
import { validateEnquiry, validateBlock } from '../api/_lib/validate.js';
import { addDays, isIsoDate } from '../api/_lib/dates.js';

test('dates: validity and arithmetic across month and year ends', () => {
  assert.equal(isIsoDate('2027-02-29'), false);
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
});

test('occupancy: rooms add up, whole-lodge closes the night, check-out day is free', () => {
  const occ = [
    { startDate: '2026-12-01', endDate: '2026-12-03', rooms: 4 },
    { startDate: '2026-12-02', endDate: '2026-12-04', rooms: 6 },
    { startDate: '2026-12-10', endDate: '2026-12-11', rooms: null },
  ];
  const n = occupancyByNight('main', occ, '2026-12-01', '2026-12-31');
  assert.deepEqual(n['2026-12-01'], { full: false, left: 6 });
  assert.deepEqual(n['2026-12-02'], { full: true });   // 4 + 6 = all 10 chalets
  assert.deepEqual(n['2026-12-03'], { full: false, left: 4 });
  assert.equal(n['2026-12-04'], undefined);            // check-out day
  assert.deepEqual(n['2026-12-10'], { full: true });
});

test('occupancy: Bush Lodge with unknown room count only closes on whole-lodge bookings', () => {
  const n = occupancyByNight('bush', [
    { startDate: '2026-12-01', endDate: '2026-12-02', rooms: 30 },
    { startDate: '2026-12-05', endDate: '2026-12-06', rooms: null },
  ], '2026-12-01', '2026-12-31');
  assert.deepEqual(n['2026-12-01'], { full: false });
  assert.deepEqual(n['2026-12-05'], { full: true });
});

test('conflicts: rooms requests fit around partial bookings, whole-lodge needs empty nights', () => {
  const occ = [{ startDate: '2026-12-02', endDate: '2026-12-03', rooms: 7 }];
  const base = { arrival: '2026-12-01', nights: 3 };
  assert.deepEqual(stayConflicts('main', occ, { ...base, stay: 'rooms', rooms: 3 }), []);
  assert.deepEqual(stayConflicts('main', occ, { ...base, stay: 'rooms', rooms: 4 }), ['2026-12-02']);
  assert.deepEqual(stayConflicts('main', occ, { ...base, stay: 'whole', rooms: null }), ['2026-12-02']);
  assert.deepEqual(stayConflicts('main', occ, { arrival: null, nights: 3, stay: 'whole' }), []);
});

const NOW = new Date('2026-11-01T10:00:00+02:00');
const good = { lodge: 'main', stay: 'rooms', arrival: '2026-12-01', nights: 2, rooms: 3, guests: 6, occasion: 'Wedding', name: 'Thandi Mokoena', email: 'Thandi@Example.com', phone: '082 123 4567', message: 'Hi' };

test('enquiry validation: clean input passes and the rate is computed on the server', () => {
  const r = validateEnquiry({ ...good, estTotal: 1 }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.value.estTotal, 9000);
  assert.equal(r.value.email, 'thandi@example.com');
  assert.equal(validateEnquiry({ ...good, stay: 'whole' }, NOW).value.estTotal, null);
  assert.equal(validateEnquiry({ ...good, arrival: '' }, NOW).value.arrival, null);
});

test('enquiry validation: rejects bad fields with a message per field', () => {
  const r = validateEnquiry({ ...good, lodge: 'x', arrival: '2026-10-01', nights: 0, email: 'nope', guests: 999, name: 'A' }, NOW);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['arrival', 'email', 'guests', 'lodge', 'name', 'nights']);
  assert.match(validateEnquiry({ ...good, rooms: 11 }, NOW).errors.rooms, /10 chalets/);
  assert.match(validateEnquiry({ ...good, guests: 31 }, NOW).errors.guests, /30 guests/);
});

test('block validation', () => {
  assert.equal(validateBlock({ lodge: 'main', startDate: '2026-12-01', endDate: '2026-12-03', rooms: '' }).value.rooms, null);
  assert.equal(validateBlock({ lodge: 'main', startDate: '2026-12-03', endDate: '2026-12-03' }).ok, false);
  assert.equal(validateBlock({ lodge: 'main', startDate: '2026-12-01', endDate: '2026-12-02', rooms: 11 }).ok, false);
});
