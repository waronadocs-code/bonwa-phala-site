// Month calendar used by the booking panel (to pick an arrival date) and the
// admin page (to see what's booked). Dates are 'YYYY-MM-DD' strings.
//
//   const cal = BonwaCalendar(el, {
//     min: '2026-11-01',                  // earlier days are disabled
//     day: iso => ({ disabled, cls, label }),  // per-day state
//     onPick: iso => {},                  // omit for a read-only calendar
//     months: 1,                          // how many months side by side
//   });
//   cal.render(); cal.show('2027-01-01'); cal.focusDay();
(function () {
  const iso = d => d.toISOString().slice(0, 10);
  const parse = s => new Date(s + 'T00:00:00Z');
  const addMonths = (s, n) => { const d = parse(s.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
  const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const monthName = s => parse(s).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const longDate = s => parse(s).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11.2M9.2 3.6 13.6 8l-4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  window.BonwaCalendar = function (el, opts) {
    const o = Object.assign({ months: 1, day: () => ({}) }, opts);
    let start = (o.start || o.min || iso(new Date())).slice(0, 7) + '-01';
    let focus = null;

    function render() {
      const minMonth = o.min ? o.min.slice(0, 7) + '-01' : null;
      let html = `<div class="cal-nav">
        <button type="button" class="cal-btn cal-prev" aria-label="Previous month"${minMonth && start <= minMonth ? ' disabled' : ''}>${arrow}</button>
        <button type="button" class="cal-btn cal-next" aria-label="Next month">${arrow}</button>
      </div><div class="cal-months">`;
      for (let m = 0; m < o.months; m++) {
        const first = addMonths(start, m);
        const lead = (parse(first).getUTCDay() + 6) % 7;
        const days = new Date(Date.UTC(+first.slice(0, 4), +first.slice(5, 7), 0)).getUTCDate();
        html += `<div class="cal-month"><p class="cal-title">${monthName(first)}</p>
          <div class="cal-grid" role="grid" aria-label="${monthName(first)}">
          <div class="cal-row" role="row">${WEEK.map(w => `<span class="cal-wd" role="columnheader">${w}</span>`).join('')}</div><div class="cal-row" role="row">`;
        for (let i = 0; i < lead; i++) html += '<span class="cal-pad" role="gridcell"></span>';
        for (let n = 1; n <= days; n++) {
          const d = first.slice(0, 8) + String(n).padStart(2, '0');
          const st = Object.assign({}, o.day(d));
          const disabled = st.disabled || (o.min && d < o.min);
          const label = longDate(d) + (st.label ? ', ' + st.label : '');
          const tag = o.onPick ? 'button' : 'span';
          html += `<span role="gridcell"><${tag}${tag === 'button' ? ' type="button"' : ''} class="cal-day ${st.cls || ''}${disabled ? ' is-off' : ''}" data-d="${d}" aria-label="${label}"${st.pressed ? ' aria-pressed="true"' : ''}${disabled && tag === 'button' ? ' aria-disabled="true"' : ''} tabindex="-1">${n}</${tag}></span>`;
          if ((lead + n) % 7 === 0 && n < days) html += '</div><div class="cal-row" role="row">';
        }
        html += '</div></div></div>';
      }
      el.innerHTML = html + '</div>';
      // Roving focus: exactly one day is in the tab order.
      const days = [...el.querySelectorAll('button.cal-day')];
      const pick = days.find(b => b.dataset.d === focus) || days.find(b => b.getAttribute('aria-pressed')) || days.find(b => !b.classList.contains('is-off')) || days[0];
      if (pick) pick.tabIndex = 0;
    }

    el.addEventListener('click', e => {
      if (e.target.closest('.cal-prev')) { start = addMonths(start, -1); render(); return; }
      if (e.target.closest('.cal-next')) { start = addMonths(start, 1); render(); return; }
      const b = e.target.closest('button.cal-day');
      if (b && !b.classList.contains('is-off') && o.onPick) { focus = b.dataset.d; o.onPick(b.dataset.d); }
    });

    el.addEventListener('keydown', e => {
      const b = e.target.closest('button.cal-day');
      if (!b) return;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = addDays(b.dataset.d, step);
      if (o.min && next < o.min) return;
      focus = next;
      const last = addMonths(start, o.months);
      if (next < start || next >= last) { start = addMonths(start, next < start ? -1 : 1); render(); }
      else { b.tabIndex = -1; }
      const t = el.querySelector(`button.cal-day[data-d="${next}"]`);
      if (t) { t.tabIndex = 0; t.focus(); }
    });

    return {
      render,
      show(d) { start = d.slice(0, 7) + '-01'; render(); },
      focusDay() { const t = el.querySelector('button.cal-day[tabindex="0"]'); if (t) t.focus(); },
      get month() { return start; },
    };
  };
})();
