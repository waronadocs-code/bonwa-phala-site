import { StoreUnavailable } from './store.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

// Reads a small JSON body. Requiring the JSON content type also stops plain
// HTML forms on other sites from posting here.
export async function readJson(request, maxBytes = 16_000) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    throw new HttpError(415, 'Send JSON.');
  }
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

export function idParam(request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Missing or invalid id.');
  return id;
}

// Wraps a handler so expected failures become clean JSON errors and
// unexpected ones are logged without leaking details to the browser.
export function handle(fn) {
  return async request => {
    try {
      return await fn(request);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message, ...err.extra });
      if (err instanceof StoreUnavailable) {
        console.error('[bonwa] database not configured:', err.message);
        return json(503, { error: 'Bookings are temporarily unavailable. Please WhatsApp or email us.' });
      }
      console.error('[bonwa] unexpected error:', err);
      return json(500, { error: 'Something went wrong. Please WhatsApp or email us.' });
    }
  };
}
