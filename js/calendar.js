/* Meridian - calendari lavorativi.
   Il tempo è misurato in giorni (dn). Un "punto" p indica l'inizio del giorno p (= fine del giorno p-1).
   Per ogni calendario si costruisce una tabella cumulativa dei giorni lavorativi: le operazioni
   (somma di giorni lavorativi, differenza, aggancio al giorno lavorativo) diventano O(log n). */
(function (M) {
  'use strict';
  const U = M.U;
  const BASE = U.dnYmd(1995, 0, 1);
  const SPAN = 365 * 80;
  const cache = new Map();

  function keyOf(cal) {
    return cal.id + '|' + (cal.week || []).join(',') + '|' + (cal.recurring || []).join(',') + '|' + (cal.holidays || []).join(',') + '|' + (cal.workdays || []).join(',');
  }

  function expandDates(list) {
    const out = new Set();
    (list || []).forEach((s) => {
      if (!s) return;
      const parts = String(s).split('..');
      const a = U.dnOf(parts[0]);
      const b = parts[1] ? U.dnOf(parts[1]) : a;
      if (a === null || b === null) return;
      for (let d = a; d <= b; d++) out.add(d);
    });
    return out;
  }

  function build(cal) {
    const k = keyOf(cal);
    let c = cache.get(cal.id);
    if (c && c.k === k) return c;
    const week = cal.week || [8, 8, 8, 8, 8, 0, 0];
    const hol = expandDates(cal.holidays);
    const wk = expandDates(cal.workdays);
    const rec = new Set(cal.recurring || []);
    const work = new Uint8Array(SPAN);
    const cum = new Int32Array(SPAN + 1);
    for (let i = 0; i < SPAN; i++) {
      const dn = BASE + i;
      let w = week[U.weekday(dn)] > 0;
      if (w) {
        if (hol.has(dn)) w = false;
        else if (rec.size) { const iso = U.isoOf(dn); if (rec.has(iso.slice(5))) w = false; }
      }
      if (wk.has(dn)) w = true;
      work[i] = w ? 1 : 0;
      cum[i + 1] = cum[i] + work[i];
    }
    const hpd = cal.hoursDay || (week.find((h) => h > 0) || 8);
    c = { k, work, cum, hpd };
    cache.set(cal.id, c);
    return c;
  }

  const idx = (p) => U.clamp(p - BASE, 0, SPAN);

  const Cal = {
    BASE,
    build,
    invalidate(id) { if (id) cache.delete(id); else cache.clear(); },
    isWork(cal, d) { const c = build(cal); const i = d - BASE; return i >= 0 && i < SPAN && c.work[i] === 1; },
    /* primo giorno lavorativo >= d (come punto di inizio) */
    nextWork(cal, d) {
      const c = build(cal);
      let i = idx(d);
      while (i < SPAN && !c.work[i]) i++;
      return BASE + i;
    },
    /* aggancio all'indietro di un punto di fine: il giorno p-1 deve essere lavorativo */
    prevWorkEnd(cal, p) {
      const c = build(cal);
      let i = idx(p) - 1;
      while (i > 0 && !c.work[i]) i--;
      return BASE + i + 1;
    },
    /* giorni lavorativi tra due punti (b - a), con segno */
    between(cal, a, b) {
      const c = build(cal);
      return c.cum[idx(b)] - c.cum[idx(a)];
    },
    /* dal punto p, dopo n giorni lavorativi (n può essere negativo) */
    add(cal, p, n) {
      if (!n) return p;
      if (n < 0) return Cal.sub(cal, p, -n);
      const c = build(cal);
      const s = idx(Cal.nextWork(cal, p));
      const target = c.cum[s] + n;
      let lo = s, hi = SPAN;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (c.cum[mid] >= target) hi = mid; else lo = mid + 1; }
      return BASE + lo;
    },
    /* il punto di inizio di n giorni lavorativi che finiscono al punto p */
    sub(cal, p, n) {
      if (!n) return p;
      if (n < 0) return Cal.add(cal, p, -n);
      const c = build(cal);
      const e = idx(p);
      const target = c.cum[e] - n;
      let lo = 0, hi = e;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (c.cum[mid] <= target) lo = mid; else hi = mid - 1; }
      return BASE + lo;
    },
    /* giorni lavorativi in un mese o intervallo di giorni [a, b] inclusi */
    workDaysIn(cal, a, b) { return Cal.between(cal, a, b + 1); },
    hoursDay(cal) { return build(cal).hpd; },
    /* festività italiane fisse più Pasquetta per un anno */
    easter(y) {
      const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
      const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
      return U.dnYmd(y, month - 1, day);
    },
    italianRecurring: ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'],
    pasquette(y0, y1) { const out = []; for (let y = y0; y <= y1; y++) out.push(U.isoOf(Cal.easter(y) + 1)); return out; }
  };

  M.Cal = Cal;
})(window.M = window.M || {});
