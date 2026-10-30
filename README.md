# Bonwa Phala Game Lodge website

Static site (HTML, CSS, JavaScript) plus a small backend in `api/` that runs as
Vercel functions:

- **Booking enquiries**: the "Plan your stay" panel sends enquiries to
  `POST /api/enquiries`. Each one is saved, the lodge gets an email, and the
  guest gets a confirmation. WhatsApp and email links stay as a fallback.
- **Availability**: the panel's calendar greys out booked nights, from
  `GET /api/availability`.
- **Admin page** at `/admin`: log in with a password to see and update
  enquiries, and block dates (phone bookings, maintenance, private use).
  Confirmed enquiries and blocks are what make nights show as booked.

## Run it on your computer

Needs Node.js 22 or newer.

```
npm install
copy .env.example .env      (Windows; use cp on Mac/Linux)
npm run dev
```

Then open http://localhost:3000 and http://localhost:3000/admin.

Set at least `ADMIN_PASSWORD` in `.env` to use the admin page. Without
`DATABASE_URL`, enquiries are kept in memory and disappear when you stop the
server. Without `RESEND_API_KEY`, emails are printed in the terminal instead
of being sent.

`npm test` runs the tests.

## Set it up on Vercel

1. **Database.** In the Vercel project, open **Storage → Create → Neon
   (Postgres)** and connect it to this project. That adds `DATABASE_URL`.
   Create the tables once: paste `db/schema.sql` into the Neon SQL editor, or
   put `DATABASE_URL` in your local `.env` and run `npm run db:setup`.
2. **Email.** Make a free account at resend.com, verify the
   `bonwaphala.africa` domain (Resend shows the DNS records to add), and create
   an API key.
3. **Environment variables.** In **Settings → Environment Variables**, add
   `ADMIN_PASSWORD`, `RESEND_API_KEY`, `MAIL_FROM` and `LODGE_EMAIL` (see
   `.env.example`). Redeploy afterwards.

Until the database is connected, the live site still works, but "Send
enquiry" answers that bookings are unavailable and points guests to WhatsApp
and email.

## Where things are

| Path | What it is |
| --- | --- |
| `*.html`, `css/`, `js/`, `img/` | The website |
| `js/calendar.js` | Month calendar used by the booking panel and admin page |
| `admin.html`, `js/admin.js`, `css/admin.css` | Admin page |
| `api/enquiries.js` | Save an enquiry and send the emails |
| `api/availability.js` | Booked nights per lodge |
| `api/admin/*.js` | Admin login, enquiries and date blocks |
| `api/_lib/` | Shared code: lodge settings, validation, database, email, login |
| `db/schema.sql` | Database tables |
| `scripts/dev-server.mjs` | Local server for `npm run dev` |
| `test/` | Tests (`npm test`) |

Lodge settings (room counts, guest limits, the R1,500 rate) are in
`api/_lib/lodges.js`. The Bush Lodge room count isn't confirmed yet; set
`rooms` there once it is, and update `LODGES` in `js/site.js` to match.
