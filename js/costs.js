/* Meridian - costi, distribuzione nel tempo, Earned Value, profili di risorse e materiali */
(function (M) {
  'use strict';
  const U = M.U, Cal = M.Cal;

  const CURVES = {
    uniform: { name: 'Uniforme', w: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
    bell: { name: 'Curva a S (campana)', w: [2, 5, 9, 14, 20, 20, 14, 9, 5, 2] },
    front: { name: 'Anticipata', w: [20, 18, 15, 12, 10, 8, 7, 5, 3, 2] },
    back: { name: 'Posticipata', w: [2, 3, 5, 7, 8, 10, 12, 15, 18, 20] }
  };
  const DIST = { linear: 'Lineare', start: 'A inizio', end: 'A fine', bell: 'Curva a S', front: 'Anticipata', back: 'Posticipata' };

  function curveW(db, id) {
    if (CURVES[id]) return CURVES[id].w;
    const c = (db && db.curves || []).find((x) => x.id === id);
    return c ? c.w : CURVES.uniform.w;
  }

  /* distribuisce amount sui giorni lavorativi [s, e) secondo una curva; cb(giorno, valore) */
  function spread(amount, s, e, cal, w, cb, mode) {
    if (!amount) return;
    if (mode === 'start' || s >= e) { cb(Cal.nextWork(cal, s), amount); return; }
    if (mode === 'end') { cb(Cal.prevWorkEnd(cal, e) - 1, amount); return; }
    const days = [];
    for (let d = s; d < e; d++) if (Cal.isWork(cal, d)) days.push(d);
    if (!days.length) { cb(s, amount); return; }
    const n = days.length;
    let tot = 0;
    const ws = days.map((d, i) => { const x = w[Math.min(9, Math.floor(((i + 0.5) / n) * 10))]; tot += x; return x; });
    days.forEach((d, i) => cb(d, (amount * ws[i]) / tot));
  }

  function calOf(db, project, a) {
    return (db.calendars || []).find((c) => c.id === (a && a.calId)) || (db.calendars || []).find((c) => c.id === project.calId) || M.CPM.DEFAULT_CAL;
  }
  const resOf = (db, id) => (db.resources || []).find((r) => r.id === id);

  function lineAmount(l) { return (Number(l.qty) || 0) * (Number(l.unit) || 0); }

  /* costi di un'attività */
  function actCost(a, db) {
    let bud = 0, act = 0, rem = 0, budRes = 0, budLines = 0;
    (a.assign || []).forEach((x) => {
      const r = resOf(db, x.resId); const p = r ? Number(x.price !== undefined ? x.price : r.price) || 0 : 0;
      bud += (x.bud || 0) * p; act += (x.act || 0) * p; rem += (x.rem !== undefined ? x.rem : Math.max(0, (x.bud || 0) - (x.act || 0))) * p; budRes += (x.bud || 0) * p;
    });
    (a.costs || []).forEach((l) => {
      const amt = lineAmount(l);
      bud += amt; budLines += amt; act += Number(l.actual) || 0;
      const done = (Number(l.qtyDone) || 0) * (Number(l.unit) || 0);
      rem += Math.max(0, amt - done);
    });
    return { bud, act, rem, atc: act + rem, budRes, budLines };
  }

  /* percentuale di avanzamento dell'attività secondo il tipo */
  function actPct(a, sres, db) {
    if (a.af) return 100;
    const t = a.pctType || 'phys';
    if (a.type === 'loe' && sres) {
      if (!a.as) return 0;
      const tot = sres.odCalc || 1; const left = sres.dur || 0;
      return U.clamp(((tot - left) / tot) * 100, 0, 100);
    }
    if (t === 'dur') { const od = a.od || 0; if (!od) return a.as ? 0 : 0; return U.clamp(((od - (a.rd !== undefined ? a.rd : od)) / od) * 100, 0, 100); }
    if (t === 'units') {
      let act = 0, atc = 0;
      (a.assign || []).forEach((x) => { act += x.act || 0; atc += (x.act || 0) + (x.rem !== undefined ? x.rem : 0); });
      return atc ? U.clamp((act / atc) * 100, 0, 100) : 0;
    }
    if (t === 'qty') {
      let done = 0, tot = 0;
      (a.costs || []).forEach((l) => { const u = Number(l.unit) || 0; done += (Number(l.qtyDone) || 0) * u; tot += (Number(l.qty) || 0) * u; });
      return tot ? U.clamp((done / tot) * 100, 0, 100) : 0;
    }
    if (a.steps && a.steps.length && a.stepsDrive !== false) {
      const W = U.sum(a.steps, (s) => s.w); return W ? U.sum(a.steps, (s) => s.w * (s.pct || 0)) / W : 0;
    }
    return Number(a.pct) || 0;
  }

  function evPct(a, sres, db, technique) {
    const p = actPct(a, sres, db);
    if (technique === '0/100') return a.af ? 100 : 0;
    if (technique === '50/50') return a.af ? 100 : a.as ? 50 : 0;
    return p;
  }

  /* PV di un progetto (dalla baseline) fino al giorno t compreso; con bucket mensili opzionali */
  function plannedSpread(project, sched, db, upto, buckets) {
    let pv = 0;
    (project.activities || []).forEach((a) => {
      if (a.type === 'wbs') return;
      const r = sched && sched.acts[a.id]; if (!r) return;
      const c = actCost(a, db); const cal = calOf(db, project, a);
      const s = r.es, e = r.ef;
      (a.assign || []).forEach((x) => {
        const res = resOf(db, x.resId); const p = res ? Number(x.price !== undefined ? x.price : res.price) || 0 : 0;
        spread((x.bud || 0) * p, s, e, cal, curveW(db, x.curve || 'uniform'), (d, v) => { if (upto === undefined || d <= upto) pv += v; if (buckets) add(buckets, U.monthKey(d), v); });
      });
      (a.costs || []).forEach((l) => {
        const mode = l.dist === 'start' ? 'start' : l.dist === 'end' ? 'end' : null;
        spread(lineAmount(l), s, e, cal, curveW(db, l.dist === 'linear' ? 'uniform' : l.dist), (d, v) => { if (upto === undefined || d <= upto) pv += v; if (buckets) add(buckets, U.monthKey(d), v); }, mode);
      });
      void c;
    });
    return pv;
  }
  function add(m, k, v) { m.set(k, (m.get(k) || 0) + v); }

  /* PV giornaliero cumulato (per Earned Schedule) */
  function pvDaily(project, sched, db) {
    const m = new Map();
    (project.activities || []).forEach((a) => {
      if (a.type === 'wbs') return;
      const r = sched && sched.acts[a.id]; if (!r) return;
      const cal = calOf(db, project, a);
      (a.assign || []).forEach((x) => { const res = resOf(db, x.resId); const p = res ? Number(x.price !== undefined ? x.price : res.price) || 0 : 0; spread((x.bud || 0) * p, r.es, r.ef, cal, curveW(db, x.curve || 'uniform'), (d, v) => add(m, d, v)); });
      (a.costs || []).forEach((l) => { const mode = l.dist === 'start' ? 'start' : l.dist === 'end' ? 'end' : null; spread(lineAmount(l), r.es, r.ef, cal, curveW(db, l.dist === 'linear' ? 'uniform' : l.dist), (d, v) => add(m, d, v), mode); });
    });
    const days = [...m.keys()].sort((a, b) => a - b);
    let cum = 0; const out = days.map((d) => { cum += m.get(d); return [d, cum]; });
    return out;
  }

  /* Earned Value completo */
  function ev(project, sched, bl, blSched, db, opt) {
    opt = Object.assign({ technique: 'pct', eac: 'cpi', wbs: null }, opt || {});
    const DD = U.dnOf(project.dataDate);
    const inWbs = wbsFilter(project, opt.wbs);
    const per = {};
    let BAC = 0, EV = 0, AC = 0, PV = 0, REM = 0;
    const blActs = bl ? new Map(bl.activities.map((a) => [a.id, a])) : null;
    (project.activities || []).forEach((a) => {
      if (a.type === 'wbs' || !inWbs(a)) return;
      const c = actCost(a, db);
      const r = sched && sched.acts[a.id];
      const pct = evPct(a, r, db, opt.technique);
      let pv = 0;
      if (bl && blSched) {
        const b = blActs.get(a.id);
        if (b) pv = plannedSpread({ activities: [b], calId: bl.calId }, blSched, db, DD);
      } else if (r) pv = plannedSpread({ activities: [a], calId: project.calId }, sched, db, DD);
      const e = (c.bud * pct) / 100;
      per[a.id] = { bud: c.bud, pv, ev: e, ac: c.act, rem: c.rem, pct };
      BAC += c.bud; EV += e; AC += c.act; PV += pv; REM += c.rem;
    });
    return Object.assign(indices(BAC, PV, EV, AC, REM, opt.eac), { per });
  }

  function indices(BAC, PV, EV, AC, REM, method) {
    const SV = EV - PV, CV = EV - AC;
    const SPI = PV ? EV / PV : null, CPI = AC ? EV / AC : null;
    let EAC;
    if (method === 'rem') EAC = AC + REM;
    else if (method === 'cpispi') EAC = AC + (CPI && SPI ? (BAC - EV) / (CPI * SPI) : BAC - EV);
    else if (method === 'pf1') EAC = AC + (BAC - EV);
    else EAC = CPI ? BAC / CPI : BAC;
    const ETC = EAC - AC, VAC = BAC - EAC;
    const TCPI = BAC - AC !== 0 ? (BAC - EV) / (BAC - AC) : null;
    return { BAC, PV, EV, AC, SV, CV, SPI, CPI, EAC, ETC, VAC, TCPI, REM };
  }

  function wbsFilter(project, wbsId) {
    if (!wbsId) return () => true;
    const kids = new Map();
    (project.wbs || []).forEach((w) => { if (w.parent) { if (!kids.has(w.parent)) kids.set(w.parent, []); kids.get(w.parent).push(w.id); } });
    const set = new Set([wbsId]); const st = [wbsId];
    while (st.length) (kids.get(st.pop()) || []).forEach((k) => { set.add(k); st.push(k); });
    return (a) => set.has(a.wbsId);
  }

  /* Earned Schedule: tempo in cui la PV della baseline vale l'EV attuale */
  function earnedSchedule(project, evr, bl, blSched, db) {
    if (!bl || !blSched || !evr.PV) return null;
    const cal = calOf(db, project, null);
    const pvd = pvDaily(bl, blSched, db);
    if (!pvd.length) return null;
    const DD = U.dnOf(project.dataDate);
    let esDay = pvd[0][0];
    for (let i = 0; i < pvd.length; i++) { if (pvd[i][1] >= evr.EV - 0.5) { esDay = pvd[i][0]; break; } esDay = pvd[i][0]; }
    const start = blSched.start;
    const AT = Cal.between(cal, start, DD + 1);
    const ES = Cal.between(cal, start, esDay + 1);
    const PD = Cal.between(cal, start, blSched.finish);
    const SVt = ES - AT; const SPIt = AT ? ES / AT : null;
    const IEACt = SPIt ? PD / SPIt : null;
    const forecastFinish = IEACt ? Cal.add(cal, start, Math.round(IEACt)) - 1 : null;
    return { esDay, ES, AT, PD, SVt, SPIt, IEACt, forecastFinish };
  }

  /* curve mensili: PV (baseline), budget sul programma corrente, EV e AC (storico + oggi), previsione */
  function curves(project, sched, bl, blSched, db, evr) {
    const pvB = new Map(); plannedSpread(bl || project, blSched || sched, db, undefined, pvB);
    const curB = new Map(); plannedSpread(project, sched, db, undefined, curB);
    const DD = U.dnOf(project.dataDate);
    const ddKey = U.monthKey(DD);
    /* previsione: ETC distribuito come il budget rimanente sul programma corrente */
    const remB = new Map();
    let remTot = 0;
    (project.activities || []).forEach((a) => {
      if (a.type === 'wbs') return;
      const r = sched.acts[a.id]; if (!r || a.af) return;
      const p = evr.per[a.id]; if (!p) return;
      const left = Math.max(0, p.bud - p.ev); if (!left) return;
      remTot += left;
      spread(left, Math.max(r.rs !== null && r.rs !== undefined ? r.rs : r.es, DD + 1), Math.max(r.ef, DD + 2), calOf(db, project, a), CURVES.uniform.w, (d, v) => add(remB, U.monthKey(d), v));
    });
    const scale = remTot ? evr.ETC / remTot : 1;
    const keys = new Set([...pvB.keys(), ...curB.keys(), ...remB.keys()]);
    (project.periodHistory || []).forEach((h) => keys.add(U.monthKey(U.dnOf(h.end))));
    keys.add(ddKey);
    const ks = [...keys].sort((a, b) => a - b);
    const k0 = ks[0], k1 = ks[ks.length - 1];
    const out = [];
    let cpv = 0, ccur = 0, cfc = evr.AC;
    const hist = new Map((project.periodHistory || []).map((h) => [U.monthKey(U.dnOf(h.end)), h]));
    for (let k = k0; k <= k1; k++) {
      cpv += pvB.get(k) || 0; ccur += curB.get(k) || 0;
      const row = { key: k, pv: cpv, plan: ccur };
      if (k < ddKey && hist.has(k)) { row.ev = hist.get(k).ev; row.ac = hist.get(k).ac; }
      if (k === ddKey) { row.ev = evr.EV; row.ac = evr.AC; row.fc = evr.AC; }
      if (k > ddKey) { cfc += (remB.get(k) || 0) * scale; row.fc = cfc; }
      out.push(row);
    }
    return out;
  }

  /* profilo mensile di una risorsa su più progetti */
  function resourceProfile(db, resId, projects, scheds) {
    const res = resOf(db, resId); if (!res) return null;
    const rcal = (db.calendars || []).find((c) => c.id === res.calId) || (db.calendars || [])[0] || M.CPM.DEFAULT_CAL;
    const months = new Map();
    const daily = new Map();
    const lines = [];
    projects.forEach((p) => {
      const s = scheds[p.id]; if (!s || !s.acts) return;
      const DD = U.dnOf(p.dataDate);
      p.activities.forEach((a) => (a.assign || []).forEach((x) => {
        if (x.resId !== resId) return;
        const r = s.acts[a.id]; if (!r) return;
        const cal = calOf(db, p, a);
        lines.push({ project: p, act: a, asg: x });
        const put = (d, v) => { const k = U.monthKey(d); if (!months.has(k)) months.set(k, {}); const m = months.get(k); m[p.id] = (m[p.id] || 0) + v; daily.set(d, (daily.get(d) || 0) + v); };
        if (x.act && a.as) spread(x.act, U.dnOf(a.as), a.af ? U.dnOf(a.af) + 1 : DD + 1, cal, CURVES.uniform.w, put);
        const rem = x.rem !== undefined ? x.rem : Math.max(0, (x.bud || 0) - (x.act || 0));
        if (rem && !a.af) spread(rem, r.rs !== null && r.rs !== undefined ? r.rs : r.es, r.ef, cal, curveW(db, x.curve || 'uniform'), put);
      }));
    });
    const ks = [...months.keys()].sort((a, b) => a - b);
    const rows = [];
    if (ks.length) for (let k = ks[0]; k <= ks[ks.length - 1]; k++) {
      const m = months.get(k) || {};
      const s = U.monthStart(k), e = U.lastOfMonth(s);
      const avail = (res.maxUpd || 0) * Cal.workDaysIn(rcal, s, e);
      const total = U.sum(Object.values(m));
      rows.push({ key: k, per: m, total, avail, over: Math.max(0, total - avail) });
    }
    let overDays = 0;
    daily.forEach((v) => { if (res.maxUpd && v > res.maxUpd + 0.01) overDays++; });
    return { res, rows, lines, overDays, daily };
  }

  /* curve dei materiali: quantità per tipo e unità di misura */
  function materialCurves(project, sched, db, filter) {
    const groups = new Map();
    const DD = U.dnOf(project.dataDate);
    (project.activities || []).forEach((a) => {
      const r = sched && sched.acts[a.id]; if (!r) return;
      const cal = calOf(db, project, a);
      (a.costs || []).forEach((l) => {
        if (!l.mat || !l.um) return;
        if (filter && filter.company && l.company !== filter.company) return;
        const k = l.mat + '|' + l.um;
        if (!groups.has(k)) groups.set(k, { mat: l.mat, um: l.um, plan: new Map(), done: new Map(), tot: 0, doneTot: 0 });
        const g = groups.get(k);
        g.tot += Number(l.qty) || 0; g.doneTot += Number(l.qtyDone) || 0;
        const mode = l.dist === 'start' ? 'start' : l.dist === 'end' ? 'end' : null;
        spread(Number(l.qty) || 0, r.es, r.ef, cal, curveW(db, l.dist === 'linear' ? 'uniform' : l.dist), (d, v) => add(g.plan, U.monthKey(d), v), mode);
        if (l.qtyDone && a.as) spread(Number(l.qtyDone), U.dnOf(a.as), a.af ? U.dnOf(a.af) + 1 : DD + 1, cal, CURVES.uniform.w, (d, v) => add(g.done, U.monthKey(d), v));
      });
    });
    return [...groups.values()];
  }

  /* aggregazioni dei costi */
  function aggregate(project, db, sched, evr, dim) {
    const rows = new Map();
    const put = (k, label, f) => { if (!rows.has(k)) rows.set(k, { k, label, bud: 0, act: 0, rem: 0, ev: 0 }); const r = rows.get(k); f(r); };
    const wbsName = new Map((project.wbs || []).map((w) => [w.id, w.code + ' ' + w.name]));
    (project.activities || []).forEach((a) => {
      if (a.type === 'wbs') return;
      const p = evr && evr.per[a.id];
      const pct = p ? p.pct / 100 : 0;
      if (dim === 'wbs') { const c = actCost(a, db); put(a.wbsId, wbsName.get(a.wbsId) || a.wbsId, (r) => { r.bud += c.bud; r.act += c.act; r.rem += c.rem; r.ev += c.bud * pct; }); return; }
      (a.costs || []).forEach((l) => {
        const amt = lineAmount(l); const done = (Number(l.qtyDone) || 0) * (Number(l.unit) || 0);
        const key = dim === 'company' ? l.company || '(senza impresa)' : dim === 'mat' ? (l.mat || '(senza materiale)') : dim === 'cbs' ? (l.cbs || '(senza conto)') : (l.kind || 'Altro');
        put(key, key, (r) => { r.bud += amt; r.act += Number(l.actual) || 0; r.rem += Math.max(0, amt - done); r.ev += amt * pct; });
      });
      if (dim === 'company' || dim === 'cbs' || dim === 'kind') {
        (a.assign || []).forEach((x) => {
          const res = resOf(db, x.resId); if (!res) return; const pr = Number(x.price !== undefined ? x.price : res.price) || 0;
          const key = dim === 'company' ? (res.company || 'Risorse interne') : dim === 'cbs' ? (x.cbs || res.cbs || '(senza conto)') : 'Risorse ' + res.type;
          put(key, key, (r) => { r.bud += (x.bud || 0) * pr; r.act += (x.act || 0) * pr; r.rem += (x.rem || 0) * pr; r.ev += (x.bud || 0) * pr * pct; });
        });
      }
    });
    return [...rows.values()].sort((a, b) => b.bud - a.bud);
  }

  /* controllo anti doppio conteggio: manodopera interna su attività con subappalto comprensivo di manodopera */
  function doubleCount(project, db) {
    const out = [];
    (project.activities || []).forEach((a) => {
      const sub = (a.costs || []).filter((l) => l.withLabor);
      if (!sub.length) return;
      (a.assign || []).forEach((x) => {
        const r = resOf(db, x.resId);
        if (r && r.type === 'Labor' && (Number(x.price !== undefined ? x.price : r.price) || 0) > 0 && (!r.company || sub.some((l) => l.company === r.company))) out.push({ act: a, res: r, lines: sub });
      });
    });
    return out;
  }

  M.Costs = { CURVES, DIST, spread, actCost, actPct, evPct, ev, indices, curves, plannedSpread, pvDaily, earnedSchedule, resourceProfile, materialCurves, aggregate, doubleCount, lineAmount, wbsFilter, curveW };
})(window.M = window.M || {});
