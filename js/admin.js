(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(k => k != null && n.append(k));
    return n;
  };

  const LODGES = { main: 'Main Lodge', bush: 'Bush Lodge' };
  const STATUSES = ['new', 'contacted', 'confirmed', 'declined', 'cancelled'];
  const LABEL = { new: 'New', contacted: 'Contacted', confirmed: 'Confirmed', declined: 'Declined', cancelled: 'Cancelled' };
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const nice = s => new Date(s + 'T00:00:00Z').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const when = s => new Date(s).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const rand = n => 'R' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ---------- API ---------- */
  class Unauthorized extends Error {}
  async function api(path, { method = 'GET', body } = {}) {
    const r = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !path.endsWith('/session')) { showLogin(); throw new Unauthorized(); }
    if (!r.ok) { const e = new Error(data.error || `Request failed (${r.status})`); e.status = r.status; e.data = data; throw e; }
    return data;
  }
  const msg = (node, text) => { node.textContent = text || ''; node.hidden = !text; };

  /* ---------- login ---------- */
  function showLogin() {
    $('#dash').hidden = true;
    $('#logout').hidden = true;
    $('#loginView').hidden = false;
    $('#password').focus();
  }
  function showDash() {
    $('#loginView').hidden = true;
    $('#dash').hidden = false;
    $('#logout').hidden = false;
    loadEnquiries();
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    msg($('#loginMsg'));
    try {
      await api('/api/admin/session', { method: 'POST', body: { password: $('#password').value } });
      $('#password').value = '';
      showDash();
    } catch (err) { msg($('#loginMsg'), err.message); }
  });
  $('#logout').addEventListener('click', async () => {
    await api('/api/admin/session', { method: 'DELETE' }).catch(() => {});
    showLogin();
  });

  /* ---------- tabs ---------- */
  const tabs = $$('[role=tab]');
  function selectTab(tab) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (tab.id === 'tabCal') loadCalendar();
    else loadEnquiries();
  }
  tabs.forEach(t => t.addEventListener('click', () => selectTab(t)));
  $('.adm-tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const i = (tabs.indexOf(document.activeElement) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[i].focus(); selectTab(tabs[i]);
  });

  /* ---------- enquiries ---------- */
  let enquiries = [], filter = 'new';

  async function loadEnquiries() {
    try { enquiries = (await api('/api/admin/enquiries')).enquiries; }
    catch (err) { if (!(err instanceof Unauthorized)) msg($('#enqEmpty'), err.message); return; }
    renderEnquiries();
  }

  function renderEnquiries() {
    const counts = Object.fromEntries(STATUSES.map(s => [s, enquiries.filter(e => e.status === s).length]));
    $('#newCount').textContent = counts.new ? counts.new : '';
    $('#statusChips').replaceChildren(...['all', ...STATUSES].map(s =>
      el('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter === s), onclick: () => { filter = s; renderEnquiries(); } },
        s === 'all' ? `All (${enquiries.length})` : `${LABEL[s]} (${counts[s]})`)));
    const shown = enquiries.filter(e => filter === 'all' || e.status === filter);
    $('#enqEmpty').textContent = filter === 'all' ? 'No enquiries yet.' : `No ${LABEL[filter].toLowerCase()} enquiries.`;
    $('#enqEmpty').hidden = shown.length > 0;
    $('#enqList').replaceChildren(...shown.map(enquiryCard));
  }

  function enquiryCard(e) {
    const dates = e.arrival ? `${nice(e.arrival)} → ${nice(addDays(e.arrival, e.nights))}` : 'Flexible dates';
    const what = e.stay === 'whole' ? 'Whole lodge' : plural(e.rooms, 'room');
    const status = el('select', { 'aria-label': 'Status' }, STATUSES.map(s => el('option', { value: s, selected: s === e.status }, LABEL[s])));
    const notes = el('textarea', { rows: 3, 'aria-label': 'Notes for the team', placeholder: 'Notes for the team (only visible here)' }, e.adminNotes || '');
    const out = el('p', { class: 'form-msg', role: 'alert', hidden: true });
    const force = el('button', { class: 'pill pill-line', type: 'button', hidden: true }, 'Confirm anyway');

    async function save(forceIt) {
      msg(out); force.hidden = true;
      try {
        const { enquiry } = await api(`/api/admin/enquiries?id=${e.id}`, { method: 'PATCH', body: { status: status.value, adminNotes: notes.value, force: !!forceIt } });
        Object.assign(e, enquiry);
        renderEnquiries();
      } catch (err) {
        if (err instanceof Unauthorized) return;
        msg(out, err.status === 409 ? `${err.message} Already booked: ${err.data.conflicts.map(nice).join(', ')}.` : err.message);
        force.hidden = err.status !== 409;
      }
    }
    force.addEventListener('click', () => save(true));

    const wa = e.phone && e.phone.replace(/\D/g, '').replace(/^0/, '27');
    return el('li', { class: `enq is-${e.status}` },
      el('details', {},
        el('summary', {},
          el('span', { class: `badge b-${e.status}` }, LABEL[e.status]),
          el('span', { class: 'enq-who' }, el('b', {}, e.name), el('small', {}, `#${e.id} · ${when(e.createdAt)}`)),
          el('span', { class: 'enq-what' }, el('b', {}, `${LODGES[e.lodge]} · ${what}`), el('small', {}, `${dates} · ${plural(e.guests, 'guest')}`)),
          el('span', { class: 'enq-rate' }, e.estTotal != null ? rand(e.estTotal) : 'Quote')),
        el('div', { class: 'enq-body' },
          el('dl', {},
            el('dt', {}, 'Email'), el('dd', {}, el('a', { href: `mailto:${e.email}?subject=${encodeURIComponent('Your Bonwa Phala enquiry #' + e.id)}` }, e.email)),
            el('dt', {}, 'Phone'), el('dd', {}, e.phone ? [el('a', { href: `tel:${e.phone.replace(/[^\d+]/g, '')}` }, e.phone), ' · ', el('a', { href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener' }, 'WhatsApp')] : '-'),
            el('dt', {}, 'Occasion'), el('dd', {}, e.occasion),
            el('dt', {}, 'Nights'), el('dd', {}, plural(e.nights, 'night')),
            el('dt', {}, 'Message'), el('dd', { class: 'enq-msg' }, e.message || '-')),
          el('div', { class: 'enq-edit' },
            el('label', { class: 'fld' }, el('span', {}, 'Status'), status),
            el('label', { class: 'fld' }, el('span', {}, 'Notes'), notes),
            out,
            el('div', { class: 'btn-row' }, el('button', { class: 'pill pill-ink', type: 'button', onclick: () => save(false) }, 'Save'), force),
            el('p', { class: 'adm-help' }, 'Confirmed enquiries with dates are marked as booked on the calendar.')))));
  }

  /* ---------- calendar & blocks ---------- */
  const lodgeNow = () => $('input[name=calLodge]:checked').value;
  let nights = {};
  const admCal = BonwaCalendar($('#admCal'), {
    min: TODAY, months: 2,
    day: d => {
      const b = nights[d];
      if (!b) return {};
      return b.full ? { cls: 'is-full', label: 'fully booked' }
                    : { cls: 'is-part', label: b.left != null ? `${plural(b.left, 'room')} left` : 'some rooms booked' };
    },
  });

  async function loadCalendar() {
    try {
      const [a, b] = await Promise.all([
        api(`/api/availability?lodge=${lodgeNow()}&from=${TODAY}&to=${addDays(TODAY, 400)}`),
        api('/api/admin/blocks'),
      ]);
      nights = a.nights;
      admCal.render();
      renderBlocks(b.blocks);
    } catch (err) { if (!(err instanceof Unauthorized)) msg($('#blockMsg'), err.message); }
  }
  $$('input[name=calLodge]').forEach(r => r.addEventListener('change', () => { $('#bLodge').value = lodgeNow(); loadCalendar(); }));

  function renderBlocks(blocks) {
    $('#blockEmpty').hidden = blocks.length > 0;
    $('#blockList').replaceChildren(...blocks.map(b => {
      const remove = el('button', {
        class: 'x', type: 'button', 'aria-label': `Remove block ${nice(b.startDate)} to ${nice(b.endDate)}`,
        onclick: async () => {
          if (!confirm('Remove this block? Those dates become bookable again.')) return;
          try { await api(`/api/admin/blocks?id=${b.id}`, { method: 'DELETE' }); loadCalendar(); }
          catch (err) { if (!(err instanceof Unauthorized)) alert(err.message); }
        },
      });
      remove.innerHTML = '<svg><use href="#i-x"/></svg>';
      return el('li', {},
        el('div', {},
          el('b', {}, `${LODGES[b.lodge]} · ${b.rooms ? plural(b.rooms, 'room') : 'whole lodge'}`),
          el('small', {}, `${nice(b.startDate)} → ${nice(b.endDate)} (${plural(Math.round((Date.parse(b.endDate) - Date.parse(b.startDate)) / 864e5), 'night')})`),
          b.note ? el('small', {}, b.note) : null),
        remove);
    }));
  }

  $('#blockForm').addEventListener('submit', async e => {
    e.preventDefault();
    msg($('#blockMsg'));
    $$('#blockForm .fld-err').forEach(n => n.remove());
    $$('#blockForm .has-err').forEach(n => n.classList.remove('has-err'));
    try {
      await api('/api/admin/blocks', { method: 'POST', body: {
        lodge: $('#bLodge').value, startDate: $('#bStart').value, endDate: $('#bEnd').value,
        rooms: $('#bRooms').value === '' ? null : Number($('#bRooms').value), note: $('#bNote').value,
      } });
      $('#bStart').value = $('#bEnd').value = $('#bRooms').value = $('#bNote').value = '';
      loadCalendar();
    } catch (err) {
      if (err instanceof Unauthorized) return;
      msg($('#blockMsg'), err.message);
      Object.entries(err.data?.errors || {}).forEach(([k, m]) => {
        const box = $(`#blockForm [data-f="${k}"]`);
        if (box) { box.classList.add('has-err'); box.append(el('small', { class: 'fld-err' }, m)); }
      });
    }
  });
  $('#bStart').min = $('#bEnd').min = TODAY;
  $('#bStart').addEventListener('change', () => { if (!$('#bEnd').value || $('#bEnd').value <= $('#bStart').value) $('#bEnd').value = addDays($('#bStart').value, 1); });

  /* ---------- start ---------- */
  api('/api/admin/session').then(d => (d.admin ? showDash() : showLogin())).catch(err => {
    showLogin();
    msg($('#loginMsg'), err.message);
  });
})();
