/* Meridian - funzioni comuni alle viste: contesto di calcolo, registro dei campi (colonne, export, import) */
(function (M) {
  'use strict';
  const U = M.U, S = M.Store, CPM = M.CPM;
  const VH = {};

  const evCache = new Map();
  VH.ctx = function (p) {
    p = p || S.P();
    const s = p.sched && p.sched.acts ? p.sched : { acts: {}, rels: {}, paths: [], log: [] };
    const bl = S.baseline(p);
    const bls = bl && bl.sched && bl.sched.acts ? bl.sched : null;
    const key = p.id + '|' + (p.version || 0) + '|' + (s.ranAt || '') + '|' + (bl ? bl.id + (bl.sched && bl.sched.ranAt) : '') + '|' + JSON.stringify(p.activities).length + '|' + S.S().evTechnique + S.S().eacMethod + (S.inPreview() ? 'pv' + S.preview.changes : '');
    let ev = evCache.get(key);
    if (!ev) { ev = M.Costs.ev(p, s, bl, bls, S.db, { technique: S.S().evTechnique, eac: S.S().eacMethod }); evCache.clear(); evCache.set(key, ev); }
    const wbsMap = new Map((p.wbs || []).map((w) => [w.id, w]));
    const byId = new Map(p.activities.map((a) => [a.id, a]));
    const pcal = S.cal(p.calId) || CPM.DEFAULT_CAL;
    return { p, s, bl, bls, ev, wbsMap, byId, pcal, blActs: bl ? new Map(bl.activities.map((a) => [a.id, a])) : new Map() };
  };
  VH.wbsPath = function (ctx, wid) { const out = []; let w = ctx.wbsMap.get(wid); while (w) { out.unshift(w.code); w = ctx.wbsMap.get(w.parent); } return out.join('.'); };

  /* date di visualizzazione come in P6: inizio reale (A) o previsto, fine reale o prevista */
  VH.dates = function (ctx, a) {
    const r = ctx.s.acts[a.id];
    const out = { start: null, finish: null, sA: false, fA: false };
    if (a.as) { out.start = U.dnOf(a.as); out.sA = true; } else if (r) out.start = r.es;
    if (a.af) { out.finish = U.dnOf(a.af); out.fA = true; } else if (r) out.finish = r.ef - 1;
    if (a.type === 'start') { out.finish = null; }
    if (a.type === 'finish') { out.start = null; if (!a.af && r) out.finish = r.ef - 1; }
    return out;
  };
  VH.blDates = function (ctx, a) {
    if (!ctx.bls) return {};
    const b = ctx.blActs.get(a.id); const r = b && ctx.bls.acts[a.id];
    if (!r) return {};
    return { start: a.type === 'finish' ? null : r.es, finish: a.type === 'start' ? null : r.ef - 1 };
  };
  VH.status = (a) => (a.af ? 'Completata' : a.as ? 'In corso' : 'Non iniziata');
  VH.statusChip = (a, r) => (a.af ? '<span class="chip ok">Completata</span>' : a.as ? '<span class="chip info">In corso</span>' : '<span class="chip neutral">Non iniziata</span>') + (r && r.crit ? ' <span class="chip bad">Critica</span>' : r && r.sub ? ' <span class="chip warn">Sub-critica</span>' : '');
  VH.relText = (r, ctx) => { const p = ctx.byId.get(r.pred); return (p ? p.code : r.pred) + ' ' + CPM.lagText(r); };
  VH.pathColor = function (n) { return ['#cf3a3a', '#8e44ad', '#c2185b', '#a0522d', '#d35400', '#7b1fa2'][(n - 1) % 6]; };
  VH.SUBCOLOR = '#e39b2e';

  /* parser dei legami scritti come testo: "A1020 FS+2; A1015 SS" */
  VH.parseRels = function (text, p, succId) {
    const out = [], errs = [];
    String(text || '').split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean).forEach((tok) => {
      const m = /^([^\s]+)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+)?\s*g?$/i.exec(tok);
      if (!m) { errs.push('"' + tok + '" non è un legame valido (es. A1020 FS+2)'); return; }
      const pred = p.activities.find((a) => a.code.toLowerCase() === m[1].toLowerCase());
      if (!pred) { errs.push('attività ' + m[1] + ' inesistente'); return; }
      if (pred.id === succId) { errs.push('un\'attività non può precedere se stessa'); return; }
      out.push({ pred: pred.id, type: (m[2] || 'FS').toUpperCase(), lag: m[3] ? Number(m[3].replace(/\s/g, '')) : 0 });
    });
    return { rels: out, errs };
  };

  const days = (v) => (v === null || v === undefined || v === '' ? '' : U.int(v));
  const dfmt = (v) => (v === null || v === undefined ? '' : U.fd(v));
  function setDate(a, k, v) { if (v === '' || v === null || v === undefined) { delete a[k]; return null; } const d = U.parseDate(v); if (d === null) return 'data non valida'; a[k] = U.isoOf(d); return null; }
  function setNum(a, k, v, min, max) { if (v === '' || v === null || v === undefined) return null; const n = U.parseNum(v); if (Number.isNaN(n)) return 'numero non valido'; if (min !== undefined && n < min) return 'minimo ' + min; if (max !== undefined && n > max) return 'massimo ' + max; a[k] = n; return null; }

  /* registro dei campi: colonne delle viste, export Excel, import e incolla */
  const F = {
    code: { label: 'ID attività', short: 'ID', w: 74, mono: 1, get: (c, a) => a.code, set: (a, v) => { if (!v) return 'obbligatorio'; a.code = String(v).trim(); return null; } },
    name: { label: 'Nome attività', short: 'Nome attività', w: 230, get: (c, a) => a.name, set: (a, v) => { a.name = String(v || ''); return null; } },
    wbs: { label: 'WBS', w: 110, mono: 1, get: (c, a) => VH.wbsPath(c, a.wbsId), set: (a, v, c) => { const code = String(v || '').split('.').pop(); const w = (c.p.wbs || []).find((x) => x.code === code || VH.wbsPath(c, x.id) === v); if (!w) return 'WBS ' + v + ' inesistente'; a.wbsId = w.id; return null; } },
    type: { label: 'Tipo attività', w: 120, get: (c, a) => CPM.TYPES[a.type], set: (a, v) => { const k = Object.keys(CPM.TYPES).find((x) => CPM.TYPES[x].toLowerCase() === String(v).toLowerCase() || x === v); if (!k) return 'tipo non riconosciuto'; a.type = k; return null; } },
    status: { label: 'Stato', w: 96, get: (c, a) => VH.status(a) },
    od: { label: 'Durata originale', short: 'Dur.', w: 56, num: 1, get: (c, a) => (a.type === 'loe' ? (c.s.acts[a.id] || {}).odCalc : a.od), fmt: days, set: (a, v) => setNum(a, 'od', v, 0, 9999) },
    rd: { label: 'Durata rimanente', short: 'Rim.', w: 56, num: 1, get: (c, a) => (a.af ? 0 : a.as ? a.rd : (c.s.acts[a.id] || {}).dur !== undefined && a.type === 'loe' ? (c.s.acts[a.id] || {}).dur : a.od), fmt: days, set: (a, v) => setNum(a, 'rd', v, 0, 9999) },
    start: { label: 'Inizio', w: 86, date: 1, get: (c, a) => VH.dates(c, a).start, fmt: dfmt, suffix: (c, a) => (VH.dates(c, a).sA ? ' A' : '') },
    finish: { label: 'Fine', w: 86, date: 1, get: (c, a) => VH.dates(c, a).finish, fmt: dfmt, suffix: (c, a) => (VH.dates(c, a).fA ? ' A' : '') },
    as: { label: 'Inizio reale', w: 86, date: 1, get: (c, a) => U.dnOf(a.as), fmt: dfmt, set: (a, v) => setDate(a, 'as', v) },
    af: { label: 'Fine reale', w: 86, date: 1, get: (c, a) => U.dnOf(a.af), fmt: dfmt, set: (a, v) => setDate(a, 'af', v) },
    es: { label: 'Early start', w: 86, date: 1, get: (c, a) => (c.s.acts[a.id] || {}).es, fmt: dfmt },
    ef: { label: 'Early finish', w: 86, date: 1, get: (c, a) => { const r = c.s.acts[a.id]; return r ? r.ef - 1 : null; }, fmt: dfmt },
    ls: { label: 'Late start', w: 86, date: 1, get: (c, a) => (c.s.acts[a.id] || {}).ls, fmt: dfmt },
    lf: { label: 'Late finish', w: 86, date: 1, get: (c, a) => { const r = c.s.acts[a.id]; return r && r.lf !== undefined ? r.lf - 1 : null; }, fmt: dfmt },
    tf: { label: 'Total float', short: 'TF', w: 46, num: 1, get: (c, a) => (c.s.acts[a.id] || {}).tf, fmt: days, cls: (v) => (v < 0 ? 'neg' : '') },
    ff: { label: 'Free float', short: 'FF', w: 46, num: 1, get: (c, a) => (c.s.acts[a.id] || {}).ff, fmt: days },
    near: { label: 'Float verso la fine', short: 'Float fine', w: 60, num: 1, get: (c, a) => (c.s.acts[a.id] || {}).near, fmt: days },
    pct: { label: '% fisica', short: '%', w: 64, num: 1, get: (c, a) => M.Costs.actPct(a, c.s.acts[a.id], S.db), fmt: (v) => (v === null || v === undefined ? '' : U.pct(v)), set: (a, v) => setNum(a, 'pct', v, 0, 100) },
    pctType: { label: 'Tipo % completamento', w: 110, get: (c, a) => ({ phys: 'Physical', dur: 'Duration', units: 'Units', qty: 'Quantità' })[a.pctType || 'phys'] },
    durType: { label: 'Tipo di durata', w: 120, get: (c, a) => ({ FDU: 'Fixed Duration and Units/Time', FDQ: 'Fixed Duration and Units', FR: 'Fixed Units/Time', FQ: 'Fixed Units' })[a.durType || 'FDU'] },
    crit: { label: 'Critica', w: 56, get: (c, a) => ((c.s.acts[a.id] || {}).crit ? 'sì' : (c.s.acts[a.id] || {}).sub ? 'sub' : ''), set: null },
    path: { label: 'Percorso critico', short: 'Perc.', w: 50, num: 1, get: (c, a) => (c.s.acts[a.id] || {}).path || '' },
    driverPred: { label: 'Predecessore spingente', short: 'Pred. spingente', w: 92, mono: 1, get: (c, a) => ((c.s.acts[a.id] || {}).driverPreds || []).map((id) => (c.byId.get(id) || {}).code).join(', '), tip: (c, a) => (c.s.acts[a.id] || {}).why },
    driverType: { label: 'Tipo di driver', w: 92, get: (c, a) => (c.s.acts[a.id] || {}).driverType || '', tip: (c, a) => (c.s.acts[a.id] || {}).why },
    drivenCount: { label: 'Successori spinti', short: 'Succ. spinti', w: 60, num: 1, get: (c, a) => (c.s.acts[a.id] || {}).drivenCount },
    margin: { label: 'Margine sul 2° vincolo', short: 'Margine 2°', w: 86, get: (c, a) => { const m = (c.s.acts[a.id] || {}).margin; return m ? m.days + ' g (' + m.by + ')' : ''; } },
    cstr: { label: 'Vincolo', w: 130, get: (c, a) => (a.cstr && a.cstr.t ? a.cstr.t + (a.cstr.d ? ' ' + U.fd(a.cstr.d) : '') : ''), set: (a, v) => { if (!v) { delete a.cstr; return null; } const m = /^(SNET|FNET|SNLT|FNLT|SO|FO|MSO|MFO|ALAP)\s*(.*)$/i.exec(String(v).trim()); if (!m) return 'vincolo non valido (es. SNET 03/03/27)'; const d = m[2] ? U.parseDate(m[2]) : null; a.cstr = { t: m[1].toUpperCase(), d: d !== null ? U.isoOf(d) : '' }; return null; } },
    cal: { label: 'Calendario', w: 130, get: (c, a) => (S.cal(a.calId || c.p.calId) || {}).name, set: (a, v) => { const cal = S.db.calendars.find((x) => x.name === v || x.id === v); if (!cal) return 'calendario inesistente'; a.calId = cal.id; return null; } },
    preds: { label: 'Predecessori', w: 150, get: (c, a) => c.p.rels.filter((r) => r.succ === a.id).map((r) => VH.relText(r, c)).join('; '), setRels: true },
    succs: { label: 'Successori', w: 150, get: (c, a) => c.p.rels.filter((r) => r.pred === a.id).map((r) => { const s = c.byId.get(r.succ); return (s ? s.code : r.succ) + ' ' + CPM.lagText(r); }).join('; ') },
    blStart: { label: 'Inizio baseline', short: 'Inizio BL', w: 86, date: 1, get: (c, a) => VH.blDates(c, a).start, fmt: dfmt },
    blFinish: { label: 'Fine baseline', short: 'Fine BL', w: 86, date: 1, get: (c, a) => VH.blDates(c, a).finish, fmt: dfmt },
    varStart: { label: 'Variazione inizio (g)', short: 'Var. inizio', w: 66, num: 1, get: (c, a) => { const b = VH.blDates(c, a).start, d = VH.dates(c, a).start; return b !== undefined && b !== null && d !== null ? M.Cal.between(c.pcal, d, b) : null; }, fmt: days, cls: (v) => (v < 0 ? 'neg' : v > 0 ? 'pos' : '') },
    varFinish: { label: 'Variazione fine (g)', short: 'Var. fine', w: 66, num: 1, get: (c, a) => { const b = VH.blDates(c, a).finish, d = VH.dates(c, a).finish; return b !== undefined && b !== null && d !== null ? M.Cal.between(c.pcal, d + 1, b + 1) : null; }, fmt: days, cls: (v) => (v < 0 ? 'neg' : v > 0 ? 'pos' : '') },
    budget: { label: 'Budget (€)', short: 'Budget', w: 100, num: 1, get: (c, a) => (c.ev.per[a.id] || {}).bud, fmt: (v) => U.num(v) },
    pv: { label: 'Planned Value (€)', short: 'PV', w: 100, num: 1, get: (c, a) => (c.ev.per[a.id] || {}).pv, fmt: (v) => U.num(v) },
    ev: { label: 'Earned Value (€)', short: 'EV', w: 100, num: 1, get: (c, a) => (c.ev.per[a.id] || {}).ev, fmt: (v) => U.num(v) },
    ac: { label: 'Actual Cost (€)', short: 'AC', w: 100, num: 1, get: (c, a) => (c.ev.per[a.id] || {}).ac, fmt: (v) => U.num(v) },
    etc: { label: 'Costo rimanente (€)', short: 'Rimanente', w: 100, num: 1, get: (c, a) => (c.ev.per[a.id] || {}).rem, fmt: (v) => U.num(v) },
    spi: { label: 'SPI', w: 50, num: 1, get: (c, a) => { const e = c.ev.per[a.id]; return e && e.pv ? e.ev / e.pv : null; }, fmt: (v) => (v === null ? '' : U.num(v)), cls: (v) => (v !== null && v < 0.9 ? 'neg' : '') },
    cpi: { label: 'CPI', w: 50, num: 1, get: (c, a) => { const e = c.ev.per[a.id]; return e && e.ac ? e.ev / e.ac : null; }, fmt: (v) => (v === null ? '' : U.num(v)), cls: (v) => (v !== null && v < 0.9 ? 'neg' : '') },
    resources: { label: 'Risorse', w: 160, get: (c, a) => (a.assign || []).map((x) => (S.res(x.resId) || {}).name).filter(Boolean).join(', ') },
    drawings: { label: 'Tavole', w: 120, get: (c, a) => (a.drawings || []).map((id) => ((c.p.drawings || []).find((d) => d.id === id) || {}).code).filter(Boolean).join(', '), set: (a, v, c) => { const codes = String(v || '').split(/[;,]+/).map((x) => x.trim()).filter(Boolean); const ids = []; for (const code of codes) { const d = (c.p.drawings || []).find((x) => x.code === code); if (!d) return 'tavola ' + code + ' non nel registro'; ids.push(d.id); } a.drawings = ids; return null; } },
    notes: { label: 'Ultima nota', w: 180, get: (c, a) => { const n = (a.notes || [])[a.notes.length - 1]; return n ? n.text : ''; } }
  };
  VH.fieldsAll = function () {
    const out = Object.assign({}, F);
    (S.db.codeTypes || []).forEach((t) => { out['code_' + t.id] = { label: 'Codice ' + t.name, short: t.name, w: 90, get: (c, a) => (a.codes || {})[t.id] || '', set: (a, v) => { if (!v) { delete (a.codes || {})[t.id]; return null; } if (!t.values.some((x) => x.code === v)) return 'valore ' + v + ' non ammesso per ' + t.name; a.codes = a.codes || {}; a.codes[t.id] = v; return null; } }; });
    (S.db.udfTypes || []).forEach((t) => { out['udf_' + t.id] = { label: 'UDF ' + t.name, short: t.name, w: 86, num: t.type === 'number' || t.type === 'cost' ? 1 : 0, get: (c, a) => (a.udf || {})[t.id], fmt: (v) => (v === undefined || v === null ? '' : t.type === 'number' || t.type === 'cost' ? U.num(v) : String(v)), set: (a, v) => { a.udf = a.udf || {}; if (t.type === 'number' || t.type === 'cost') { const n = U.parseNum(v); if (v !== '' && Number.isNaN(n)) return 'numero non valido'; a.udf[t.id] = v === '' ? undefined : n; } else a.udf[t.id] = v; return null; } }; });
    return out;
  };
  VH.fmtField = function (f, c, a) { const v = f.get(c, a); let s = f.fmt ? f.fmt(v) : v === null || v === undefined ? '' : String(v); if (f.suffix && s) s += f.suffix(c, a); return s; };
  VH.cellValueForExcel = function (f, c, a) {
    const v = f.get(c, a);
    if (v === null || v === undefined || v === '') return '';
    if (f.date) return { v, t: 'd' };
    if (f.num && typeof v === 'number') return Math.round(v * 100) / 100;
    return String(v);
  };

  /* applica un insieme di valori (da incolla o import) a un'attività, con validazione per cella */
  VH.applyRow = function (p, a, rowVals, ctx, isNew) {
    const fields = VH.fieldsAll();
    const errs = {};
    Object.entries(rowVals).forEach(([k, v]) => {
      const f = fields[k]; if (!f) return;
      if (f.setRels) {
        const r = VH.parseRels(v, p, a.id);
        if (r.errs.length) { errs[k] = r.errs.join('; '); return; }
        p.rels = p.rels.filter((x) => x.succ !== a.id).concat(r.rels.map((x) => Object.assign({ id: U.uid('r'), succ: a.id }, x)));
        return;
      }
      if (!f.set) return;
      const e = f.set(a, v, ctx);
      if (e) errs[k] = e;
    });
    void isNew;
    return errs;
  };

  VH.newActivity = function (p, o) {
    const n = p.activities.length;
    let num = 1000 + (n + 1) * 10, code = 'A' + num;
    while (p.activities.some((a) => a.code === code)) { num += 10; code = 'A' + num; }
    const d = p.defaults || {};
    return Object.assign({ id: U.uid('a'), code, name: 'Nuova attività', wbsId: ((p.wbs || []).find((w) => !w.parent) || {}).id, type: d.actType || 'task', od: 5, pct: 0, pctType: d.pctType || 'phys', durType: d.durType || 'FDU', assign: [], costs: [], steps: [], codes: {}, udf: {}, drawings: [], notes: [] }, o || {});
  };

  VH.lastEV = null;
  M.VH = VH;
})(window.M = window.M || {});
