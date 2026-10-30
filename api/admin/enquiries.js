// /api/admin/enquiries (admin only)
//   GET    ?status=new           → list enquiries, newest first
//   PATCH  ?id=12 { status?, adminNotes?, force? } → update one
//
// Setting status to "confirmed" makes the stay count as booked on the
// calendar, so it's refused (409) if it would overbook, unless force is true.

import { handle, json, readJson, idParam, HttpError } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { getStore } from '../_lib/store.js';
import { STATUSES } from '../_lib/lodges.js';
import { stayConflicts } from '../_lib/availability.js';
import { addDays } from '../_lib/dates.js';

export const GET = handle(async request => {
  requireAdmin(request);
  const status = new URL(request.url).searchParams.get('status');
  if (status && !STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
  const store = await getStore();
  return json(200, { enquiries: await store.listEnquiries({ status: status || undefined }) });
});

export const PATCH = handle(async request => {
  requireAdmin(request);
  const id = idParam(request);
  const body = await readJson(request);

  const status = body.status ?? null;
  if (status !== null && !STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes.slice(0, 4000) : null;

  const store = await getStore();
  const current = await store.getEnquiry(id);
  if (!current) throw new HttpError(404, 'Enquiry not found.');

  if (status === 'confirmed' && current.status !== 'confirmed' && current.arrival && !body.force) {
    const end = addDays(current.arrival, current.nights);
    const occ = await store.occupancies(current.lodge, current.arrival, end, { exceptEnquiryId: id });
    const conflicts = stayConflicts(current.lodge, occ, current);
    if (conflicts.length) {
      throw new HttpError(409, 'Confirming this would overbook some nights.', { conflicts });
    }
  }

  return json(200, { enquiry: await store.updateEnquiry(id, { status, adminNotes }) });
});
