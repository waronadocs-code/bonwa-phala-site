(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const wide = () => innerWidth > 860;
  let H = innerHeight;

  /* ---------- hero slideshow ---------- */
  const slides = $$('.hero-media img');
  const dots = $$('#heroDots button');
  let cur = 0, timer = null;
  function show(i) {
    slides[cur].classList.remove('on');
    if (dots[cur]) dots[cur].setAttribute('aria-current', 'false');
    cur = (i + slides.length) % slides.length;
    slides[cur].loading = 'eager';
    slides[cur].classList.add('on');
    if (dots[cur]) dots[cur].setAttribute('aria-current', 'true');
    const cap = $('#heroCap');
    if (cap && dots[cur]) cap.textContent = dots[cur].dataset.cap;
  }
  function auto() { clearInterval(timer); if (!reduce && slides.length > 1) timer = setInterval(() => show(cur + 1), 6500); }
  dots.forEach((d, i) => d.addEventListener('click', () => { show(i); auto(); }));
  auto();

  /* ---------- menu ---------- */
  const header = $('#siteHeader'), menu = $('#menu'), menuBtn = $('#menuBtn');
  let menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.querySelector('span').textContent = open ? 'Close' : 'Menu';
    document.documentElement.classList.toggle('locked', open && innerWidth <= 760);
    if (open) header.classList.remove('hide');
  }
  menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  if (canHover) {
    menu.addEventListener('mouseenter', () => { if (innerWidth > 760) setMenu(true); });
    menu.addEventListener('mouseleave', () => { if (innerWidth > 760) setMenu(false); });
  }
  $$('.menu-links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => { if (menuOpen && !menu.contains(e.target)) setMenu(false); });

  /* ---------- fitted headings ---------- */
  function fitAll() {
    $$('[data-fit]').forEach(el => {
      const inner = el.firstElementChild;
      el.style.fontSize = '100px';
      const w = inner.getBoundingClientRect().width;
      const fs = 100 * el.clientWidth / w * 0.995;
      el.style.fontSize = Math.min(fs, H * (el.dataset.fit ? +el.dataset.fit : 0.34)) + 'px';
    });
  }

  /* ---------- scattered review heading ---------- */
  const chars = $('.scatter .chars');
  if (chars) (function splitScatter() {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const words = chars.textContent.split(' ');
    chars.textContent = '';
    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'w';
      for (const ch of word) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        s.style.setProperty('--dx', ((rnd() - .5) * .7).toFixed(2));
        s.style.setProperty('--dy', ((rnd() - .5) * 2.6).toFixed(2));
        s.style.setProperty('--r', ((rnd() - .5) * 30).toFixed(1));
        w.appendChild(s);
      }
      chars.appendChild(w);
      if (wi < words.length - 1) chars.appendChild(document.createTextNode(' '));
    });
  })();

  /* ---------- count-up numbers ---------- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (reduce) return;
    const num = e.target.querySelector('.num'), to = +e.target.dataset.count;
    const t0 = performance.now(), d = to > 100 ? 1400 : 1000;
    const step = t => { const k = clamp((t - t0) / d); num.textContent = Math.round(to * ease(k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  $$('[data-count]').forEach(n => io.observe(n));

  /* ---------- reveal on scroll ---------- */
  const rio = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
  }), { threshold: .15 });
  $$('.reveal').forEach(el => reduce ? el.classList.add('in') : rio.observe(el));

  /* ---------- scroll scenes ---------- */
  const hero = $('#top');
  const cards = $$('.stack .card');
  const vibes = $('.vibes'), vMid = $('.v-mid'), vBars = $$('.vibes .wipe i');
  const andSec = $('.and'), andLine = $('#andLine'), aBars = $$('.and .wipe i');
  const rv = $('#reviews'), rvStick = $('#rvStick'), track = $('#rvTrack');
  const squash = $('.squash');
  let lastY = scrollY, rvOver = 0;

  const sceneP = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - H)); };
  const bars = (list, p, start) => list.forEach((b, i) => {
    const t = ease(clamp((p - start - i * .04) / .18));
    b.style.transform = `translateY(${((1 - t) * 101).toFixed(2)}%)`;
    if (i === 0) b.style.clipPath = `polygon(${(22 * (1 - t)).toFixed(1)}% 0,100% 0,100% 100%,0 100%)`;
  });

  function sizeReviews() {
    if (!rv) return;
    if (!wide() || reduce) { rv.style.height = ''; rvOver = 0; return; }
    rvOver = Math.max(0, track.scrollWidth - innerWidth);
    rv.style.height = (rvStick.offsetHeight + rvOver) + 'px';
  }

  function frame() {
    const y = scrollY;
    const pastHero = y > (hero ? hero.offsetHeight : 0) - 140;
    header.classList.toggle('stuck', pastHero);
    if (pastHero && !menuOpen) {
      if (y > lastY + 4) header.classList.add('hide');
      else if (y < lastY - 4) header.classList.remove('hide');
    } else header.classList.remove('hide');
    lastY = y;

    if (reduce) return;

    if (wide()) cards.forEach((c, i) => {
      const panel = c.firstElementChild;
      const top = c.getBoundingClientRect().top;
      const inP = i === 0 ? 1 : clamp(1 - top / H);
      const next = cards[i + 1];
      const outP = next ? clamp(1 - next.getBoundingClientRect().top / H) : 0;
      const s = (.9 + .1 * ease(inP)) * (1 - .05 * outP);
      panel.style.transform = `scale(${s.toFixed(4)})`;
      panel.style.setProperty('--fade', (1 - .7 * outP).toFixed(3));
    });

    if (vibes) {
      const vp = sceneP(vibes);
      vibes.style.setProperty('--p', ease(clamp(vp / .7)).toFixed(4));
      const maxFs = innerWidth / 5.6;
      vMid.style.setProperty('--fs', (28 + (maxFs - 28) * ease(clamp(vp / .68))).toFixed(1));
      bars(vBars, vp, .62);
    }

    if (andSec) {
      const ap = sceneP(andSec);
      const dist = Math.max(0, andLine.offsetWidth - innerWidth + 40);
      andLine.style.transform = `translateX(${(-dist * clamp(ap / .66)).toFixed(1)}px)`;
      bars(aBars, ap, .62);
    }

    if (rv) {
      const r = rv.getBoundingClientRect();
      const q = clamp((H - r.top) / (H * .8));
      chars.style.setProperty('--k', (1 - ease(q)).toFixed(3));
      if (wide() && rvOver) track.style.transform = `translateX(${(-rvOver * sceneP(rv)).toFixed(1)}px)`;
      else track.style.transform = '';
    }

    if (squash) {
      const sr = squash.getBoundingClientRect();
      squash.style.setProperty('--sy', (.26 + .74 * ease(clamp((H - sr.top) / (H * .62)))).toFixed(3));
    }
  }
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
  addEventListener('scroll', onScroll, { passive: true });

  let lastW = innerWidth;
  function layout() { H = innerHeight; fitAll(); sizeReviews(); frame(); }
  addEventListener('resize', () => {
    if (innerWidth !== lastW) { lastW = innerWidth; layout(); }
    else { H = innerHeight; onScroll(); }
  });
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  addEventListener('load', layout);

  /* ---------- copy helper ---------- */
  function copyText(text, btn, fallback) {
    const label = btn.querySelector('span') || btn;
    const done = msg => { const old = label.dataset.l || label.textContent; label.dataset.l = old; label.textContent = msg; setTimeout(() => { label.textContent = old; }, 2200); };
    const fail = () => {
      if (fallback) { fallback.hidden = false; fallback.value = text; fallback.focus(); fallback.select(); done('Select and copy'); }
      else { const sel = getSelection(), range = document.createRange(); range.selectNodeContents($('#mailText')); sel.removeAllRanges(); sel.addRange(range); done('Selected'); }
    };
    try { navigator.clipboard.writeText(text).then(() => done('Copied'), fail); } catch (e) { fail(); }
  }
  $('#copyMail').addEventListener('click', e => copyText('bookings@bonwaphala.africa', e.currentTarget));

  /* ---------- booking panel ---------- */
  const book = $('#book'), form = $('#bookForm');
  const f = id => $('#' + id);
  const RATE = 1500;
  const LODGES = { main: { name: 'Main Lodge', cap: 30, rooms: 10 }, bush: { name: 'Bush Lodge', cap: 20 } };
  const rand = n => 'R' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const today = new Date();
  f('arrive').min = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const nice = v => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };

  function state() {
    const L = LODGES[form.elements.lodge.value] || LODGES.main;
    const whole = form.elements.stay.value === 'whole';
    const nights = clamp(parseInt(f('nights').value, 10) || 1, 1, 60);
    const rooms = clamp(parseInt(f('rooms').value, 10) || 1, 1, L.rooms || 40);
    const guests = clamp(parseInt(f('guests').value, 10) || 1, 1, 200);
    return { L, whole, nights, rooms, guests };
  }
  function compose() {
    const { L, whole, nights, rooms, guests } = state();
    const lines = [
      whole ? `Hi Bonwa Phala! I'd like a quote for the whole ${L.name} (exclusive use).`
            : `Hi Bonwa Phala! I'd like to book ${plural(rooms, 'room')} at the ${L.name}.`,
      `Arrival: ${f('arrive').value ? nice(f('arrive').value) : 'Flexible'} · ${plural(nights, 'night')}`,
      `Guests: ${guests}`,
      `Occasion: ${f('occasion').value}`
    ];
    if (!whole) lines.push(`Rate: ${plural(rooms, 'room')} × ${plural(nights, 'night')} × ${rand(RATE)} = ${rand(RATE * rooms * nights)}`);
    const name = f('gname').value.trim(), msg = f('gmsg').value.trim();
    if (name) lines.push(`Name: ${name}`);
    if (msg) lines.push('', msg);
    return lines.join('\n');
  }
  function update() {
    const { L, whole, nights, rooms, guests } = state();
    f('roomsFld').hidden = whole;
    f('rooms').max = L.rooms || 40;
    if (whole) {
      f('estK').textContent = 'Whole lodge';
      f('est').textContent = 'On request';
      f('estNote').textContent = `Exclusive use of the ${L.name} is quoted on an ad hoc basis. We'll reply with a rate.`;
    } else {
      f('estK').textContent = 'Estimated rate';
      f('est').textContent = rand(RATE * rooms * nights);
      f('estNote').textContent = `${plural(rooms, 'room')} × ${plural(nights, 'night')} × ${rand(RATE)} per room, per night.`;
    }
    const notes = [];
    if (guests > L.cap) notes.push(`The ${L.name} sleeps up to ${L.cap} guests.`);
    if (!whole && L.rooms && +f('rooms').value > L.rooms) notes.push(`The ${L.name} has ${L.rooms} chalets.`);
    f('capNote').hidden = !notes.length;
    f('capNote').textContent = notes.join(' ');
    f('waLink').href = 'https://wa.me/27761300915?text=' + encodeURIComponent(compose());
    f('mailLink').href = 'mailto:bookings@bonwaphala.africa?subject=' + encodeURIComponent(whole ? `Quote request: whole ${L.name}` : `Booking enquiry: ${L.name}`) + '&body=' + encodeURIComponent(compose());
    f('copyFallback').hidden = true;
  }
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', e => e.preventDefault());
  f('copyBtn').addEventListener('click', e => copyText(compose(), e.currentTarget, f('copyFallback')));

  let returnTo = null;
  function openBook(btn) {
    returnTo = document.activeElement;
    const which = btn.dataset.book, stay = btn.dataset.stay, occ = btn.dataset.occasion;
    if (which && LODGES[which]) form.elements.lodge.value = which;
    if (stay) form.elements.stay.value = stay;
    if (occ) f('occasion').value = occ;
    setMenu(false);
    book.hidden = false;
    document.documentElement.classList.add('locked');
    update();
    setTimeout(() => (which ? f('arrive') : form.querySelector('input:checked')).focus(), 60);
  }
  function closeBook() {
    book.hidden = true;
    document.documentElement.classList.remove('locked');
    if (returnTo && returnTo.focus) returnTo.focus();
  }
  $$('[data-book]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openBook(b); }));
  book.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeBook(); });

  /* ---------- gallery ---------- */
  const lb = $('#lb');
  const shots = $$('.shot');
  let shown = [], at = 0;
  $$('.chip[data-filter]').forEach(chip => chip.addEventListener('click', () => {
    $$('.chip[data-filter]').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    const k = chip.dataset.filter;
    shots.forEach(s => { s.hidden = k !== 'all' && !s.dataset.tags.split(' ').includes(k); });
  }));
  function lbShow(i) {
    at = (i + shown.length) % shown.length;
    const img = shown[at].querySelector('img');
    const big = $('#lbImg');
    big.src = img.currentSrc.replace('-sm.jpg', '.jpg');
    big.alt = img.alt;
    $('#lbCap').textContent = shown[at].querySelector('figcaption').textContent;
    $('#lbCount').textContent = `${at + 1} / ${shown.length}`;
  }
  function lbOpen(shot) {
    shown = shots.filter(s => !s.hidden);
    returnTo = document.activeElement;
    lb.hidden = false;
    document.documentElement.classList.add('locked');
    lbShow(shown.indexOf(shot));
    $('#lbClose').focus();
  }
  function lbClose() {
    lb.hidden = true;
    document.documentElement.classList.remove('locked');
    if (returnTo && returnTo.focus) returnTo.focus();
  }
  if (lb) {
    shots.forEach(s => s.querySelector('button').addEventListener('click', () => lbOpen(s)));
    $('#lbPrev').addEventListener('click', () => lbShow(at - 1));
    $('#lbNext').addEventListener('click', () => lbShow(at + 1));
    lb.addEventListener('click', e => { if (e.target.closest('[data-lb-close]')) lbClose(); });
    let x0 = null;
    lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) lbShow(at + (dx < 0 ? 1 : -1)); x0 = null; });
  }

  /* ---------- keyboard ---------- */
  const trap = (e, root) => {
    const items = $$('button, a[href], input, select, textarea', root).filter(el => !el.hidden && el.offsetParent !== null);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', e => {
    if (lb && !lb.hidden) {
      if (e.key === 'Escape') lbClose();
      else if (e.key === 'ArrowLeft') lbShow(at - 1);
      else if (e.key === 'ArrowRight') lbShow(at + 1);
      else if (e.key === 'Tab') trap(e, lb);
      return;
    }
    if (e.key === 'Escape') { if (!book.hidden) closeBook(); else if (menuOpen) { setMenu(false); menuBtn.focus(); } }
    if (e.key === 'Tab' && !book.hidden) trap(e, form);
  });
  update();
})();
