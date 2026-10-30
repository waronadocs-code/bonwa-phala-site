// /api/admin/blocks (admin only): dates taken off sale on the calendar.
//   GET     ?from=2026-11-01  → blocks that haven't ended yet (default: from today)
//   POST    { lodge, startDate, endDate, rooms|null, note } → add one
//   DELETE  ?id=7             → remove one

import { handle, json, readJson, idParam, HttpError } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { getStore } from '../_lib/store.js';
import { validateBlock } from '../_lib/validate.js';
import { isIsoDate, todayInSA } from '../_lib/dates.js';

export const GET = handle(async request => {
  requireAdmin(request);
  const from = new URL(request.url).searchParams.get('from') || todayInSA();
  if (!isIsoDate(from)) throw new HttpError(400, 'Invalid date.');
  const store = await getStore();
  return json(200, { blocks: await store.listBlocks({ from }) });
});

export const POST = handle(async request => {
  requireAdmin(request);
  const check = validateBlock(await readJson(request));
  if (!check.ok) return json(400, { error: 'Please check the highlighted fields.', errors: check.errors });
  const store = await getStore();
  return json(201, { block: await store.insertBlock(check.value) });
});

export const DELETE = handle(async request => {
  requireAdmin(request);
  const store = await getStore();
  if (!(await store.deleteBlock(idParam(request)))) throw new HttpError(404, 'Block not found.');
  return json(200, { ok: true });
});
