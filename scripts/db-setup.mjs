// Creates the database tables: `npm run db:setup`
// Needs DATABASE_URL in .env (copy it from the Neon dashboard or Vercel's
// Storage tab). Safe to run more than once.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const root = resolve(import.meta.dirname, '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env first.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = (await readFile(join(root, 'db', 'schema.sql'), 'utf8')).replace(/--.*$/gm, '');
const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
for (const s of statements) await sql.query(s);
console.log(`Database ready (${statements.length} statements run).`);
