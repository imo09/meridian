/* Meridian - 03 Attività: tabella, Gantt, reticolo, Traccia, pannello dettagli */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, CPM = M.CPM, esc = U.esc;
  const ROWH = 28;
  const ZOOM = { week: { px: 16, label: 'Settimane' }, month: { px: 3.4, label: 'Mesi' }, quarter: { px: 1.3, label: 'Trimestri' }, year: { px: 0.55, label: 'Anni' } };
  const FILTERS = [['all', 'Tutte le attività'], ['crit', 'Critiche'], ['critsub', 'Critiche e sub-critiche'], ['active', 'In corso'], ['next60', 'Prossimi 60 giorni'], ['todo', 'Non iniziate'], ['done', 'Completate'], ['drawchg', 'Con tavole revisionate dopo l\'ultimo F9']];

  function layout() { const p = S.P(); return (p.layouts || []).find((l) => l.id === S.ui.layout) || (p.layouts || [])[0] || { id: 'def', name: 'Predefinito', cols: ['code', 'name', 'od', 'start', 'finish', 'tf', 'pct', 'driverPred', 'driverType', 'drivenCount'], group: 'wbs' }; }
  function cols() { const l = layout(); const c = (S.ui.cols && S.ui.cols[l.id]) || l.cols; const f = VH.fieldsAll(); const out = c.filter((k) => f[k]); if (S.ui.trace.on && !out.includes('level')) out.unshift('level'); return out; }

  /* traccia corrente */
  function traceInfo(ctx) {
    const t = S.ui.trace;
    if (!t.on || !S.ui.sel || !ctx.byId.has(S.ui.sel) || !ctx.s.rels) return null;
    const r = CPM.trace(ctx.p, ctx.s, S.ui.sel, { depth: Number(t.depth) || 6, near: Number(t.near) || 0, toward: t.toward || null });
    return r;
  }

  /* righe visibili: filtro, ricerca, raggruppamento, ordinamento */
  function buildRows(ctx, tr) {
    const p = ctx.p, f = S.ui.filter, q = (S.ui.search || '').toLowerCase().trim();
    const DD = U.dnOf(p.dataDate);
    const lastF9 = ctx.s.ranAt ? ctx.s.ranAt.slice(0, 10) : '';
    let acts = p.activities.filter((a) => {
      const r = ctx.s.acts[a.id] || {};
      if (q && !(a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))) return false;
      if (tr && S.ui.trace.hide && !tr.levels.has(a.id)) return false;
      if (f === 'crit') return !!r.crit;
      if (f === 'critsub') return !!(r.crit || r.sub);
      if (f === 'active') return !!a.as && !a.af;
      if (f === 'todo') return !a.as;
      if (f === 'done') return !!a.af;
      if (f === 'next60') { const d = VH.dates(ctx, a); const s0 = d.start !== null ? d.start : d.finish, f0 = d.finish !== null ? d.finish : d.start; return !a.af && s0 !== null && s0 <= DD + 60 && f0 >= DD; }
      if (f === 'drawchg') return (a.drawings || []).some((id) => { const dw = (p.drawings || []).find((x) => x.id === id); return dw && (dw.changedAt || dw.date) > lastF9; });
      if (f && f.startsWith('path:')) return (r.paths || []).includes(Number(f.slice(5)));
      if (f && f.startsWith('dw:')) return (a.drawings || []).includes(f.slice(3));
      return true;
    });
    const fields = VH.fieldsAll();
    const sc = S.ui.sortCol, sd = S.ui.sortDir || 1;
    const sorter = (a, b) => {
      if (tr && S.ui.trace.sortLevel) { const la = tr.levels.has(a.id) ? tr.levels.get(a.id) : 99, lb = tr.levels.has(b.id) ? tr.levels.get(b.id) : 99; if (la !== lb) return la - lb; }
      if (sc && fields[sc]) { const va = fields[sc].get(ctx, a), vb = fields[sc].get(ctx, b); if (va !== vb) { if (va === null || va === undefined || va === '') return 1; if (vb === null || vb === undefined || vb === '') return -1; return (va < vb ? -1 : 1) * sd; } }
      const ra = ctx.s.acts[a.id] || {}, rb = ctx.s.acts[b.id] || {};
      const sa = a.as ? U.dnOf(a.as) : ra.es, sb = b.as ? U.dnOf(b.as) : rb.es;
      if (sa !== sb) return (sa || 0) - (sb || 0);
      return a.code < b.code ? -1 : 1;
    };
    const g = (tr && S.ui.trace.sortLevel) ? 'none' : (S.ui.group || 'wbs');
    const rows = [];
    if (g === 'wbs') {
      const kids = new Map(); (p.wbs || []).forEach((w) => { const k = w.parent || '__'; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(w); });
      const byW = U.groupBy(acts, (a) => a.wbsId);
      const count = (wid) => (byW.get(wid) || []).length + (kids.get(wid) || []).reduce((s, c) => s + count(c.id), 0);
      const walk = (w, lvl) => {
        if (!count(w.id)) return;
        const col = !!S.ui.collapsed['w:' + w.id];
        const members = [];
        const collect = (wid) => { (byW.get(wid) || []).forEach((a) => members.push(a)); (kids.get(wid) || []).forEach((c) => collect(c.id)); };
        collect(w.id);
        rows.push({ g: true, id: 'w:' + w.id, label: w.code + ' ' + w.name, lvl, members, col });
        if (col) return;
        (byW.get(w.id) || []).slice().sort(sorter).forEach((a) => rows.push({ a, lvl: lvl + 1 }));
        (kids.get(w.id) || []).forEach((c) => walk(c, lvl + 1));
      };
      (kids.get('__') || []).forEach((w) => walk(w, 0));
      const orphan = acts.filter((a) => !ctx.wbsMap.has(a.wbsId));
      if (orphan.length) { rows.push({ g: true, id: 'w:none', label: 'Senza WBS', lvl: 0, members: orphan }); orphan.sort(sorter).forEach((a) => rows.push({ a, lvl: 1 })); }
    } else if (g === 'none') {
      acts.sort(sorter).forEach((a) => rows.push({ a, lvl: 0 }));
    } else {
      const keyOf = (a) => {
        const r = ctx.s.acts[a.id] || {};
        if (g === 'path') return r.crit ? 'Percorso critico ' + r.path : r.sub ? 'Sub-critiche' : 'Non critiche';
        if (g === 'driverType') return r.driverType || 'Non schedulata';
        if (g === 'status') return VH.status(a);
        if (g.startsWith('code_')) { const t = (S.db.codeTypes || []).find((x) => x.id === g.slice(5)); const v = (a.codes || {})[g.slice(5)]; const d = t && t.values.find((x) => x.code === v); return v ? v + (d ? ' ' + d.desc : '') : '(nessun valore)'; }
        return '';
      };
      const m = U.groupBy(acts, keyOf);
      [...m.keys()].sort().forEach((k) => { const col = !!S.ui.collapsed['g:' + g + ':' + k]; rows.push({ g: true, id: 'g:' + g + ':' + k, label: k, lvl: 0, members: m.get(k), col }); if (!col) m.get(k).sort(sorter).forEach((a) => rows.push({ a, lvl: 1 })); });
    }
    return rows;
  }

  function groupSummary(ctx, members) {
    let s = Infinity, f = -Infinity, tf = Infinity, bud = 0, ev = 0, ac = 0, pv = 0, rem = 0;
    members.forEach((a) => {
      const d = VH.dates(ctx, a); if (d.start !== null && d.start < s) s = d.start; if (d.finish !== null && d.finish > f) f = d.finish; if (d.start === null && d.finish !== null && d.finish < s) s = d.finish;
      const r = ctx.s.acts[a.id]; if (r && r.tf !== null && r.tf !== undefined && r.tf < tf) tf = r.tf;
      const e = ctx.ev.per[a.id]; if (e) { bud += e.bud; ev += e.ev; ac += e.ac; pv += e.pv; rem += e.rem; }
    });
    return { start: s === Infinity ? null : s, finish: f === -Infinity ? null : f, tf: tf === Infinity ? null : tf, bud, ev, ac, pv, rem, pct: bud ? (ev / bud) * 100 : null };
  }

  function cellHtml(k, f, ctx, a, tr) {
    if (k === 'level') { const l = tr && tr.levels.has(a.id) ? tr.levels.get(a.id) : null; return '<td class="n mono ' + (l < 0 ? 'tb-back' : l > 0 ? 'tb-fwd' : l === 0 ? 'tb-sel' : '') + '">' + (l === null ? '' : l > 0 ? '+' + l : l) + '</td>'; }
    const v = f.get(ctx, a);
    let s = f.fmt ? f.fmt(v) : v === null || v === undefined ? '' : String(v);
    if (f.suffix && s) s += f.suffix(ctx, a);
    const cls = [f.num ? 'n' : '', f.mono ? 'mono' : '', f.cls ? f.cls(v) : ''].join(' ').trim();
    const tip = f.tip ? f.tip(ctx, a) : '';
    if (k === 'code') { const r = ctx.s.acts[a.id] || {}; const col = r.crit ? VH.pathColor(r.path) : r.sub ? VH.SUBCOLOR : null; return '<td class="' + cls + '">' + (col ? '<i class="pdot" style="background:' + col + '"></i>' : '<i class="pdot"></i>') + esc(s) + '</td>'; }
    if (k === 'name') return '<td class="nm" title="' + esc(s) + '">' + esc(s) + '</td>';
    return '<td class="' + cls + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + esc(s) + (tip && s ? '<span class="tipdot" aria-hidden="true"></span>' : '') + '</td>';
  }

  function tableHtml(ctx, rows, tr, cks) {
    const fields = VH.fieldsAll(); fields.level = { label: 'Livello', short: 'Liv.', w: 44, num: 1, get: () => null };
    const head = '<tr>' + cks.map((k) => { const f = fields[k]; const on = S.ui.sortCol === k; return '<th style="width:' + (f.w || 80) + 'px;min-width:' + (f.w || 80) + 'px" class="' + (f.num ? 'n' : '') + '"><button type="button" class="thb" data-a="sortBy" data-k="' + k + '" title="' + esc(f.label) + '">' + esc(f.short || f.label) + (on ? (S.ui.sortDir > 0 ? ' ▲' : ' ▼') : '') + '</button>' + (k === 'driverPred' ? UI.i('driverPred') : k === 'driverType' ? UI.i('driverType') : k === 'tf' ? UI.i('tf') : k === 'level' ? UI.i('trace') : '') + '</th>'; }).join('') + '</tr>';
    const body = rows.map((row) => {
      if (row.g) {
        const sm = groupSummary(ctx, row.members);
        return '<tr class="grp l' + Math.min(row.lvl, 4) + '"><td colspan="' + Math.min(2, cks.length) + '" style="padding-left:' + (6 + row.lvl * 14) + 'px"><button type="button" class="tg" data-a="toggleGroup" data-id="' + esc(row.id) + '" aria-expanded="' + !row.col + '" aria-label="' + (row.col ? 'Espandi' : 'Comprimi') + ' ' + esc(row.label) + '">' + UI.ic(row.col ? 'chevR' : 'chevD', 13) + '</button>' + esc(row.label) + ' <span class="cntg">' + row.members.length + '</span></td>' + cks.slice(2).map((k) => {
          const f = fields[k];
          let v = '';
          if (k === 'start') v = U.fd(sm.start); else if (k === 'finish') v = U.fd(sm.finish); else if (k === 'tf') v = sm.tf === null ? '' : U.int(sm.tf); else if (k === 'od') v = sm.start !== null && sm.finish !== null ? U.int(M.Cal.between(ctx.pcal, sm.start, sm.finish + 1)) : ''; else if (k === 'pct') v = sm.pct === null ? '' : U.pct(sm.pct); else if (k === 'budget') v = U.num(sm.bud); else if (k === 'ev') v = U.num(sm.ev); else if (k === 'ac') v = U.num(sm.ac); else if (k === 'pv') v = U.num(sm.pv); else if (k === 'etc') v = U.num(sm.rem);
          return '<td class="' + (f.num ? 'n' : '') + (k === 'tf' && sm.tf < 0 ? ' neg' : '') + '">' + esc(v) + '</td>';
        }).join('') + '</tr>';
      }
      const a = row.a;
      const lvl = tr && tr.levels.has(a.id) ? tr.levels.get(a.id) : null;
      const cls = (a.id === S.ui.sel ? 'sel ' : '') + (tr ? (lvl === null ? 'dim' : lvl < 0 ? 'tback' : lvl > 0 ? 'tfwd' : 'tsel') : '');
      return '<tr class="ar ' + cls + '" data-a="selRow" data-id="' + esc(a.id) + '" tabindex="-1" aria-selected="' + (a.id === S.ui.sel) + '">' + cks.map((k, i) => { let c = cellHtml(k, fields[k], ctx, a, tr); if (i === 1 && k === 'name') c = c.replace('<td class="nm"', '<td class="nm" style="padding-left:' + (8 + row.lvl * 14) + 'px"'); return c; }).join('') + '</tr>';
    }).join('');
    return '<table class="gt"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  /* ---------- Gantt in SVG ---------- */
  function ganttHtml(ctx, rows, tr) {
    const p = ctx.p, DD = U.dnOf(p.dataDate);
    let lo = Infinity, hi = -Infinity;
    p.activities.forEach((a) => { const d = VH.dates(ctx, a); [d.start, d.finish].forEach((x) => { if (x !== null && x !== undefined) { lo = Math.min(lo, x); hi = Math.max(hi, x); } }); if (S.ui.showBL) { const b = VH.blDates(ctx, a); [b.start, b.finish].forEach((x) => { if (x !== null && x !== undefined) { lo = Math.min(lo, x); hi = Math.max(hi, x); } }); } });
    if (lo === Infinity) { lo = DD - 30; hi = DD + 120; }
    const z = ZOOM[S.ui.ganttZoom] || ZOOM.month;
    const k0 = U.monthKey(lo) - 1, k1 = U.monthKey(hi) + 1;
    const t0 = U.monthStart(k0), t1 = U.lastOfMonth(U.monthStart(k1)) + 1;
    const X = (d) => Math.round((d - t0) * z.px * 10) / 10;
    const W = X(t1) + 2, HH = 44, H = HH + rows.length * ROWH;
    let g = '', hd = '';
    /* intestazione temporale (svg separato e fisso in alto) */
    hd += '<rect x="0" y="0" width="' + W + '" height="' + HH + '" class="gh"/>';
    const vl = (x, y1, cls) => { hd += '<line x1="' + x + '" x2="' + x + '" y1="' + y1 + '" y2="' + HH + '" class="' + cls + '"/>'; g += '<line x1="' + x + '" x2="' + x + '" y1="' + HH + '" y2="' + H + '" class="' + cls + '"/>'; };
    if (S.ui.ganttZoom === 'week') {
      for (let k = k0; k <= k1; k++) { const s = U.monthStart(k); hd += '<text x="' + (X(s) + 4) + '" y="15" class="ght">' + U.MONTHS[k % 12] + ' ' + Math.floor(k / 12) + '</text>'; vl(X(s), 0, 'gml'); }
      for (let d = t0; d < t1; d++) if (U.weekday(d) === 0) { hd += '<text x="' + (X(d) + 2) + '" y="36" class="ghs">' + U.ymd(d)[2] + '</text>'; vl(X(d), 22, 'gwl'); }
      for (let d = t0; d < t1; d++) if (!M.Cal.isWork(ctx.pcal, d)) g += '<rect x="' + X(d) + '" y="' + HH + '" width="' + z.px + '" height="' + (H - HH) + '" class="nwd"/>';
    } else {
      let lastY = null;
      for (let k = k0; k <= k1; k++) {
        const s = U.monthStart(k), y = Math.floor(k / 12);
        if (y !== lastY) { hd += '<text x="' + (X(s) + 4) + '" y="15" class="ght">' + y + '</text>'; vl(X(s), 0, 'gyl'); lastY = y; }
        if (S.ui.ganttZoom === 'month' || (S.ui.ganttZoom === 'quarter' && k % 3 === 0) || (S.ui.ganttZoom === 'year' && k % 6 === 0)) { hd += '<text x="' + (X(s) + 3) + '" y="36" class="ghs">' + (S.ui.ganttZoom === 'quarter' ? 'T' + (Math.floor((k % 12) / 3) + 1) : U.MONTHS[k % 12]) + '</text>'; vl(X(s), 22, 'gml'); }
      }
    }
    /* righe */
    const ypos = new Map();
    rows.forEach((row, i) => {
      const y = HH + i * ROWH;
      if (row.g) {
        const sm = groupSummary(ctx, row.members);
        g += '<rect x="0" y="' + y + '" width="' + W + '" height="' + ROWH + '" class="ggrp"/>';
        if (sm.start !== null && sm.finish !== null) g += '<path d="M' + X(sm.start) + ' ' + (y + 10) + 'h' + Math.max(2, X(sm.finish + 1) - X(sm.start)) + 'v8l-4 -4h' + (-(Math.max(2, X(sm.finish + 1) - X(sm.start)) - 8)) + 'l-4 4z" class="gsum"/>';
        return;
      }
      const a = row.a; ypos.set(a.id, y);
      const r = ctx.s.acts[a.id];
      const lvl = tr && tr.levels.has(a.id) ? tr.levels.get(a.id) : null;
      const dim = tr && lvl === null ? ' op' : '';
      if (a.id === S.ui.sel) g += '<rect x="0" y="' + y + '" width="' + W + '" height="' + ROWH + '" class="gsel"/>';
      g += '<g class="gb' + dim + '" data-a="selRow" data-id="' + esc(a.id) + '">';
      const bl = S.ui.showBL ? VH.blDates(ctx, a) : {};
      if (bl.start !== undefined || bl.finish !== undefined) { const bs = bl.start !== null && bl.start !== undefined ? bl.start : bl.finish, bf = bl.finish !== null && bl.finish !== undefined ? bl.finish : bl.start; if (CPM.isMile(a)) g += '<path d="M' + X(bs + (a.type === 'finish' ? 1 : 0)) + ' ' + (y + 19) + 'l4 4 -4 4 -4 -4z" class="gbl"/>'; else g += '<rect x="' + X(bs) + '" y="' + (y + 21) + '" width="' + Math.max(2, X(bf + 1) - X(bs)) + '" height="4" class="gbl"/>'; }
      if (!r) { g += '</g>'; return; }
      const tcol = lvl === null ? null : lvl < 0 ? S.S().traceColors.back : lvl > 0 ? S.S().traceColors.fwd : '#1c5a8a';
      const remCol = tcol || (a.type === 'loe' ? '#a9d3b6' : r.crit ? VH.pathColor(r.path) : r.sub ? VH.SUBCOLOR : '#2f9455');
      const actCol = tcol ? tcol : '#2b6fd6';
      if (CPM.isMile(a)) {
        const x = a.type === 'start' ? X(a.as ? U.dnOf(a.as) : r.es) : X(a.af ? U.dnOf(a.af) + 1 : r.ef);
        g += '<path d="M' + x + ' ' + (y + 6) + 'l7 7 -7 7 -7 -7z" fill="' + (a.af || (a.type === 'start' && a.as) ? actCol : remCol) + '"/>';
        g += '<text x="' + (x + 10) + '" y="' + (y + 18) + '" class="gtx">' + esc(U.fd(a.type === 'start' ? (a.as ? U.dnOf(a.as) : r.es) : (a.af ? U.dnOf(a.af) : r.ef - 1))) + '</text>';
      } else if (a.type === 'wbs') {
        g += '<rect x="' + X(r.es) + '" y="' + (y + 9) + '" width="' + Math.max(2, X(r.ef) - X(r.es)) + '" height="8" fill="' + (tcol || '#2a3340') + '"/>';
      } else {
        if (a.as) {
          const ae = a.af ? U.dnOf(a.af) + 1 : Math.max(U.dnOf(a.as), DD + 1);
          g += '<rect x="' + X(U.dnOf(a.as)) + '" y="' + (y + 6) + '" width="' + Math.max(2, X(ae) - X(U.dnOf(a.as))) + '" height="13" fill="' + (a.type === 'loe' && !tcol ? '#7fb38f' : actCol) + '" rx="1"/>';
        }
        if (!a.af) { const rs = r.rs !== null && r.rs !== undefined ? r.rs : r.es; if (r.ef > rs) g += '<rect x="' + X(rs) + '" y="' + (y + 6) + '" width="' + Math.max(2, X(r.ef) - X(rs)) + '" height="13" fill="' + remCol + '" rx="1"/>'; }
        const endX = X(a.af ? U.dnOf(a.af) + 1 : r.ef);
        if (S.ui.ganttZoom !== 'year') g += '<text x="' + (endX + 4) + '" y="' + (y + 17) + '" class="gtx">' + esc(a.code) + '</text>';
      }
      g += '<title>' + esc(a.code + ' ' + a.name + (r.why ? '\n' + r.why : '')) + '</title></g>';
    });
    /* legami */
    if (S.ui.showLinks) {
      p.rels.forEach((rel) => {
        const yp = ypos.get(rel.pred), ys = ypos.get(rel.succ); if (yp === undefined || ys === undefined) return;
        const P = ctx.s.acts[rel.pred], Sx = ctx.s.acts[rel.succ]; if (!P || !Sx) return;
        const drv = ctx.s.rels && ctx.s.rels[rel.id] && ctx.s.rels[rel.id].driving;
        const x1 = rel.type === 'SS' || rel.type === 'SF' ? X(P.es) : X(P.ef);
        const x2 = rel.type === 'FF' || rel.type === 'SF' ? X(Sx.ef) : X(Sx.rs !== null && Sx.rs !== undefined ? Sx.rs : Sx.es);
        const y1 = yp + 13, y2 = ys + 13;
        const mx = rel.type === 'FF' || rel.type === 'SF' ? Math.max(x1, x2) + 8 : Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
        g += '<path d="M' + x1 + ' ' + y1 + 'H' + mx + 'V' + y2 + 'H' + x2 + '" class="glk' + (drv ? ' drv' : '') + '" marker-end="url(#arr)"/>';
      });
      g += '<defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="#5d6877"/></marker></defs>';
    }
    /* linea di avanzamento */
    if (S.ui.showProgLine && ctx.bls) {
      let d = '';
      rows.forEach((row, i) => {
        const y = HH + i * ROWH + 13;
        let x = X(DD + 1);
        if (!row.g) { const a = row.a; const b = VH.blDates(ctx, a); const cur = VH.dates(ctx, a); if ((a.as || (b.start !== undefined && b.start !== null && b.start <= DD)) && !a.af && b.finish !== undefined && b.finish !== null && cur.finish !== null) { x = X(DD + 1 - (cur.finish - b.finish)); } }
        d += (d ? 'L' : 'M') + x + ' ' + y;
      });
      g += '<path d="' + d + '" class="gprog"/>';
    }
    g += '<line x1="' + X(DD + 1) + '" x2="' + X(DD + 1) + '" y1="' + HH + '" y2="' + H + '" class="gdd"/>';
    hd += '<line x1="' + X(DD + 1) + '" x2="' + X(DD + 1) + '" y1="22" y2="' + HH + '" class="gdd"/><rect x="' + (X(DD + 1) + 2) + '" y="24" width="64" height="12" fill="#f3f5f8"/><text x="' + (X(DD + 1) + 4) + '" y="33" class="gddt">DD ' + U.fd(DD) + '</text>';
    const full = '<svg class="gantt" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Diagramma di Gantt">' + hd + g + '</svg>';
    const head = '<svg class="gantt" width="' + W + '" height="' + HH + '" viewBox="0 0 ' + W + ' ' + HH + '" aria-hidden="true">' + hd + '</svg>';
    const body = '<svg class="gantt" width="' + W + '" height="' + Math.max(1, H - HH) + '" viewBox="0 ' + HH + ' ' + W + ' ' + Math.max(1, H - HH) + '" role="img" aria-label="Diagramma di Gantt">' + g + '</svg>';
    return { svg: full, head, body, X, t0, W };
  }

  function pathsBar(ctx) {
    const s = ctx.s; if (!s.paths) return '';
    const crit = S.S().criticalMode === 'TF' ? 'Total float ≤ ' + S.S().tfThreshold : 'Longest Path';
    return '<div class="pathsbar"><b>Percorsi critici: ' + s.paths.length + '</b>' + UI.i('paths') + s.paths.map((x) => '<button type="button" class="pchip' + (S.ui.filter === 'path:' + x.n ? ' on' : '') + '" data-a="filterPath" data-n="' + x.n + '" title="Filtra il percorso ' + x.n + '"><i style="background:' + VH.pathColor(x.n) + '"></i>P' + x.n + ': ' + x.count + ' att., ' + U.int(x.length) + ' g, TF ' + U.int(x.float) + '</button>').join('') + (S.S().subOn ? '<span class="pchip static"><i style="background:' + VH.SUBCOLOR + '"></i>Sub-critiche (float ≤ ' + S.S().subThreshold + ' g): ' + s.subCount + '</span>' + UI.i('subcrit') : '') + '<span class="muted small">Criterio: ' + crit + '</span>' + UI.i('critical') + '</div>';
  }

  function traceBar(ctx, tr) {
    const t = S.ui.trace;
    const a = S.ui.sel && ctx.byId.get(S.ui.sel);
    const miles = ctx.p.activities.filter((x) => CPM.isMile(x));
    const nb = tr ? [...tr.levels.values()].filter((v) => v < 0).length : 0, nf = tr ? [...tr.levels.values()].filter((v) => v > 0).length : 0;
    return '<div class="tracebar"><b>' + UI.ic('trace') + ' Traccia</b>' + UI.i('trace') + (a ? '<span class="mono tsel-l">' + esc(a.code) + '</span> ' + esc(a.name) + ' <span class="chip tbk">' + nb + ' all\'indietro</span><span class="chip tfw">' + nf + ' in avanti</span>' : '<span class="muted">Seleziona un\'attività nella tabella, nel Gantt o nel reticolo.</span>') +
      '<label class="lbl">Profondità <input class="inp xs" type="number" min="1" max="30" value="' + t.depth + '" data-c="traceOpt" data-k="depth"></label>' +
      '<label class="lbl">Quasi spingenti fino a <input class="inp xs" type="number" min="0" max="60" value="' + t.near + '" data-c="traceOpt" data-k="near"> g</label>' + UI.i('nearDriving') +
      '<label class="lbl">Verso <select class="inp sm" data-c="traceOpt" data-k="toward"><option value="">tutte</option>' + miles.map((m) => '<option value="' + m.id + '"' + (t.toward === m.id ? ' selected' : '') + '>' + esc(m.code + ' ' + m.name) + '</option>').join('') + '</select></label>' +
      '<label class="sw"><input type="checkbox" data-c="traceOpt" data-k="hide"' + (t.hide ? ' checked' : '') + '> Nascondi il resto</label><label class="sw"><input type="checkbox" data-c="traceOpt" data-k="sortLevel"' + (t.sortLevel ? ' checked' : '') + '> Ordina per livello</label>' +
      '<span class="sp"></span><button type="button" class="btn sm" data-a="leversOpen"' + (a ? '' : ' disabled') + '>Leve</button>' + UI.i('levers') + '<button type="button" class="btn sm" data-a="traceExport"' + (a ? '' : ' disabled') + '>' + UI.ic('down', 16) + 'Esporta catena</button></div>';
  }

  M.Views.attivita = {
    title: 'Attività e Gantt',
    render() {
      const ctx = VH.ctx(); const p = ctx.p; M.VH.lastEV = ctx.ev;
      const tr = traceInfo(ctx);
      const rows = buildRows(ctx, tr);
      const cks = cols();
      const l = layout();
      const canEdit = S.can('schedule');
      const changes = S.inPreview() ? UI.chip(S.preview.changes + ' modifiche in anteprima', 'warn') : p.dirty ? '<button type="button" class="chip warn btnchip" data-a="f9">Modifiche non ancora schedulate</button>' : '';
      const codeGroups = (S.db.codeTypes || []).map((t) => ['code_' + t.id, 'Codice ' + t.name]);
      const view = S.ui.view || 'gantt';
      let content;
      if (view === 'net') content = M.Views.reticolo.render(ctx, tr);
      else {
        const gh = ganttHtml(ctx, rows, tr);
        content = '<div class="gw" id="gw"><div class="gl" id="gl" data-keep="gl">' + tableHtml(ctx, rows, tr, cks) + '</div><div class="gsplit" aria-hidden="true"></div><div class="gr" id="gr" data-keep="gr"><div class="gtop">' + gh.head + '</div>' + gh.body + '</div></div>' +
          UI.legend([['Consuntivo', '#2b6fd6'], ['Rimanente', '#2f9455']].concat((ctx.s.paths || []).map((x) => ['Percorso critico ' + x.n, VH.pathColor(x.n)])).concat([['Sub-critico', VH.SUBCOLOR], ['Baseline ' + (ctx.bl ? ctx.bl.code : ''), '#e0ad00', 'height:5px'], ['Level of Effort', '#a9d3b6'], ['Data date ' + U.fd(p.dataDate), 'none', 'border-left:2px dashed #1c5a8a;width:2px;border-radius:0']]).concat(S.ui.trace.on ? [['Traccia indietro', S.S().traceColors.back], ['Traccia avanti', S.S().traceColors.fwd]] : []));
      }
      return '<div class="head"><div><p class="ey">' + esc(p.code) + ' - ' + esc(p.workName || p.name) + '</p><h1>Attività e Gantt</h1></div><div class="acts">' + changes +
        (canEdit ? '<button type="button" class="btn" data-a="addAct">' + UI.ic('plus') + 'Attività</button><button type="button" class="btn" data-a="pasteOpen">' + UI.ic('paste') + 'Incolla da Excel</button>' + UI.i('paste') : '') +
        '<button type="button" class="btn" data-a="exportView">' + UI.ic('down') + 'Esporta la vista</button>' + UI.i('export') + '<button type="button" class="btn-p" data-a="f9">' + (S.inPreview() ? 'Conferma anteprima' : 'Schedula F9') + '</button></div></div>' +
        '<section class="card pad0"><div class="tool">' +
        '<label class="lbl">Layout ' + UI.i('layout') + '<select class="inp sm" data-c="layoutSel">' + (p.layouts || []).map((x) => '<option value="' + x.id + '"' + (x.id === l.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
        '<button type="button" class="btn sm" data-a="colsOpen">Colonne</button>' +
        '<label class="lbl">Filtro ' + UI.i('filters') + '<select class="inp sm" data-c="filterSel">' + FILTERS.map(([k, v]) => '<option value="' + k + '"' + (S.ui.filter === k ? ' selected' : '') + '>' + v + '</option>').join('') + (ctx.s.paths || []).map((x) => '<option value="path:' + x.n + '"' + (S.ui.filter === 'path:' + x.n ? ' selected' : '') + '>Percorso critico ' + x.n + '</option>').join('') + (p.drawings || []).map((d) => '<option value="dw:' + d.id + '"' + (S.ui.filter === 'dw:' + d.id ? ' selected' : '') + '>Tavola ' + esc(d.code) + '</option>').join('') + '</select></label>' +
        '<label class="lbl">Raggruppa ' + UI.i('group') + '<select class="inp sm" data-c="groupSel">' + [['wbs', 'WBS'], ['none', 'Nessuno'], ['path', 'Percorso critico'], ['driverType', 'Tipo di driver'], ['status', 'Stato']].concat(codeGroups).map(([k, v]) => '<option value="' + k + '"' + (S.ui.group === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
        '<label class="lbl srch">' + UI.ic('search', 16) + '<input class="inp sm" type="search" placeholder="Cerca ID o nome" value="' + esc(S.ui.search || '') + '" data-i="search" aria-label="Cerca attività"></label>' +
        '<span class="sp"></span>' +
        (view === 'gantt' ? '<button type="button" class="btn sm' + (S.ui.showBL ? ' on' : '') + '" aria-pressed="' + !!S.ui.showBL + '" data-a="tgl" data-k="showBL">Baseline</button><button type="button" class="btn sm' + (S.ui.showLinks ? ' on' : '') + '" aria-pressed="' + !!S.ui.showLinks + '" data-a="tgl" data-k="showLinks">Legami</button><button type="button" class="btn sm' + (S.ui.showProgLine ? ' on' : '') + '" aria-pressed="' + !!S.ui.showProgLine + '" data-a="tgl" data-k="showProgLine">Linea di avanzamento</button>' + UI.i('progressLine') + '<select class="inp sm" data-c="zoomSel" aria-label="Scala del tempo">' + Object.entries(ZOOM).map(([k, v]) => '<option value="' + k + '"' + (S.ui.ganttZoom === k ? ' selected' : '') + '>' + v.label + '</option>').join('') + '</select>' : '') +
        '<button type="button" class="btn sm' + (S.ui.trace.on ? ' on trace' : '') + '" aria-pressed="' + !!S.ui.trace.on + '" data-a="traceToggle">' + UI.ic('trace', 16) + 'Traccia</button>' +
        '<div class="seg"><button type="button" class="btn sm' + (view === 'gantt' ? ' on' : '') + '" aria-pressed="' + (view === 'gantt') + '" data-a="viewSel" data-v="gantt">' + UI.ic('gantt', 16) + 'Gantt</button><button type="button" class="btn sm' + (view === 'net' ? ' on' : '') + '" aria-pressed="' + (view === 'net') + '" data-a="viewSel" data-v="net">' + UI.ic('network', 16) + 'Reticolo</button></div>' + (view === 'net' ? UI.i('network') : UI.i('gantt')) +
        '</div>' + (S.ui.trace.on ? traceBar(ctx, tr) : '') + pathsBar(ctx) + content + '</section>' +
        M.Views.detail.render(ctx);
    },
    after() {
      const gl = document.getElementById('gl'), gr = document.getElementById('gr');
      if (gl && gr) {
        let lock = false;
        gl.addEventListener('scroll', () => { if (lock) return; lock = true; gr.scrollTop = gl.scrollTop; lock = false; });
        gr.addEventListener('scroll', () => { if (lock) return; lock = true; gl.scrollTop = gr.scrollTop; lock = false; });
        if (!M.Views.attivita._scrolled) {
          M.Views.attivita._scrolled = true;
          const p = S.P(); const DD = U.dnOf(p.dataDate);
          const dd = gr.querySelector('.gtop .gdd'); if (dd) gr.scrollLeft = Math.max(0, Number(dd.getAttribute('x1')) - gr.clientWidth * 0.35);
          void DD;
        }
        const sel = gl.querySelector('tr.sel');
        if (sel && M.Views.attivita._scrollToSel) { M.Views.attivita._scrollToSel = false; const top = sel.offsetTop - gl.clientHeight / 2; gl.scrollTop = top; gr.scrollTop = top; }
      }
      if (S.ui.view === 'net' && M.Views.reticolo.after) M.Views.reticolo.after();
    },
    key(ev) {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      const ctx = VH.ctx(); const rows = buildRows(ctx, traceInfo(ctx)).filter((r) => !r.g);
      const i = rows.findIndex((r) => r.a.id === S.ui.sel);
      const n = rows[Math.max(0, Math.min(rows.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))];
      if (n) { ev.preventDefault(); S.ui.sel = n.a.id; S.saveUi(); M.Views.attivita._scrollToSel = true; M.App.render(true); }
    },
    paste(text) { if (S.can('schedule')) M.Paste.open(text, 'activities'); },
    buildRows, cols, traceInfo, layout,
    ganttSvg() { const ctx = VH.ctx(); const tr = traceInfo(ctx); return ganttHtml(ctx, buildRows(ctx, tr), tr); }
  };

  /* ---------- azioni ---------- */
  Object.assign(M.A, {
    selRow(el) { const id = el.getAttribute('data-id'); if (S.ui.sel === id && !S.ui.trace.on) return; S.ui.sel = id; S.saveUi(); M.App.render(true); },
    toggleGroup(el, ev) { ev.stopPropagation(); const k = el.getAttribute('data-id'); S.ui.collapsed[k] = !S.ui.collapsed[k]; S.saveUi(); M.App.render(true); },
    sortBy(el) { const k = el.getAttribute('data-k'); if (S.ui.sortCol === k) { if (S.ui.sortDir > 0) S.ui.sortDir = -1; else { S.ui.sortCol = null; S.ui.sortDir = 1; } } else { S.ui.sortCol = k; S.ui.sortDir = 1; } S.saveUi(); M.App.render(true); },
    tgl(el) { const k = el.getAttribute('data-k'); S.ui[k] = !S.ui[k]; S.saveUi(); M.App.render(true); },
    viewSel(el) { S.ui.view = el.getAttribute('data-v'); S.saveUi(); M.App.render(true); },
    filterPath(el) { const f = 'path:' + el.getAttribute('data-n'); S.ui.filter = S.ui.filter === f ? 'all' : f; S.saveUi(); M.App.render(true); },
    traceToggle() { S.ui.trace.on = !S.ui.trace.on; if (S.ui.trace.on && !S.ui.sel) { const c = S.P().sched; const crit = c && c.paths && c.paths[0]; if (crit) S.ui.sel = crit.members[crit.members.length - 1]; } S.saveUi(); M.App.render(true); },
    addAct() {
      const p = S.P();
      const sel = S.ui.sel && p.activities.find((a) => a.id === S.ui.sel);
      S.mutate((w) => {
        const a = VH.newActivity(w, { wbsId: sel ? sel.wbsId : undefined });
        a.id = U.uid('a');
        w.activities.push(a);
        if (sel) w.rels.push({ id: U.uid('r'), pred: sel.id, succ: a.id, type: 'FS', lag: 0 });
        S.ui.sel = a.id; S.ui.detailTab = 'Generale';
      });
      UI.toast('Attività aggiunta' + (sel ? ' dopo ' + sel.code + ' (FS)' : '') + '. Completa i dati nel pannello sotto.', 'ok');
    },
    colsOpen() {
      const l = layout(); const cur = cols().filter((k) => k !== 'level'); const all = VH.fieldsAll();
      UI.modal({ title: 'Colonne della vista "' + l.name + '"', info: 'layout', wide: true, body: '<p class="help">Ogni campo, standard o personalizzato (UDF e codici), può diventare una colonna ed è esportabile in Excel. L\'ordine segue la selezione.</p><div class="colpick">' + Object.entries(all).map(([k, f]) => '<label class="ck"><input type="checkbox" value="' + k + '"' + (cur.includes(k) ? ' checked' : '') + '> ' + esc(f.label) + '</label>').join('') + '</div>', foot: '<button type="button" class="btn" data-a="colsSaveAs">Salva come nuovo layout</button><button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="colsApply">Applica</button>' });
    },
    colsApply() {
      const l = layout(); const sel = U.$$('.colpick input:checked').map((x) => x.value); const cur = cols().filter((k) => k !== 'level');
      const ordered = cur.filter((k) => sel.includes(k)).concat(sel.filter((k) => !cur.includes(k)));
      S.ui.cols = S.ui.cols || {}; S.ui.cols[l.id] = ordered; S.saveUi(); UI.closeModal(); M.App.render(true);
    },
    colsSaveAs() {
      const sel = U.$$('.colpick input:checked').map((x) => x.value);
      UI.closeModal();
      UI.prompt('Salva layout', 'Nome del layout', 'Vista ' + ((S.P().layouts || []).length + 1), (name) => {
        if (!name) return;
        const id = U.uid('ly');
        S.mutate((w) => { w.layouts = w.layouts || []; w.layouts.push({ id, name, cols: sel, group: S.ui.group, filter: S.ui.filter }); }, { affects: false, cap: 'schedule' });
        S.ui.layout = id; S.saveUi(); M.App.render(true);
      });
    },
    exportView() { M.Views.exportActivitiesView(); },
    pasteOpen() { M.Paste.open('', 'activities'); },
    leversOpen() { M.Views.attivita.levers(); },
    traceExport() {
      UI.modal({ title: 'Esporta la catena in Excel', info: 'trace', body: '<p>Colonne: livello, ID, nome, durata, date, float, tipo di legame, lag, margine, tipo di driver, tavole e i campi della vista corrente.</p><div class="acts"><label class="ck"><input type="radio" name="tx" value="back"> Indietro</label><label class="ck"><input type="radio" name="tx" value="fwd"> Avanti</label><label class="ck"><input type="radio" name="tx" value="both" checked> Entrambe</label></div>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="traceExportOk">Esporta</button>' });
    },
    traceExportOk() {
      const mode = (U.$('input[name="tx"]:checked') || {}).value || 'both';
      UI.closeModal();
      const ctx = VH.ctx(); const tr = traceInfo(ctx); if (!tr) return;
      const fields = VH.fieldsAll(); const extra = cols().filter((k) => !['level', 'code', 'name', 'od', 'start', 'finish', 'tf', 'drawings', 'driverType'].includes(k));
      const head = ['Livello', 'ID', 'Nome', 'Durata', 'Inizio', 'Fine', 'TF', 'Tipo legame', 'Lag', 'Margine (g)', 'Tipo driver', 'Tavole'].concat(extra.map((k) => fields[k].label));
      const mk = (filt) => {
        const ids = [...tr.levels.entries()].filter(([, v]) => filt(v)).sort((a, b) => a[1] - b[1]);
        const rows = [head.map((h) => ({ v: h, s: 1 }))];
        ids.forEach(([id, lv]) => {
          const a = ctx.byId.get(id); const rel = tr.via.get(id); const rr = rel && ctx.s.rels[rel.id];
          rows.push([lv, a.code, a.name, VH.cellValueForExcel(fields.od, ctx, a), VH.cellValueForExcel(fields.start, ctx, a), VH.cellValueForExcel(fields.finish, ctx, a), VH.cellValueForExcel(fields.tf, ctx, a), rel ? rel.type : '', rel ? rel.lag : '', rr && rr.rf !== null ? rr.rf : '', (ctx.s.acts[id] || {}).driverType || '', fields.drawings.get(ctx, a)].concat(extra.map((k) => VH.cellValueForExcel(fields[k], ctx, a))));
        });
        return rows;
      };
      const sheets = [];
      if (mode !== 'fwd') sheets.push({ name: 'Indietro', rows: mk((v) => v <= 0), freeze: 1, cols: [8, 10, 34, 8, 11, 11, 7, 10, 6, 10, 14, 14] });
      if (mode !== 'back') sheets.push({ name: 'Avanti', rows: mk((v) => v >= 0), freeze: 1, cols: [8, 10, 34, 8, 11, 11, 7, 10, 6, 10, 14, 14] });
      const a = ctx.byId.get(S.ui.sel);
      U.download('Traccia_' + U.slug(a.code) + '_' + mode + '.xlsx', M.Zip.xlsx(sheets));
      UI.toast('Catena esportata.', 'ok');
    }
  });
  Object.assign(M.C, {
    layoutSel(el) { S.ui.layout = el.value; const l = layout(); if (l.group) S.ui.group = l.group; if (l.filter) S.ui.filter = l.filter; S.saveUi(); M.App.render(true); },
    filterSel(el) { S.ui.filter = el.value; S.saveUi(); M.App.render(true); },
    groupSel(el) { S.ui.group = el.value; S.saveUi(); M.App.render(true); },
    zoomSel(el) { S.ui.ganttZoom = el.value; M.Views.attivita._scrolled = false; S.saveUi(); M.App.render(); },
    traceOpt(el) { const k = el.getAttribute('data-k'); S.ui.trace[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value; S.saveUi(); M.App.render(true); }
  });
  M.I.search = function (el) { S.ui.search = el.value; S.saveUi(); M.App.render(true); const i = U.$('[data-i="search"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };

  /* Leve: margini sul secondo vincolo lungo la catena all'indietro */
  M.Views.attivita.levers = function () {
    const ctx = VH.ctx(); const tr = traceInfo(ctx); if (!tr) return;
    const ids = [...tr.levels.entries()].filter(([, v]) => v <= 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const rows = ids.map((id) => {
      const a = ctx.byId.get(id), r = ctx.s.acts[id] || {};
      const drv = (r.driverPreds || []).map((pid) => ctx.byId.get(pid).code).join(', ');
      const m = r.margin;
      const lever = r.driverType === 'Legame' && drv ? (m ? 'Accorciando o anticipando ' + drv + ' recuperi al massimo ' + m.days + ' g su ' + a.code + ', poi spinge ' + m.by + '.' : 'Accorciando ' + drv + ' recuperi giorno per giorno: nessun altro vincolo.') : r.driverType === 'Vincolo' ? 'La data è imposta da un vincolo: si sposta solo rinegoziandolo.' : r.driverType === 'Data reale' ? 'Già iniziata: agisci sulla durata rimanente.' : r.driverType === 'Data date' ? 'Il rimanente parte dalla data date: agisci sulla durata rimanente.' : '';
      return '<tr><td class="mono">' + (tr.levels.get(id) || 0) + '</td><td class="mono">' + esc(a.code) + '</td><td>' + esc(a.name) + '</td><td>' + esc(r.driverType || '') + '</td><td class="mono">' + esc(drv) + '</td><td class="n">' + (m ? m.days + ' g' : '') + '</td><td>' + esc(m ? m.by : '') + '</td><td>' + esc(lever) + '</td></tr>';
    });
    UI.modal({ title: 'Leve sulla catena di ' + ctx.byId.get(S.ui.sel).code, info: 'levers', xwide: true, body: '<p class="help">Per ogni attività della catena all\'indietro: chi la spinge e quanto margine c\'è prima che diventi spingente il secondo vincolo. Le modifiche fatte in Traccia vanno sempre in anteprima.</p>' + UI.table(['Liv.', 'ID', 'Attività', 'Driver', 'Spinta da', { t: 'Margine', n: 1 }, 'Poi spinge', 'Leva'], rows) });
  };
})(window.M = window.M || {});
