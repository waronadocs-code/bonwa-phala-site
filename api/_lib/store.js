import { addDays } from './dates.js';

// Two interchangeable stores:
// - Postgres (Neon) when DATABASE_URL is set. This is what runs on Vercel.
// - In memory otherwise, so `npm run dev` works before a database exists.
//   Data is lost when the dev server stops. Never used on Vercel: a deployed
//   site without a database answers 503 instead of quietly losing enquiries.

export class StoreUnavailable extends Error {}

let store;
export async function getStore() {
  if (store) return store;
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    store = pgStore(neon(process.env.DATABASE_URL));
  } else if (process.env.VERCEL) {
    throw new StoreUnavailable('DATABASE_URL is not set');
  } else {
    store = memoryStore();
  }
  return store;
}

// For tests.
export function useStore(s) { store = s; }

/* ---------- Postgres ---------- */

const ENQUIRY_COLS = `id::int as id, created_at as "createdAt", updated_at as "updatedAt", lodge, stay,
  arrival::text as arrival, nights, rooms, guests, occasion, name, email, phone, message,
  est_total as "estTotal", status, admin_notes as "adminNotes"`;
const BLOCK_COLS = `id::int as id, created_at as "createdAt", lodge, start_date::text as "startDate",
  end_date::text as "endDate", rooms, note`;

function pgStore(sql) {
  const q = (text, params = []) => sql.query(text, params);
  return {
    kind: 'postgres',

    async insertEnquiry(v) {
      const [row] = await q(
        `insert into enquiries (lodge, stay, arrival, nights, rooms, guests, occasion, name, email, phone, message, est_total)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning ${ENQUIRY_COLS}`,
        [v.lodge, v.stay, v.arrival, v.nights, v.rooms, v.guests, v.occasion, v.name, v.email, v.phone, v.message, v.estTotal]);
      return row;
    },

    async listEnquiries({ status } = {}) {
      return status
        ? q(`select ${ENQUIRY_COLS} from enquiries where status = $1 order by created_at desc limit 500`, [status])
        : q(`select ${ENQUIRY_COLS} from enquiries order by created_at desc limit 500`);
    },

    async getEnquiry(id) {
      const [row] = await q(`select ${ENQUIRY_COLS} from enquiries where id = $1`, [id]);
      return row || null;
    },

    async updateEnquiry(id, { status, adminNotes }) {
      const [row] = await q(
        `update enquiries set status = coalesce($2, status), admin_notes = coalesce($3, admin_notes), updated_at = now()
         where id = $1 returning ${ENQUIRY_COLS}`, [id, status ?? null, adminNotes ?? null]);
      return row || null;
    },

    // Blocks and confirmed enquiries overlapping [from, to), optionally
    // leaving out one enquiry (the one being confirmed).
    async occupancies(lodge, from, to, { exceptEnquiryId = null } = {}) {
      const blocks = await q(
        `select start_date::text as "startDate", end_date::text as "endDate", rooms from blocks
         where lodge = $1 and start_date < $3 and end_date > $2`, [lodge, from, to]);
      const confirmed = await q(
        `select arrival::text as "startDate", (arrival + nights)::text as "endDate",
                case when stay = 'whole' then null else rooms end as rooms
         from enquiries
         where lodge = $1 and status = 'confirmed' and arrival is not null
           and arrival < $3 and arrival + nights > $2 and ($4::bigint is null or id <> $4)`,
        [lodge, from, to, exceptEnquiryId]);
      return [...blocks, ...confirmed];
    },

    async listBlocks({ from } = {}) {
      return from
        ? q(`select ${BLOCK_COLS} from blocks where end_date > $1 order by start_date, lodge limit 500`, [from])
        : q(`select ${BLOCK_COLS} from blocks order by start_date, lodge limit 500`);
    },

    async insertBlock(v) {
      const [row] = await q(
        `insert into blocks (lodge, start_date, end_date, rooms, note) values ($1,$2,$3,$4,$5) returning ${BLOCK_COLS}`,
        [v.lodge, v.startDate, v.endDate, v.rooms, v.note]);
      return row;
    },

    async deleteBlock(id) {
      const rows = await q(`delete from blocks where id = $1 returning id`, [id]);
      return rows.length > 0;
    },
  };
}

/* ---------- In memory (local development only) ---------- */

export function memoryStore() {
  const enquiries = [], blocks = [];
  let nextId = 1;
  const now = () => new Date().toISOString();
  const copy = o => (o ? { ...o } : null);
  const overlaps = (s, e, from, to) => s < to && e > from;

  return {
    kind: 'memory',

    async insertEnquiry(v) {
      const row = { id: nextId++, createdAt: now(), updatedAt: now(), status: 'new', adminNotes: '', ...v };
      enquiries.push(row);
      return copy(row);
    },
    async listEnquiries({ status } = {}) {
      return enquiries.filter(e => !status || e.status === status).reverse().map(copy);
    },
    async getEnquiry(id) { return copy(enquiries.find(e => e.id === id)); },
    async updateEnquiry(id, { status, adminNotes }) {
      const e = enquiries.find(x => x.id === id);
      if (!e) return null;
      if (status != null) e.status = status;
      if (adminNotes != null) e.adminNotes = adminNotes;
      e.updatedAt = now();
      return copy(e);
    },
    async occupancies(lodge, from, to, { exceptEnquiryId = null } = {}) {
      const b = blocks.filter(x => x.lodge === lodge && overlaps(x.startDate, x.endDate, from, to))
        .map(({ startDate, endDate, rooms }) => ({ startDate, endDate, rooms }));
      const c = enquiries
        .filter(e => e.lodge === lodge && e.status === 'confirmed' && e.arrival && e.id !== exceptEnquiryId)
        .map(e => ({ startDate: e.arrival, endDate: addDays(e.arrival, e.nights), rooms: e.stay === 'whole' ? null : e.rooms }))
        .filter(o => overlaps(o.startDate, o.endDate, from, to));
      return [...b, ...c];
    },
    async listBlocks({ from } = {}) {
      return blocks.filter(b => !from || b.endDate > from)
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.lodge.localeCompare(b.lodge)).map(copy);
    },
    async insertBlock(v) {
      const row = { id: nextId++, createdAt: now(), ...v };
      blocks.push(row);
      return copy(row);
    },
    async deleteBlock(id) {
      const i = blocks.findIndex(b => b.id === id);
      if (i < 0) return false;
      blocks.splice(i, 1);
      return true;
    },
  };
}
