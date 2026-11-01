/* Meridian - componenti di interfaccia: icone, logo, icone info, finestre, avvisi, grafici SVG */
(function (M) {
  'use strict';
  const U = M.U;
  const esc = U.esc;
  const UI = {};

  const P = {
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    tree: '<path d="M4 3h6v5H4zM14 10h6v5h-6zM14 17h6v4h-6zM7 8v11h7M7 12.5h7"/>',
    bars: '<path d="M4 6h8M8 12h11M6 18h9" stroke-width="3" stroke-linecap="round"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.8-1.8-5-4-5.7"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    exchange: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    monitor: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    down: '<path d="M12 4v12M6 10l6 6 6-6M5 20h14"/>',
    up: '<path d="M12 20V8M6 14l6-6 6 6M5 4h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    chevL: '<path d="M15 6l-6 6 6 6"/>',
    trace: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 12h4l5-5M11.5 12l5 5"/>',
    network: '<rect x="2" y="9" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="16" y="15" width="6" height="6" rx="1"/><path d="M8 12h4V6h4M12 12v6h4"/>',
    gantt: '<path d="M3 5h8M7 10h10M12 15h8M3 20h18"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
    note: '<path d="M5 3h14v12l-6 6H5z"/><path d="M13 21v-6h6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-6-6-9 9"/>',
    paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V2h6v2M9 11h6M9 15h6"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    wifiOff: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18"/>'
  };
  UI.ic = (n, s, extra) => '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + (P[n] || '') + '</svg>';

  /* Logo Meridian, variante A: M a tre barre in un cerchio-bussola, ago dorato come gamba centrale */
  UI.logo = (s, light) => '<svg width="' + (s || 32) + '" height="' + (s || 32) + '" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="' + (light ? '#1c5a8a' : '#9fc3e6') + '" stroke-width="2"/><path d="M30 16h-2.6M16 30v-2.6M2 16h2.6" stroke="' + (light ? '#1c5a8a' : '#9fc3e6') + '" stroke-width="1.6"/><path d="M8.4 23.2V10.4l5 4.4M23.6 23.2V10.4l-5 4.4" fill="none" stroke="' + (light ? '#0f2a40' : '#ffffff') + '" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/><path d="M16 3.2l2.7 11L16 23.4l-2.7-9.2z" fill="#e0ad00"/><path d="M16 3.2l2.7 11h-5.4z" fill="#f4c430"/></svg>';

  /* icona info */
  UI.i = function (id, ctx) {
    const e = M.Info.I[id] || M.Info.EVI[id];
    if (!e) return '';
    const S = M.Store.S();
    if (!S.guideMode && !e.ess && !ctx) return '';
    return '<button type="button" class="ii" data-a="info" data-id="' + esc(id) + '" aria-label="Informazioni: ' + esc(e.t) + '">i</button>';
  };
  UI.popInfo = function (btn) {
    const id = btn.getAttribute('data-id');
    const e = M.Info.I[id];
    const ev = M.Info.EVI[id];
    let html = '';
    if (e) {
      html = '<b class="pt">' + esc(e.t) + '</b><dl><dt>Cosa fa</dt><dd>' + esc(e.cosa) + '</dd><dt>Cosa impatta</dt><dd>' + esc(e.impatta) + '</dd><dt>Quando usarlo</dt><dd>' + esc(e.quando) + '</dd></dl>' + (e.guida ? '<a class="more" href="guida/index.html#' + e.guida + '" target="_blank" rel="noopener">Approfondisci nella Guida ' + e.guida.replace('s', '').replace('-', '.') + '</a>' : '<span class="more muted">Funzione propria di Meridian, non presente nella Guida P6.</span>');
    } else if (ev) {
      const v = M.VH && M.VH.lastEV ? M.VH.lastEV : null;
      const light = v ? ev.light(v) : null;
      html = '<b class="pt">' + esc(ev.t) + '</b><dl><dt>Formula</dt><dd class="mono">' + esc(ev.f) + '</dd>' + (v ? '<dt>In parole</dt><dd>' + esc(ev.say(v)) + '</dd>' : '') + '<dt>Soglia</dt><dd>' + (light ? '<span class="chip ' + light + '">' + ({ ok: 'Verde', warn: 'Giallo', bad: 'Rosso' })[light] + '</span> ' : '') + esc(thresholdText(id)) + '</dd><dt>Azione suggerita</dt><dd>' + esc(ev.act) + '</dd></dl><a class="more" href="guida/index.html#s14-2" target="_blank" rel="noopener">Approfondisci nella Guida 14.2</a>';
    }
    UI.popover(btn, html);
  };
  function thresholdText(id) {
    return ({ SPI: 'verde da 0,95, giallo 0,90-0,95, rosso sotto 0,90', CPI: 'verde da 0,95, giallo 0,90-0,95, rosso sotto 0,90', TCPI: 'verde fino a 1,00, giallo fino a 1,10, rosso oltre', SV: 'verde da 0, giallo fino a -5% del PV, rosso oltre', CV: 'verde da 0, giallo fino a -5% dell\'EV, rosso oltre', VAC: 'verde da 0, giallo fino a -5% del BAC, rosso oltre', EAC: 'verde entro il BAC, giallo fino a +5%, rosso oltre' })[id] || 'nessuna soglia: è una grandezza di riferimento';
  }

  /* popover generico */
  let popEl = null, popFor = null;
  UI.popover = function (anchor, html) {
    UI.closePop();
    popEl = document.createElement('div');
    popEl.className = 'pop';
    popEl.setAttribute('role', 'dialog');
    popEl.innerHTML = '<button type="button" class="pop-x" data-a="closePop" aria-label="Chiudi">' + UI.ic('x', 16) + '</button>' + html;
    document.body.appendChild(popEl);
    popFor = anchor;
    const r = anchor.getBoundingClientRect();
    const pw = Math.min(360, window.innerWidth - 16);
    popEl.style.width = pw + 'px';
    let left = r.left + window.scrollX - 12;
    left = Math.max(8 + window.scrollX, Math.min(left, window.scrollX + window.innerWidth - pw - 8));
    let top = r.bottom + window.scrollY + 6;
    popEl.style.left = left + 'px'; popEl.style.top = top + 'px';
    const ph = popEl.offsetHeight;
    if (r.bottom + ph + 12 > window.innerHeight && r.top - ph - 6 > 0) popEl.style.top = (r.top + window.scrollY - ph - 6) + 'px';
  };
  UI.closePop = function () { if (popEl) { popEl.remove(); popEl = null; popFor = null; } };
  UI.popOpenFor = (el) => popFor === el;

  /* finestra modale */
  let modalStack = [];
  UI.modal = function (o) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    const id = 'm' + Date.now();
    wrap.innerHTML = '<div class="modal ' + (o.wide ? 'wide' : '') + (o.xwide ? ' xwide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '"><div class="modal-h"><h2 id="' + id + '">' + esc(o.title) + '</h2>' + (o.info ? UI.i(o.info) : '') + '<button type="button" class="ibx" data-a="closeModal" aria-label="Chiudi">' + UI.ic('x', 18) + '</button></div><div class="modal-b">' + o.body + '</div>' + (o.foot !== false ? '<div class="modal-f">' + (o.foot || '<button type="button" class="btn" data-a="closeModal">Chiudi</button>') + '</div>' : '') + '</div>';
    document.body.appendChild(wrap);
    modalStack.push({ el: wrap, onClose: o.onClose });
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && !o.sticky) UI.closeModal(); });
    const f = wrap.querySelector('[autofocus], input, select, textarea, button.btn-p');
    if (f) setTimeout(() => f.focus(), 30);
    if (o.after) o.after(wrap);
    return wrap;
  };
  UI.closeModal = function () { const m = modalStack.pop(); if (m) { m.el.remove(); if (m.onClose) m.onClose(); } };
  UI.modalOpen = () => modalStack.length > 0;
  UI.topModal = () => (modalStack.length ? modalStack[modalStack.length - 1].el : null);
  UI.confirm = function (title, text, okLabel, cb, danger) {
    UI.modal({ title, body: '<p>' + text + '</p>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="' + (danger ? 'btn-d' : 'btn-p') + '" data-a="modalOk">' + esc(okLabel || 'Conferma') + '</button>', after: (w) => { w.querySelector('[data-a="modalOk"]').addEventListener('click', (e) => { e.stopPropagation(); UI.closeModal(); cb(); }); } });
  };
  UI.prompt = function (title, label, value, cb, o) {
    o = o || {};
    UI.modal({ title, body: '<label class="fld">' + esc(label) + (o.area ? '<textarea class="inp" rows="3" id="pr-v">' + esc(value || '') + '</textarea>' : '<input class="inp" id="pr-v" value="' + esc(value || '') + '">') + '</label>' + (o.help ? '<p class="help">' + o.help + '</p>' : ''), foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="modalOk">' + esc(o.ok || 'Conferma') + '</button>', after: (w) => { const go = () => { const v = w.querySelector('#pr-v').value; UI.closeModal(); cb(v); }; w.querySelector('[data-a="modalOk"]').addEventListener('click', (e) => { e.stopPropagation(); go(); }); if (!o.area) w.querySelector('#pr-v').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }); } });
  };

  /* avvisi */
  UI.toast = function (msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, kind === 'bad' ? 7000 : 3800);
  };

  /* elementi ricorrenti */
  UI.chip = (txt, cls) => '<span class="chip ' + (cls || 'info') + '">' + esc(txt) + '</span>';
  UI.card = (title, body, o) => { o = o || {}; return '<section class="card ' + (o.cls || '') + '"' + (o.style ? ' style="' + o.style + '"' : '') + (o.id ? ' id="' + o.id + '"' : '') + '>' + (title ? '<div class="card-h"><h2>' + esc(title) + (o.info ? ' ' + UI.i(o.info) : '') + '</h2>' + (o.tools ? '<div class="tools">' + o.tools + '</div>' : '') + '</div>' : '') + body + '</section>'; };
  UI.kpi = (label, val, sub, cls, info) => '<div class="kpi"><p class="ey">' + esc(label) + (info ? ' ' + UI.i(info) : '') + '</p><div class="v ' + (cls || '') + '">' + val + '</div>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';
  UI.table = (heads, rows, o) => { o = o || {}; return '<div class="tw"><table class="tb ' + (o.cls || '') + '"><thead><tr>' + heads.map((h) => { const hh = typeof h === 'string' ? { t: h } : h; return '<th' + (hh.n ? ' class="n"' : '') + '>' + hh.t + '</th>'; }).join('') + '</tr></thead><tbody>' + (rows.length ? rows.join('') : '<tr><td colspan="' + heads.length + '" class="empty">' + esc(o.empty || 'Nessun dato') + '</td></tr>') + '</tbody></table></div>'; };
  UI.light = (l) => (l ? '<span class="dotl ' + l + '" aria-label="' + ({ ok: 'verde', warn: 'giallo', bad: 'rosso' })[l] + '"></span>' : '');
  UI.sel = (name, opts, val, attrs) => '<select class="inp" ' + (attrs || '') + ' data-c="' + name + '">' + opts.map((o) => { const oo = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(oo[0]) + '"' + (String(oo[0]) === String(val) ? ' selected' : '') + '>' + esc(oo[1]) + '</option>'; }).join('') + '</select>';
  UI.dayCls = (v) => (v < 0 ? 'neg' : v > 0 ? 'pos' : '');

  /* ---------- grafici SVG ---------- */
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; const st = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]; return st.find((x) => f <= x + 1e-9) * p; }
  UI.niceMax = niceMax;

  /* linee nel tempo: x = indice di categoria */
  UI.lineChart = function (o) {
    const W = o.w || 760, H = o.h || 320, ml = o.ml || 64, mr = o.mr || 120, mt = 18, mb = 34;
    const n = o.labels.length;
    const iw = W - ml - mr, ih = H - mt - mb;
    let maxY = 0, minY = 0;
    o.series.forEach((s) => s.pts.forEach((p) => { if (p && p[1] !== null && p[1] !== undefined) { maxY = Math.max(maxY, p[1]); minY = Math.min(minY, p[1]); } }));
    if (o.band) { maxY = Math.max(maxY, o.band[1]); }
    if (o.minY !== undefined) minY = o.minY;
    maxY = o.maxY || niceMax(maxY * 1.05);
    const X = (i) => ml + (n <= 1 ? 0 : (i / (n - 1)) * iw);
    const Y = (v) => mt + ih - ((v - minY) / (maxY - minY || 1)) * ih;
    let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(o.aria || 'Grafico') + '">';
    for (let k = 0; k <= 4; k++) { const v = minY + ((maxY - minY) * k) / 4; const y = Y(v); g += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y + '" y2="' + y + '" class="cgl"/><text x="' + (ml - 8) + '" y="' + (y + 4) + '" class="ax" text-anchor="end">' + esc(o.yFmt ? o.yFmt(v) : U.num(v, 0)) + '</text>'; }
    const step = Math.max(1, Math.ceil(n / (o.maxLabels || 14)));
    o.labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += '<text x="' + X(i) + '" y="' + (H - 12) + '" class="ax" text-anchor="middle">' + esc(l) + '</text>'; });
    if (o.band) g += '<rect x="' + ml + '" y="' + Y(o.band[1]) + '" width="' + iw + '" height="' + Math.max(0, Y(o.band[0]) - Y(o.band[1])) + '" class="band-ref"/>' + (o.refLine !== undefined ? '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(o.refLine) + '" y2="' + Y(o.refLine) + '" class="refl"/><text x="' + (W - mr + 6) + '" y="' + (Y(o.refLine) + 4) + '" class="ax">' + esc(o.refLabel || '') + '</text>' : '');
    (o.areas || []).forEach((a) => { g += '<path d="M' + X(a.x) + ' ' + Y(a.y1) + 'L' + X(a.x) + ' ' + Y(a.y2) + '" class="vbr" stroke="' + a.color + '"/><text x="' + (X(a.x) - 6) + '" y="' + ((Y(a.y1) + Y(a.y2)) / 2 + 4) + '" class="lbl" text-anchor="end" fill="' + a.color + '">' + esc(a.label) + '</text>'; });
    if (o.vline !== undefined && o.vline !== null) g += '<line x1="' + X(o.vline) + '" x2="' + X(o.vline) + '" y1="' + mt + '" y2="' + (mt + ih) + '" class="ddl"/><text x="' + (X(o.vline) + 4) + '" y="' + (mt + 10) + '" class="ax">' + esc(o.vlabel || '') + '</text>';
    const ends = [];
    o.series.forEach((s) => {
      let d = '', started = false, last = null;
      s.pts.forEach((p, i) => { if (!p || p[1] === null || p[1] === undefined) { started = false; return; } d += (started ? 'L' : 'M') + X(p[0] !== undefined ? p[0] : i) + ' ' + Y(p[1]); started = true; last = p; });
      g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.w || 2.5) + '"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/>';
      (s.dots || []).forEach((p) => { g += '<circle cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="4" fill="' + s.color + '"/>'; });
      if (last && s.label !== false) ends.push({ y: Y(last[1]), x: X(last[0]), text: s.name + (s.endFmt ? ' ' + s.endFmt(last[1]) : ''), color: s.color });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    ends.forEach((e) => { g += '<text x="' + (W - mr + 6) + '" y="' + (e.y + 4) + '" class="lbl" fill="' + e.color + '">' + esc(e.text) + '</text><line x1="' + e.x + '" x2="' + (W - mr + 2) + '" y1="' + e.y + '" y2="' + e.y + '" stroke="' + e.color + '" stroke-dasharray="2 3" stroke-width="1"/>'; });
    (o.marks || []).forEach((m) => { g += '<circle cx="' + X(m.x) + '" cy="' + Y(m.y) + '" r="4.5" fill="' + m.color + '" stroke="#fff" stroke-width="1.5"/><text x="' + (X(m.x) + (m.dx || -8)) + '" y="' + (Y(m.y) + (m.dy || -8)) + '" class="lbl" text-anchor="' + (m.anchor || 'end') + '" fill="' + m.color + '">' + esc(m.label) + '</text>'; });
    return g + '</svg>';
  };

  /* barre impilate con linea di disponibilità */
  UI.barChart = function (o) {
    const W = o.w || 760, H = o.h || 280, ml = 58, mr = 16, mt = 22, mb = 34;
    const n = o.labels.length; const iw = W - ml - mr, ih = H - mt - mb;
    let maxY = 0; o.stacks.forEach((s) => { maxY = Math.max(maxY, U.sum(s)); }); (o.cap || []).forEach((c) => { maxY = Math.max(maxY, c || 0); }); (o.line || []).forEach((c) => { maxY = Math.max(maxY, c || 0); });
    maxY = niceMax(maxY * 1.08);
    const bw = Math.min(46, (iw / Math.max(1, n)) * 0.62);
    const X = (i) => ml + (i + 0.5) * (iw / Math.max(1, n));
    const Y = (v) => mt + ih - (v / maxY) * ih;
    let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(o.aria || 'Istogramma') + '">';
    for (let k = 0; k <= 4; k++) { const v = (maxY * k) / 4; g += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="cgl"/><text x="' + (ml - 8) + '" y="' + (Y(v) + 4) + '" class="ax" text-anchor="end">' + esc(o.yFmt ? o.yFmt(v) : U.num(v, 0)) + '</text>'; }
    o.labels.forEach((l, i) => {
      let acc = 0;
      const tot = U.sum(o.stacks[i]);
      o.stacks[i].forEach((v, j) => { if (!v) return; const y0 = Y(acc), y1 = Y(acc + v); g += '<rect x="' + (X(i) - bw / 2) + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(0, y0 - y1) + '" fill="' + o.colors[j] + '"><title>' + esc(o.names[j] + ': ' + (o.yFmt ? o.yFmt(v) : U.num(v, 0))) + '</title></rect>'; acc += v; });
      const cap = o.cap ? o.cap[i] : null;
      if (cap !== null && cap !== undefined && tot > cap) g += '<rect x="' + (X(i) - bw / 2) + '" y="' + Y(tot) + '" width="' + bw + '" height="' + Math.max(0, Y(cap) - Y(tot)) + '" class="over"/>';
      if (o.showTotals && tot) g += '<text x="' + X(i) + '" y="' + (Y(tot) - 5) + '" class="lbl" text-anchor="middle">' + esc(o.yFmt ? o.yFmt(tot) : U.num(tot, 0)) + '</text>';
      g += '<text x="' + X(i) + '" y="' + (H - 12) + '" class="ax" text-anchor="middle">' + esc(l) + '</text>';
    });
    if (o.cap) { let d = ''; o.cap.forEach((c, i) => { const x0 = X(i) - (iw / n) / 2, x1 = X(i) + (iw / n) / 2; d += (i ? 'L' : 'M') + x0 + ' ' + Y(c || 0) + 'L' + x1 + ' ' + Y(c || 0); }); g += '<path d="' + d + '" class="capl"/>'; }
    if (o.line) { let d = ''; o.line.forEach((c, i) => { d += (i ? 'L' : 'M') + X(i) + ' ' + Y(c || 0); }); g += '<path d="' + d + '" fill="none" stroke="' + (o.lineColor || '#0f2a40') + '" stroke-width="2.5"/>'; o.line.forEach((c, i) => { if (i === o.line.length - 1) g += '<text x="' + (X(i) - 4) + '" y="' + (Y(c) - 8) + '" class="lbl" text-anchor="end">' + esc(o.lineName + ' ' + (o.yFmt ? o.yFmt(c) : U.num(c, 0))) + '</text>'; }); }
    return g + '</svg>';
  };

  UI.legend = (items) => '<div class="leg">' + items.map((it) => '<span><i style="background:' + it[1] + (it[2] ? ';' + it[2] : '') + '"></i>' + esc(it[0]) + '</span>').join('') + '</div>';

  M.UI = UI;
})(window.M = window.M || {});
