import { LODGES } from './lodges.js';
import { addDays } from './dates.js';

// Email goes out through Resend (resend.com). Without RESEND_API_KEY, emails
// are printed to the console instead, which is handy locally. On Vercel a
// missing key is logged as a warning; the enquiry is still saved and shows up
// on the admin page.

const LODGE_EMAIL = () => process.env.LODGE_EMAIL || 'bookings@bonwaphala.africa';
const FROM = () => process.env.MAIL_FROM || 'Bonwa Phala Game Lodge <bookings@bonwaphala.africa>';

export async function sendEmail({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.VERCEL) console.warn(`[bonwa] RESEND_API_KEY not set; email "${subject}" to ${to} was not sent`);
    else console.log(`\n--- email (not sent, no RESEND_API_KEY) ---\nTo: ${to}\nReply-To: ${replyTo || '-'}\nSubject: ${subject}\n\n${text}\n---\n`);
    return { sent: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM(), to: [to], subject, html, text, reply_to: replyTo }),
  });
  if (!res.ok) {
    console.error(`[bonwa] Resend refused email "${subject}" to ${to}: ${res.status} ${await res.text()}`);
    return { sent: false };
  }
  return { sent: true };
}

/* ---------- templates ---------- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = n => 'R' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const nice = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function summary(e) {
  const L = LODGES[e.lodge];
  return [
    ['Lodge', L.name],
    ['Booking', e.stay === 'whole' ? 'Whole lodge (exclusive use)' : plural(e.rooms, 'room')],
    ['Dates', e.arrival ? `${nice(e.arrival)} to ${nice(addDays(e.arrival, e.nights))} (${plural(e.nights, 'night')})` : `Flexible, ${plural(e.nights, 'night')}`],
    ['Guests', String(e.guests)],
    ['Occasion', e.occasion],
    ['Estimated rate', e.estTotal != null ? `${rand(e.estTotal)} (${plural(e.rooms, 'room')} × ${plural(e.nights, 'night')} × R1,500)` : 'Quoted on request'],
  ];
}

function layout(title, rows, intro, outro = '') {
  const table = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#5B4A33;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#1B140C">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#FFF6DA;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  <div style="background:#FFC20A;padding:20px 24px;border-radius:16px 16px 0 0"><h1 style="margin:0;font-size:24px;color:#1B140C">${esc(title)}</h1></div>
  <div style="background:#FFFDF6;padding:24px;border-radius:0 0 16px 16px;font-size:15px;line-height:1.5;color:#1B140C">
    ${intro}
    <table style="border-collapse:collapse;margin:16px 0;font-size:15px">${table}</table>
    ${outro}
  </div>
  <p style="font-size:12px;color:#5B4A33;text-align:center;margin-top:16px">Bonwa Phala Game Lodge · R516, Thabazimbi Road, Bela-Bela, Limpopo</p>
</div></body></html>`;
}

const textOf = (title, rows, lines) => [title, '', ...lines, '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n');

export function lodgeNotification(e, conflicts = []) {
  const rows = [...summary(e), ['Name', e.name], ['Email', e.email], ['Phone', e.phone || '-'], ['Message', e.message || '-']];
  const warn = conflicts.length
    ? `<p style="background:#FFE38C;padding:10px 12px;border-radius:8px"><b>Heads up:</b> these nights already look booked: ${esc(conflicts.join(', '))}.</p>` : '';
  const subject = `New enquiry #${e.id}: ${LODGES[e.lodge].name}${e.arrival ? ', ' + nice(e.arrival) : ''} (${e.name})`;
  const intro = `<p>A new booking enquiry came in through the website. Reply to this email to answer ${esc(e.name)} directly.</p>${warn}`;
  return {
    to: LODGE_EMAIL(),
    replyTo: e.email,
    subject,
    html: layout(`New enquiry #${e.id}`, rows, intro, '<p>Update its status on the admin page once you’ve replied.</p>'),
    text: textOf(`New enquiry #${e.id}`, rows, ['Reply to this email to answer the guest directly.', ...(conflicts.length ? [`Heads up: already booked: ${conflicts.join(', ')}`] : [])]),
  };
}

export function guestConfirmation(e) {
  const rows = summary(e);
  const first = e.name.split(/\s+/)[0];
  const intro = `<p>Hi ${esc(first)},</p><p>Thanks for your enquiry. We’ve received it and Laruchelle will get back to you shortly to confirm availability${e.stay === 'whole' ? ' and a quote for the whole lodge' : ''}. Your booking isn’t confirmed until we reply.</p>`;
  const outro = '<p>Questions in the meantime? Reply to this email or WhatsApp us on 076 130 0915.</p><p>See you in the bush,<br>Bonwa Phala Game Lodge</p>';
  return {
    to: e.email,
    replyTo: LODGE_EMAIL(),
    subject: 'We’ve received your enquiry · Bonwa Phala Game Lodge',
    html: layout('Thanks for your enquiry', rows, intro, outro),
    text: textOf('Thanks for your enquiry', rows, [`Hi ${first},`, 'We’ve received your enquiry and will get back to you shortly. Your booking isn’t confirmed until we reply.', 'WhatsApp: 076 130 0915']),
  };
}
