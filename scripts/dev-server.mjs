// Local development server: `npm run dev`, then open http://localhost:3000
//
// Serves the site the way Vercel does: static files with clean URLs
// (/accommodation → accommodation.html) and api/**/*.js as functions,
// calling the exported GET/POST/PATCH/DELETE handlers. Settings come
// from .env. No Vercel account or login needed.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const port = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

async function serveApi(req, res, pathname) {
  const file = join(root, pathname + '.js');
  if (!file.startsWith(join(root, 'api') + sep) || pathname.split('/').some(p => p.startsWith('_')) || !existsSync(file)) {
    return send(res, 404, { 'content-type': 'application/json' }, JSON.stringify({ error: 'Not found.' }));
  }
  // Cache-bust so edits to the handler take effect without restarting.
  const mod = await import(pathToFileURL(file).href + '?t=' + (await stat(file)).mtimeMs);
  const handler = mod[req.method];
  if (typeof handler !== 'function') {
    return send(res, 405, { 'content-type': 'application/json' }, JSON.stringify({ error: 'Method not allowed.' }));
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });

  const response = await handler(request);
  const out = {};
  response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) out['set-cookie'] = cookies;
  send(res, response.status, out, Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const candidates = extname(rel) ? [rel] : [rel + '.html', rel + '/index.html'];
  for (const c of candidates) {
    const file = resolve(root, '.' + c);
    if (!file.startsWith(root + sep)) break;
    if (/[\\/](\.env|node_modules|scripts|test|db)([\\/]|$)/.test(file.slice(root.length))) break;
    try {
      const body = await readFile(file);
      return send(res, 200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }, body);
    } catch { /* try the next candidate */ }
  }
  send(res, 404, { 'content-type': 'text/plain' }, 'Not found');
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname.startsWith('/api/')) await serveApi(req, res, pathname);
    else await serveStatic(res, pathname);
  } catch (err) {
    console.error(err);
    send(res, 500, { 'content-type': 'text/plain' }, 'Dev server error: ' + err.message);
  }
  console.log(`${req.method} ${pathname} → ${res.statusCode}`);
}).listen(port, () => {
  console.log(`\nBonwa Phala running at http://localhost:${port}`);
  console.log(`Admin page:            http://localhost:${port}/admin`);
  console.log(process.env.DATABASE_URL ? 'Database: Neon (DATABASE_URL)' : 'Database: in memory (set DATABASE_URL in .env to use Neon)');
  console.log(process.env.RESEND_API_KEY ? 'Email: Resend' : 'Email: printed here (set RESEND_API_KEY in .env to send)');
  if (!process.env.ADMIN_PASSWORD) console.log('Admin: set ADMIN_PASSWORD in .env to log in');
  console.log('');
});
