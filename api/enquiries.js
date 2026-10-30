// POST /api/enquiries — the booking panel's "Send enquiry" button.
// Saves the enquiry, emails the lodge and sends the guest a confirmation.

import { handle, json, readJson } from './_lib/http.js';
import { validateEnquiry } from './_lib/validate.js';
import { getStore } from './_lib/store.js';
import { stayConflicts } from './_lib/availability.js';
import { addDays } from './_lib/dates.js';
import { sendEmail, lodgeNotification, guestConfirmation } from './_lib/email.js';

export const POST = handle(async request => {
  const body = await readJson(request);

  // Bots fill in every field, including this one, which people never see.
  if (body.website) return json(201, { ok: true });

  const check = validateEnquiry(body);
  if (!check.ok) return json(400, { error: 'Please check the highlighted fields.', errors: check.errors });
  const v = check.value;

  const store = await getStore();
  if (v.arrival) {
    const occ = await store.occupancies(v.lodge, v.arrival, addDays(v.arrival, v.nights));
    const conflicts = stayConflicts(v.lodge, occ, v);
    if (conflicts.length) {
      return json(409, {
        error: v.stay === 'whole'
          ? 'Part of the lodge is already booked on some of those nights. Try other dates, or book by the room.'
          : 'Not enough rooms are free on some of those nights. Try other dates or fewer rooms.',
        conflicts,
      });
    }
  }

  const saved = await store.insertEnquiry(v);
  const results = await Promise.allSettled([sendEmail(lodgeNotification(saved)), sendEmail(guestConfirmation(saved))]);
  results.filter(r => r.status === 'rejected').forEach(r => console.error('[bonwa] email failed:', r.reason));

  return json(201, { ok: true, id: saved.id, emailed: results.every(r => r.status === 'fulfilled' && r.value.sent) });
});
