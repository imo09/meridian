/* Meridian - utilità comuni: formattazione italiana, date, DOM */
(function (M) {
  'use strict';
  const U = {};

  U.esc = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  /* Numeri in notazione italiana: punto per le migliaia, virgola decimale */
  U.num = function (x, d) {
    if (x === null || x === undefined || x === '' || Number.isNaN(x)) return '';
    if (!Number.isFinite(x)) return x > 0 ? '∞' : '-∞';
    d = d === undefined ? 2 : d;
    const neg = x < 0 || (Object.is(x, -0) && false);
    let s = Math.abs(x).toFixed(d);
    let [i, f] = s.split('.');
    i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const r = f ? i + ',' + f : i;
    return (neg && Number(s) !== 0 ? '-' : '') + r;
  };
  U.int = (x) => U.num(Math.round(x || 0), 0);
  U.eur = (x) => (x === null || x === undefined ? '' : U.num(x, 2) + ' €');
  U.keur = (x) => (x === null || x === undefined ? '' : U.num(x / 1000, 2) + ' k€');
  U.pct = (x) => (x === null || x === undefined ? '' : U.num(x, 2) + '%');
  U.signed = (x, d) => (x > 0 ? '+' : '') + U.num(x, d === undefined ? 0 : d);
  /* legge un numero scritto all'italiana o all'inglese */
  U.parseNum = function (s) {
    if (typeof s === 'number') return s;
    if (s === null || s === undefined) return NaN;
    s = String(s).trim().replace(/\s|€|%|h|g$/g, '');
    if (s === '') return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  };

  /* Date: numero di giorno dal 1970-01-01 (UTC), "dn" */
  const DAY = 86400000;
  U.dnOf = function (iso) {
    if (iso === null || iso === undefined || iso === '') return null;
    if (typeof iso === 'number') return iso;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
  };
  U.isoOf = function (dn) {
    if (dn === null || dn === undefined) return '';
    const d = new Date(dn * DAY);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  };
  U.dateOf = (dn) => new Date(dn * DAY);
  U.ymd = function (dn) { const d = new Date(dn * DAY); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };
  U.dnYmd = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY);
  U.fd = function (dn) { /* gg/mm/aa */
    if (dn === null || dn === undefined || dn === '') return '';
    if (typeof dn === 'string') dn = U.dnOf(dn);
    const [y, m, d] = U.ymd(dn);
    return String(d).padStart(2, '0') + '/' + String(m + 1).padStart(2, '0') + '/' + String(y % 100).padStart(2, '0');
  };
  U.fdl = function (dn) { /* gg/mm/aaaa */
    if (dn === null || dn === undefined || dn === '') return '';
    if (typeof dn === 'string') dn = U.dnOf(dn);
    const [y, m, d] = U.ymd(dn);
    return String(d).padStart(2, '0') + '/' + String(m + 1).padStart(2, '0') + '/' + y;
  };
  /* accetta gg/mm/aa, gg/mm/aaaa, aaaa-mm-gg, numero seriale Excel */
  U.parseDate = function (s) {
    if (s === null || s === undefined || s === '') return null;
    if (typeof s === 'number') { if (s > 20000 && s < 80000) return Math.round(s - 25569); return null; }
    s = String(s).trim().replace(/\s+A$/, '');
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return U.dnYmd(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(s);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return U.dnYmd(y, +m[2] - 1, +m[1]); }
    if (/^\d+(\.\d+)?$/.test(s)) return U.parseDate(Number(s));
    return null;
  };
  U.todayDn = function () {
    const ov = M.Store && M.Store.db && M.Store.db.settings && M.Store.db.settings.systemDate;
    if (ov) return U.dnOf(ov);
    const d = new Date();
    return U.dnYmd(d.getFullYear(), d.getMonth(), d.getDate());
  };
  U.weekday = (dn) => ((dn % 7) + 7 + 3) % 7; /* 0 = lunedì */
  U.MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  U.MONTHS_L = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  U.monthKey = (dn) => { const [y, m] = U.ymd(dn); return y * 12 + m; };
  U.monthStart = (key) => U.dnYmd(Math.floor(key / 12), key % 12, 1);
  U.monthLabel = (key, withYear) => U.MONTHS[key % 12] + (withYear || key % 12 === 0 ? ' ' + String(Math.floor(key / 12) % 100).padStart(2, '0') : '');
  U.addMonths = (dn, n) => { const [y, m, d] = U.ymd(dn); return U.dnYmd(y, m + n, d); };
  U.lastOfMonth = (dn) => { const [y, m] = U.ymd(dn); return U.dnYmd(y, m + 1, 0); };
  U.nowStamp = function () { const d = new Date(); return d.toISOString(); };
  U.fts = function (iso) { /* timestamp leggibile */
    if (!iso) return '';
    const d = new Date(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear() % 100).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  let seq = 0;
  U.uid = function (p) { seq = (seq + 1) % 1e6; return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + seq.toString(36); };
  U.clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  U.by = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
  U.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) || 0 : x || 0), 0);
  U.groupBy = function (arr, f) { const m = new Map(); arr.forEach((x) => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
  U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  U.round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  U.debounce = function (f, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => f.apply(null, a), ms); }; };

  /* DOM */
  if (typeof document !== 'undefined') {
    U.$ = (s, r) => (r || document).querySelector(s);
    U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  }
  U.download = function (name, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  U.readFile = function (file, asText) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      if (asText) r.readAsText(file); else r.readAsArrayBuffer(file);
    });
  };
  U.slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

  M.U = U;
})(window.M = window.M || {});
