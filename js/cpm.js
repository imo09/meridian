/* Meridian - motore di schedulazione CPM (logica Primavera P6).
   Passaggio in avanti (Early), all'indietro (Late), float, Longest Path, percorsi critici multipli,
   driver di ogni attività (cosa la tiene ferma dov'è), margini sul secondo vincolo (leve), log, controlli DCMA. */
(function (M) {
  'use strict';
  const U = M.U, Cal = M.Cal;

  const CAL24 = { id: '__24h', name: '24 ore', week: [24, 24, 24, 24, 24, 24, 24], hoursDay: 24 };
  const DEFAULT_CAL = { id: '__def', name: '5x8', week: [8, 8, 8, 8, 8, 0, 0], recurring: Cal.italianRecurring };

  const CSTR = {
    SNET: 'Start On or After', FNET: 'Finish On or After', SNLT: 'Start On or Before', FNLT: 'Finish On or Before',
    SO: 'Start On', FO: 'Finish On', MSO: 'Mandatory Start', MFO: 'Mandatory Finish', ALAP: 'As Late As Possible'
  };
  const TYPES = { task: 'Task Dependent', rsrc: 'Resource Dependent', start: 'Start Milestone', finish: 'Finish Milestone', loe: 'Level of Effort', wbs: 'WBS Summary' };
  const isMile = (a) => a.type === 'start' || a.type === 'finish';
  const isAux = (a) => a.type === 'loe' || a.type === 'wbs';
  const statusOf = (a) => (a.af ? 'done' : a.as ? 'active' : 'todo');

  /* LS <= lim: l'ultimo inizio lavorativo non oltre lim, poi la fine corrispondente */
  function startLimToFinish(cal, lim, dur) {
    if (!dur) return lim;
    const s = Cal.isWork(cal, lim) ? lim : Cal.prevWorkEnd(cal, lim) - 1;
    return Cal.add(cal, s, dur);
  }
  function lagText(r) { return r.type + (r.lag ? (r.lag > 0 ? '+' : '') + r.lag : '+0'); }

  function schedule(project, db, opt) {
    opt = Object.assign({ criticalMode: 'LP', tfThreshold: 0, subOn: true, subThreshold: 10, lagCal: 'pred', oos: 'retained' }, opt || {});
    const t0 = Date.now();
    const cals = new Map((db.calendars || []).map((c) => [c.id, c]));
    const projCal = cals.get(project.calId) || (db.calendars && db.calendars[0]) || DEFAULT_CAL;
    const calOf = (a) => cals.get(a.calId) || projCal;
    const acts = project.activities || [];
    const byId = new Map(acts.map((a) => [a.id, a]));
    const rels = (project.rels || []).filter((r) => byId.has(r.pred) && byId.has(r.succ) && r.pred !== r.succ);
    const preds = new Map(), succs = new Map();
    acts.forEach((a) => { preds.set(a.id, []); succs.set(a.id, []); });
    rels.forEach((r) => { preds.get(r.succ).push(r); succs.get(r.pred).push(r); });

    const DD = U.dnOf(project.dataDate);
    const DDp = DD + 1; /* la data date chiude il consuntivo: il rimanente parte dal giorno dopo */
    const PS = U.dnOf(project.plannedStart) || DD;
    const log = [];
    const res = {};
    const lagCalOf = (r) => {
      if (opt.lagCal === '24h') return CAL24;
      if (opt.lagCal === 'succ') return calOf(byId.get(r.succ));
      if (opt.lagCal === 'proj') return projCal;
      return calOf(byId.get(r.pred));
    };
    const addLag = (r, p) => (r.lag ? Cal.add(lagCalOf(r), p, r.lag) : p);
    const subLag = (r, p) => (r.lag ? Cal.sub(lagCalOf(r), p, r.lag) : p);

    /* ordinamento topologico (solo attività che guidano: no LOE, no WBS Summary) */
    const core = acts.filter((a) => !isAux(a));
    const indeg = new Map(core.map((a) => [a.id, 0]));
    rels.forEach((r) => { if (indeg.has(r.pred) && indeg.has(r.succ)) indeg.set(r.succ, indeg.get(r.succ) + 1); });
    const queue = core.filter((a) => indeg.get(a.id) === 0).map((a) => a.id);
    const topo = [];
    while (queue.length) {
      const id = queue.shift();
      topo.push(id);
      succs.get(id).forEach((r) => { if (!indeg.has(r.succ)) return; indeg.set(r.succ, indeg.get(r.succ) - 1); if (indeg.get(r.succ) === 0) queue.push(r.succ); });
    }
    if (topo.length < core.length) {
      const inLoop = core.filter((a) => indeg.get(a.id) > 0);
      inLoop.forEach((a) => log.push({ lvl: 'err', code: 'loop', actId: a.id, text: a.code + ' ' + a.name + ': fa parte di un legame circolare (loop). Il calcolo non è possibile finché non si rompe il ciclo.' }));
      return { ok: false, log, errors: inLoop.length, warnings: 0, acts: {}, ranAt: U.nowStamp(), ms: Date.now() - t0 };
    }

    /* ---------- passaggio in avanti ---------- */
    const PRIO = { rel: 5, Vincolo: 4, Risorsa: 3, 'Data date': 2, 'Inizio progetto': 1 };
    topo.forEach((id) => {
      const a = byId.get(id), cal = calOf(a), st = statusOf(a);
      const r = { id, st, cal: cal.id };
      res[id] = r;
      const dur = isMile(a) ? 0 : Math.max(0, st === 'active' ? (a.rd !== undefined && a.rd !== null ? a.rd : a.od) : a.od || 0);
      r.dur = dur;
      if (st === 'done') {
        r.es = U.dnOf(a.as); r.ef = U.dnOf(a.af) + 1; r.rs = null;
        if (a.type === 'start') r.ef = r.es;
        if (a.type === 'finish') r.es = r.ef;
        r.driverType = 'Data reale'; r.cands = []; return;
      }
      const cands = [];
      if (st === 'active') cands.push({ src: 'Data date', t: DDp, k: 's' });
      else {
        cands.push({ src: 'Inizio progetto', t: PS, k: 's' });
        cands.push({ src: 'Data date', t: DDp, k: 's' });
        const c = a.cstr;
        if (c && c.d) {
          const cd = U.dnOf(c.d);
          if (c.t === 'SNET' || c.t === 'SO') cands.push({ src: 'Vincolo', t: cd, k: 's', label: CSTR[c.t] + ' ' + U.fd(cd) });
          if (c.t === 'FNET' || c.t === 'FO') cands.push({ src: 'Vincolo', t: cd + 1, k: 'f', label: CSTR[c.t] + ' ' + U.fd(cd) });
        }
        if (a.levelStart) cands.push({ src: 'Risorsa', t: U.dnOf(a.levelStart), k: 's', label: 'livellamento risorse' });
      }
      preds.get(id).forEach((rel) => {
        const p = byId.get(rel.pred);
        if (isAux(p)) return;
        if (st === 'active') {
          if (opt.oos === 'override') return;
          if (rel.type === 'SS' || rel.type === 'SF') return;
        }
        const P = res[rel.pred];
        let t, k;
        if (rel.type === 'FS') { t = addLag(rel, P.ef); k = 's'; }
        else if (rel.type === 'SS') { t = addLag(rel, P.es); k = 's'; }
        else if (rel.type === 'FF') { t = addLag(rel, P.ef); k = 'f'; }
        else { t = addLag(rel, P.es); k = 'f'; }
        cands.push({ src: 'rel', relId: rel.id, pred: rel.pred, t, k, label: p.code + ' ' + lagText(rel) });
      });
      /* inizio equivalente agganciato al calendario dell'attività */
      cands.forEach((c) => {
        let s = c.k === 'f' ? (dur ? Cal.sub(cal, c.t, dur) : c.t) : c.t;
        if (dur > 0 || a.type === 'start') s = Cal.nextWork(cal, s);
        c.s = s;
      });
      cands.sort((x, y) => y.s - x.s || PRIO[y.src] - PRIO[x.src]);
      let start = cands[0].s;
      const top = cands.filter((c) => c.s === start);
      let dtype = top[0].src === 'rel' ? 'Legame' : top[0].src;
      if (dtype === 'Legame' && dur > 0) {
        const raw = top[0].k === 'f' ? Cal.sub(cal, top[0].t, dur) : top[0].t;
        if (cal.id !== projCal.id && Cal.nextWork(projCal, raw) < start) dtype = 'Calendario';
      }
      const c = a.cstr;
      if (st !== 'active' && c && c.d && (c.t === 'MSO' || c.t === 'MFO')) {
        const cd = U.dnOf(c.d);
        start = c.t === 'MSO' ? cd : (dur ? Cal.sub(cal, cd + 1, dur) : cd + 1);
        dtype = 'Vincolo';
        top.length = 0; top.push({ src: 'Vincolo', label: CSTR[c.t] + ' ' + U.fd(cd), s: start });
      }
      r.cands = cands.slice(0, 6).map((x) => ({ src: x.src, relId: x.relId, pred: x.pred, label: x.label || x.src, s: x.s }));
      r.driverType = dtype;
      r.driverLabel = top.map((x) => x.label || x.src).join(', ');
      const second = cands.find((x) => x.s < start);
      r.margin = second ? { days: Cal.between(cal, second.s, start), by: second.label || second.src, src: second.src, pred: second.pred } : null;
      if (st === 'active') { r.es = U.dnOf(a.as); r.rs = start; r.ef = dur ? Cal.add(cal, start, dur) : start; }
      else { r.es = start; r.rs = start; r.ef = dur ? Cal.add(cal, start, dur) : start; }
    });

    let projEF = PS;
    topo.forEach((id) => { if (res[id].ef > projEF) projEF = res[id].ef; });
    const MF = U.dnOf(project.mustFinish);
    const projLF = MF ? MF + 1 : projEF;

    /* ---------- passaggio all'indietro ---------- */
    for (let i = topo.length - 1; i >= 0; i--) {
      const id = topo[i], a = byId.get(id), r = res[id], cal = calOf(a);
      if (r.st === 'done') { r.ls = r.es; r.lf = r.ef; r.tf = null; continue; }
      const lims = [];
      const ss = succs.get(id).filter((rel) => !isAux(byId.get(rel.succ)) && res[rel.succ].st !== 'done');
      if (!ss.length) lims.push(projLF);
      ss.forEach((rel) => {
        const S = res[rel.succ];
        if (S.st === 'active' && (rel.type === 'SS' || rel.type === 'SF')) return;
        const sLS = S.lrs;
        let lim, k;
        if (rel.type === 'FS') { lim = subLag(rel, sLS); k = 'f'; }
        else if (rel.type === 'SS') { lim = subLag(rel, sLS); k = 's'; }
        else if (rel.type === 'FF') { lim = subLag(rel, S.lf); k = 'f'; }
        else { lim = subLag(rel, S.lf); k = 's'; }
        lims.push(k === 's' ? startLimToFinish(cal, lim, r.dur) : lim);
      });
      if (!lims.length) lims.push(projLF);
      const c = a.cstr;
      if (r.st !== 'active' && c && c.d) {
        const cd = U.dnOf(c.d);
        if (c.t === 'SNLT' || c.t === 'SO') lims.push(startLimToFinish(cal, cd, r.dur));
        if (c.t === 'FNLT' || c.t === 'FO') lims.push(cd + 1);
      }
      let lf = Math.min.apply(null, lims);
      if (r.st !== 'active' && c && c.d && (c.t === 'MSO' || c.t === 'MFO')) {
        const cd = U.dnOf(c.d);
        lf = c.t === 'MFO' ? cd + 1 : startLimToFinish(cal, cd, r.dur);
      }
      if (r.dur > 0) lf = Cal.prevWorkEnd(cal, lf);
      r.lf = lf;
      r.lrs = r.dur ? Cal.sub(cal, lf, r.dur) : lf;
      r.ls = r.st === 'active' ? r.es : r.lrs;
      r.tf = Cal.between(cal, r.ef, r.lf);
    }

    /* ---------- float dei legami, driver, free float ---------- */
    const relRes = {};
    rels.forEach((rel) => {
      const p = byId.get(rel.pred), s = byId.get(rel.succ);
      if (isAux(p) || isAux(s)) return;
      const P = res[rel.pred], S = res[rel.succ];
      const scal = calOf(s);
      let rf = null;
      if (S.st !== 'done') {
        if (rel.type === 'FS') rf = Cal.between(scal, addLag(rel, P.ef), S.rs);
        else if (rel.type === 'SS') rf = S.st === 'active' ? null : Cal.between(scal, addLag(rel, P.es), S.es);
        else if (rel.type === 'FF') rf = Cal.between(scal, addLag(rel, P.ef), S.ef);
        else rf = Cal.between(scal, addLag(rel, P.es), S.ef);
        if (S.st === 'active' && opt.oos === 'override') rf = null;
      }
      relRes[rel.id] = { rf, driving: rf !== null && rf <= 0 };
    });
    topo.forEach((id) => {
      const r = res[id];
      const drv = preds.get(id).filter((rel) => relRes[rel.id] && relRes[rel.id].driving);
      r.drivers = drv.map((rel) => rel.id);
      r.driverPreds = drv.map((rel) => rel.pred);
      const own = succs.get(id).filter((rel) => relRes[rel.id] && relRes[rel.id].rf !== null);
      r.drivenCount = own.filter((rel) => relRes[rel.id].driving).length;
      if (r.st === 'done') { r.ff = null; return; }
      r.ff = own.length ? Math.min.apply(null, own.map((rel) => relRes[rel.id].rf)) : Cal.between(calOf(byId.get(id)), r.ef, projEF);
    });

    /* ALAP: sposta in avanti entro il free float */
    topo.forEach((id) => {
      const a = byId.get(id), r = res[id];
      if (a.cstr && a.cstr.t === 'ALAP' && r.st === 'todo' && r.ff > 0) {
        const cal = calOf(a);
        r.es = Cal.add(cal, r.es, r.ff); r.rs = r.es; r.ef = r.dur ? Cal.add(cal, r.es, r.dur) : r.es; r.ff = 0;
        r.driverType = 'Vincolo'; r.driverLabel = 'As Late As Possible';
      }
    });

    /* ---------- float verso la fine (percorso più lungo) ---------- */
    for (let i = topo.length - 1; i >= 0; i--) {
      const id = topo[i], r = res[id];
      if (r.st === 'done') { r.dist = null; continue; }
      const ss = succs.get(id).filter((rel) => relRes[rel.id] && relRes[rel.id].rf !== null && res[rel.succ].dist !== null && res[rel.succ].dist !== undefined);
      if (!ss.length) r.dist = Cal.between(calOf(byId.get(id)), r.ef, projEF);
      else r.dist = Math.min.apply(null, ss.map((rel) => relRes[rel.id].rf + res[rel.succ].dist));
    }

    /* ---------- LOE e WBS Summary ---------- */
    acts.filter((a) => a.type === 'loe').forEach((a) => {
      const cal = calOf(a), st = statusOf(a);
      const r = { id: a.id, st, cal: cal.id, loe: true, cands: [] };
      res[a.id] = r;
      let es = null, ef = null;
      preds.get(a.id).forEach((rel) => { const P = res[rel.pred]; if (!P || P.es === undefined) return; const t = rel.type === 'FS' ? addLag(rel, P.ef) : addLag(rel, P.es); es = es === null ? t : Math.min(es, t); });
      succs.get(a.id).forEach((rel) => { const S = res[rel.succ]; if (!S || S.ef === undefined || rel.type === 'SS' || rel.type === 'SF') return; const t = rel.type === 'FS' ? subLag(rel, S.rs !== null && S.rs !== undefined ? S.rs : S.es) : subLag(rel, S.ef); ef = ef === null ? t : Math.max(ef, t); });
      if (es === null) es = PS;
      if (ef === null) ef = projEF;
      es = Cal.nextWork(cal, es);
      if (a.as) es = U.dnOf(a.as);
      if (a.af) ef = U.dnOf(a.af) + 1;
      else { ef = Math.max(ef, st === 'active' ? Cal.add(cal, DDp, 1) : Cal.add(cal, es, 1)); ef = Cal.prevWorkEnd(cal, ef); }
      r.es = es; r.ef = ef; r.ls = es; r.lf = ef; r.rs = st === 'active' ? Cal.nextWork(cal, DDp) : es;
      r.dur = Cal.between(cal, st === 'active' ? r.rs : es, ef);
      r.odCalc = Cal.between(cal, es, ef);
      r.tf = null; r.ff = null; r.dist = null; r.drivers = []; r.driverPreds = []; r.drivenCount = 0;
      r.driverType = st === 'done' ? 'Data reale' : 'Legame'; r.driverLabel = 'durata dai legami (LOE)';
    });
    const wbsChildren = new Map();
    (project.wbs || []).forEach((w) => { if (w.parent) { if (!wbsChildren.has(w.parent)) wbsChildren.set(w.parent, []); wbsChildren.get(w.parent).push(w.id); } });
    const subtree = (wid) => { const out = [wid]; for (let i = 0; i < out.length; i++) (wbsChildren.get(out[i]) || []).forEach((c) => out.push(c)); return new Set(out); };
    acts.filter((a) => a.type === 'wbs').forEach((a) => {
      const set = subtree(a.wbsId);
      const inside = acts.filter((x) => x.id !== a.id && x.type !== 'wbs' && set.has(x.wbsId) && res[x.id]);
      const r = { id: a.id, st: statusOf(a), cal: calOf(a).id, cands: [], drivers: [], driverPreds: [], drivenCount: 0, tf: null, ff: null, dist: null };
      if (inside.length) { r.es = Math.min.apply(null, inside.map((x) => res[x.id].es)); r.ef = Math.max.apply(null, inside.map((x) => res[x.id].ef)); }
      else { r.es = PS; r.ef = PS; }
      r.ls = r.es; r.lf = r.ef; r.rs = r.es; r.dur = Cal.between(calOf(a), r.es, r.ef); r.driverType = 'Legame'; r.driverLabel = 'date dal nodo WBS';
      res[a.id] = r;
    });

    /* ---------- criticità e percorsi ---------- */
    const critical = new Set();
    topo.forEach((id) => {
      const r = res[id];
      if (r.st === 'done') { r.crit = false; return; }
      r.crit = opt.criticalMode === 'TF' ? r.tf <= opt.tfThreshold : r.dist <= 0;
      r.near = opt.criticalMode === 'TF' ? r.tf - opt.tfThreshold : r.dist;
      if (r.crit) critical.add(id);
    });
    topo.forEach((id) => { const r = res[id]; r.sub = !!(opt.subOn && !r.crit && r.st !== 'done' && r.near !== null && r.near <= opt.subThreshold); });
    const ends = new Set([...critical].filter((id) => !succs.get(id).some((rel) => critical.has(rel.succ))));
    const comp = new Map();
    const paths = [];
    [...critical].filter((id) => !ends.has(id)).forEach((id) => {
      if (comp.has(id)) return;
      const k = paths.length;
      const members = [];
      const stack = [id];
      comp.set(id, k);
      while (stack.length) {
        const x = stack.pop();
        members.push(x);
        preds.get(x).concat(succs.get(x)).forEach((rel) => {
          const y = rel.pred === x ? rel.succ : rel.pred;
          if (critical.has(y) && !ends.has(y) && !comp.has(y)) { comp.set(y, k); stack.push(y); }
        });
      }
      paths.push({ members });
    });
    ends.forEach((id) => {
      const into = new Set();
      preds.get(id).forEach((rel) => { if (comp.has(rel.pred)) into.add(comp.get(rel.pred)); });
      if (!into.size) { const k = paths.length; paths.push({ members: [id] }); comp.set(id, k); res[id].paths = [k]; }
      else { into.forEach((k) => paths[k].members.push(id)); res[id].paths = [...into]; }
    });
    paths.forEach((p) => {
      const rs = p.members.map((id) => res[id]);
      p.start = Math.min.apply(null, rs.map((r) => (r.rs !== null && r.rs !== undefined ? r.rs : r.es)));
      p.finish = Math.max.apply(null, rs.map((r) => r.ef));
      p.length = Cal.between(projCal, p.start, p.finish);
      p.float = Math.min.apply(null, rs.map((r) => r.tf));
      p.count = p.members.length;
      p.members.sort((x, y) => res[x].es - res[y].es || res[x].ef - res[y].ef);
    });
    const order = paths.map((p, i) => i).sort((x, y) => paths[x].float - paths[y].float || paths[y].length - paths[x].length || paths[y].count - paths[x].count);
    const remap = new Map(order.map((old, i) => [old, i + 1]));
    const sorted = order.map((i) => paths[i]);
    sorted.forEach((p, i) => { p.n = i + 1; });
    critical.forEach((id) => {
      const r = res[id];
      if (r.paths) { r.paths = r.paths.map((k) => remap.get(k)).sort((a, b) => a - b); r.path = r.paths[0]; }
      else { r.path = remap.get(comp.get(id)); r.paths = [r.path]; }
    });

    /* ---------- testi per il tooltip del driver ---------- */
    topo.forEach((id) => {
      const a = byId.get(id), r = res[id];
      r.why = whyText(a, r, byId, rels, relRes, DD, res);
    });

    /* ---------- log ---------- */
    const firstMile = acts.filter((a) => a.type === 'start').map((a) => a.id);
    const lastMile = acts.filter((a) => a.type === 'finish').map((a) => a.id);
    acts.forEach((a) => {
      if (a.type === 'wbs') return;
      const np = preds.get(a.id).length, ns = succs.get(a.id).length;
      if (!np && !firstMile.includes(a.id) && statusOf(a) !== 'done') log.push({ lvl: 'warn', code: 'nopred', actId: a.id, text: a.code + ' ' + a.name + ': nessun predecessore (open start).', fix: 'link' });
      if (!ns && !lastMile.includes(a.id)) log.push({ lvl: 'warn', code: 'nosucc', actId: a.id, text: a.code + ' ' + a.name + ': nessun successore (open end). La fine non è legata alla consegna.', fix: 'link' });
      if (a.cstr && a.cstr.t && statusOf(a) !== 'done') log.push({ lvl: 'warn', code: 'cstr', actId: a.id, text: a.code + ' ' + a.name + ': vincolo ' + CSTR[a.cstr.t] + (a.cstr.d ? ' ' + U.fd(a.cstr.d) : '') + (a.cstrNote ? ' (' + a.cstrNote + ')' : '') + '.', fix: 'open' });
      if (a.as && U.dnOf(a.as) > DD) log.push({ lvl: 'warn', code: 'actdd', actId: a.id, text: a.code + ' ' + a.name + ': inizio reale ' + U.fd(a.as) + ' dopo la data date ' + U.fd(DD) + '.', fix: 'open' });
      if (a.af && U.dnOf(a.af) > DD) log.push({ lvl: 'warn', code: 'actdd', actId: a.id, text: a.code + ' ' + a.name + ': fine reale ' + U.fd(a.af) + ' dopo la data date ' + U.fd(DD) + '.', fix: 'open' });
    });
    rels.forEach((rel) => {
      const p = byId.get(rel.pred), s = byId.get(rel.succ);
      if (!s.as) return;
      const sas = U.dnOf(s.as);
      const pfin = p.af ? U.dnOf(p.af) + (p.type === 'start' ? 0 : 1) : Infinity;
      if (rel.type === 'FS' && pfin > sas) log.push({ lvl: 'warn', code: 'oos', actId: s.id, text: s.code + ' ' + s.name + ': fuori sequenza, iniziata prima della fine di ' + p.code + ' (' + (opt.oos === 'override' ? 'Progress Override' : 'Retained Logic') + ').', fix: 'open' });
      if (rel.type === 'SS' && (!p.as || U.dnOf(p.as) > sas)) log.push({ lvl: 'warn', code: 'oos', actId: s.id, text: s.code + ' ' + s.name + ': fuori sequenza, iniziata prima di ' + p.code + '.', fix: 'open' });
    });
    const neg = topo.filter((id) => res[id].tf !== null && res[id].tf < 0);
    if (MF && projEF > projLF) log.push({ lvl: 'warn', code: 'late', text: 'Fine calcolata ' + U.fd(projEF - 1) + ' oltre Must finish by ' + U.fd(MF) + ': total float ' + Math.min.apply(null, neg.map((id) => res[id].tf)) + ' g su ' + neg.length + ' attività.', fix: 'variance' });
    const warnings = log.filter((l) => l.lvl === 'warn').length;
    log.push({ lvl: 'info', code: 'res', text: 'Fine calcolata del progetto: ' + U.fd(projEF - 1) + '. Attività: ' + acts.length + ', legami: ' + rels.length + ', percorsi critici: ' + sorted.length + '.' });

    return {
      ok: true, acts: res, rels: relRes, log, errors: 0, warnings,
      start: Math.min.apply(null, topo.map((id) => res[id].es).concat([PS])), finish: projEF, finishDay: projEF - 1, lfProject: projLF,
      dd: DD, paths: sorted.map((p) => ({ n: p.n, members: p.members, length: p.length, float: p.float, count: p.count, start: p.start, finish: p.finish })),
      critCount: critical.size, subCount: topo.filter((id) => res[id].sub).length,
      opt: { criticalMode: opt.criticalMode, tfThreshold: opt.tfThreshold, subThreshold: opt.subThreshold, subOn: opt.subOn, lagCal: opt.lagCal, oos: opt.oos },
      ranAt: U.nowStamp(), ms: Date.now() - t0
    };
  }

  function whyText(a, r, byId, rels, relRes, DD, res) {
    const verbo = a.type === 'finish' ? 'Finisce il ' + U.fd(r.ef - 1) : r.st === 'active' ? 'Il rimanente riparte il ' + U.fd(r.rs) : 'Inizia il ' + U.fd(r.es);
    if (r.st === 'done') return 'Conclusa: date reali ' + U.fd(a.as) + ' - ' + U.fd(a.af) + '.';
    if (r.driverType === 'Legame' || r.driverType === 'Calendario') {
      const parts = r.drivers.map((rid) => {
        const rel = rels.find((x) => x.id === rid); if (!rel) return '';
        const p = byId.get(rel.pred);
        const P = res[rel.pred];
        const ev = rel.type === 'FS' || rel.type === 'FF' ? 'finisce il ' + U.fd(P.ef - 1) : 'inizia il ' + U.fd(P.es);
        return p.code + ' ' + ev + ', ' + lagText(rel);
      }).filter(Boolean);
      let t = verbo + ' perché ' + (parts.join('; e ') || r.driverLabel);
      if (r.driverType === 'Calendario') t += '; il calendario dell\'attività sposta l\'inizio al primo giorno lavorativo';
      return t + '.';
    }
    if (r.driverType === 'Vincolo') return verbo + ' per il vincolo ' + r.driverLabel + '.';
    if (r.driverType === 'Data date') return verbo + ' perché il lavoro rimanente non può partire prima della data date ' + U.fd(DD) + '.';
    if (r.driverType === 'Risorsa') return verbo + ' per il livellamento delle risorse.';
    return verbo + ' dall\'inizio pianificato del progetto.';
  }

  /* Traccia: catena all'indietro (cosa la spinge) e in avanti (cosa spinge) */
  function trace(project, sched, actId, o) {
    o = Object.assign({ depth: 6, near: 0, toward: null }, o || {});
    const preds = new Map(), succs = new Map();
    (project.rels || []).forEach((r) => {
      if (!preds.has(r.succ)) preds.set(r.succ, []); preds.get(r.succ).push(r);
      if (!succs.has(r.pred)) succs.set(r.pred, []); succs.get(r.pred).push(r);
    });
    const lv = new Map([[actId, 0]]);
    const via = new Map();
    const ok = (rel) => { const rr = sched.rels[rel.id]; return rr && rr.rf !== null && rr.rf <= o.near; };
    let front = [actId];
    for (let d = 1; d <= o.depth && front.length; d++) {
      const nx = [];
      front.forEach((id) => (preds.get(id) || []).forEach((rel) => {
        if (!ok(rel) || lv.has(rel.pred)) return;
        lv.set(rel.pred, -d); via.set(rel.pred, rel); nx.push(rel.pred);
      }));
      front = nx;
    }
    let reach = null;
    if (o.toward) {
      reach = new Set([o.toward]);
      const st = [o.toward];
      while (st.length) { const x = st.pop(); (preds.get(x) || []).forEach((rel) => { if (!reach.has(rel.pred)) { reach.add(rel.pred); st.push(rel.pred); } }); }
    }
    front = [actId];
    for (let d = 1; d <= o.depth && front.length; d++) {
      const nx = [];
      front.forEach((id) => (succs.get(id) || []).forEach((rel) => {
        if (!ok(rel) || lv.has(rel.succ)) return;
        if (reach && !reach.has(rel.succ)) return;
        lv.set(rel.succ, d); via.set(rel.succ, rel); nx.push(rel.succ);
      }));
      front = nx;
    }
    return { levels: lv, via };
  }

  /* Controlli di qualità sul modello DCMA a 14 punti */
  function quality(project, sched, blSched, db, th) {
    th = Object.assign({ logic: 5, leads: 0, lags: 5, fs: 90, hard: 5, highFloat: 44, highFloatPct: 5, negFloat: 0, highDur: 44, highDurPct: 5, invalid: 0, resources: 5, missed: 5, cpli: 0.95, bei: 0.95 }, th || {});
    const acts = (project.activities || []).filter((a) => a.type !== 'wbs');
    const open = acts.filter((a) => !a.af && a.type !== 'loe');
    const rels = project.rels || [];
    const S = sched.acts || {};
    const pct = (n, d) => (d ? (n / d) * 100 : 0);
    const out = [];
    const first = new Set(acts.filter((a) => a.type === 'start').map((a) => a.id));
    const last = new Set(acts.filter((a) => a.type === 'finish').map((a) => a.id));
    const missing = open.filter((a) => (!rels.some((r) => r.succ === a.id) && !first.has(a.id)) || (!rels.some((r) => r.pred === a.id) && !last.has(a.id)));
    out.push({ id: 'logic', name: 'Logica mancante', what: 'Attività senza predecessore o successore', th: '≤ ' + U.num(th.logic) + '%', val: U.pct(pct(missing.length, open.length)) + ' (' + missing.length + ')', ok: pct(missing.length, open.length) <= th.logic, acts: missing.map((a) => a.id) });
    const leads = rels.filter((r) => r.lag < 0);
    out.push({ id: 'leads', name: 'Lead', what: 'Legami con lag negativo', th: String(th.leads), val: String(leads.length), ok: leads.length <= th.leads });
    const lags = rels.filter((r) => r.lag > 0);
    out.push({ id: 'lags', name: 'Lag', what: 'Legami con lag positivo', th: '≤ ' + U.num(th.lags) + '%', val: U.pct(pct(lags.length, rels.length)), ok: pct(lags.length, rels.length) <= th.lags });
    const fs = rels.filter((r) => r.type === 'FS');
    out.push({ id: 'fs', name: 'Tipo di legame', what: 'Quota di legami FS', th: '≥ ' + U.num(th.fs) + '%', val: U.pct(pct(fs.length, rels.length)), ok: rels.length === 0 || pct(fs.length, rels.length) >= th.fs });
    const hard = open.filter((a) => a.cstr && ['MSO', 'MFO', 'SO', 'FO', 'SNLT', 'FNLT'].includes(a.cstr.t));
    out.push({ id: 'hard', name: 'Vincoli rigidi', what: 'Mandatory, Start On, Finish On, On or Before', th: '≤ ' + U.num(th.hard) + '%', val: U.pct(pct(hard.length, open.length)), ok: pct(hard.length, open.length) <= th.hard, acts: hard.map((a) => a.id) });
    const hf = open.filter((a) => S[a.id] && S[a.id].tf > th.highFloat);
    out.push({ id: 'hfloat', name: 'Float elevato', what: 'Total float oltre ' + th.highFloat + ' g', th: '≤ ' + U.num(th.highFloatPct) + '%', val: U.pct(pct(hf.length, open.length)), ok: pct(hf.length, open.length) <= th.highFloatPct, acts: hf.map((a) => a.id) });
    const nf = open.filter((a) => S[a.id] && S[a.id].tf < 0);
    out.push({ id: 'nfloat', name: 'Float negativo', what: 'Attività con total float sotto zero', th: String(th.negFloat), val: String(nf.length), ok: nf.length <= th.negFloat, acts: nf.map((a) => a.id) });
    const hd = open.filter((a) => !isMile(a) && (a.od || 0) > th.highDur);
    out.push({ id: 'hdur', name: 'Durate elevate', what: 'Durata originale oltre ' + th.highDur + ' g', th: '≤ ' + U.num(th.highDurPct) + '%', val: U.pct(pct(hd.length, open.length)) + ' (' + hd.length + ')', ok: pct(hd.length, open.length) <= th.highDurPct, acts: hd.map((a) => a.id) });
    const DD = U.dnOf(project.dataDate);
    const inv = acts.filter((a) => (a.as && U.dnOf(a.as) > DD) || (a.af && U.dnOf(a.af) > DD) || (!a.af && S[a.id] && S[a.id].ef !== undefined && S[a.id].st !== 'done' && S[a.id].ef - 1 < DD && S[a.id].dur > 0));
    out.push({ id: 'invalid', name: 'Date non valide', what: 'Date reali dopo la data date o previste prima', th: String(th.invalid), val: String(inv.length), ok: inv.length <= th.invalid, acts: inv.map((a) => a.id) });
    const nores = open.filter((a) => !isMile(a) && a.type !== 'loe' && !(a.assign && a.assign.length) && !(a.costs && a.costs.length));
    out.push({ id: 'res', name: 'Risorse e costi', what: 'Attività con durata senza risorse né costi', th: '≤ ' + U.num(th.resources) + '%', val: U.pct(pct(nores.length, open.length)), ok: pct(nores.length, open.length) <= th.resources, acts: nores.map((a) => a.id) });
    if (blSched && blSched.acts) {
      const due = acts.filter((a) => { const b = blSched.acts[a.blId || a.id]; return b && b.ef !== undefined && b.ef - 1 <= DD && a.type !== 'loe'; });
      const missed = due.filter((a) => !a.af);
      out.push({ id: 'missed', name: 'Attività mancate', what: 'Previste finite in baseline, non finite', th: '≤ ' + U.num(th.missed) + '%', val: U.pct(pct(missed.length, due.length)) + ' (' + missed.length + ')', ok: pct(missed.length, due.length) <= th.missed, acts: missed.map((a) => a.id) });
      const done = acts.filter((a) => a.af && a.type !== 'loe').length;
      const bei = due.length ? done / due.length : 1;
      out.push({ id: 'bei', name: 'BEI', what: 'Concluse / previste concluse in baseline', th: '≥ ' + U.num(th.bei), val: U.num(bei), ok: bei >= th.bei });
    }
    /* Critical path test: si allunga di 600 g la prima critica e si verifica che la fine si sposti di altrettanto */
    const cand = open.find((a) => S[a.id] && S[a.id].crit && !isMile(a) && a.type !== 'loe');
    if (cand) {
      const copy = U.clone(project);
      const ca = copy.activities.find((x) => x.id === cand.id);
      if (ca.as) ca.rd = (ca.rd || 0) + 600; else ca.od = (ca.od || 0) + 600;
      const r2 = schedule(copy, db, sched.opt);
      const cal = (db.calendars || []).find((c) => c.id === (cand.calId || project.calId)) || DEFAULT_CAL;
      const delta = r2.ok ? Cal.between(cal, sched.finish, r2.finish) : null;
      out.push({ id: 'cpt', name: 'Critical Path Test', what: '+600 g su ' + cand.code + ': la fine deve slittare di 600 g', th: '600 g', val: delta === null ? 'errore' : delta + ' g', ok: delta === 600 });
    }
    const crit = (sched.paths && sched.paths[0]) || null;
    if (crit) {
      const cpl = crit.length || 1;
      const cpli = (cpl + crit.float) / cpl;
      out.push({ id: 'cpli', name: 'CPLI', what: '(lunghezza percorso critico + float) / lunghezza', th: '≥ ' + U.num(th.cpli), val: U.num(cpli), ok: cpli >= th.cpli });
    }
    return out;
  }

  M.CPM = {
    schedule,
    trace, quality, CSTR, TYPES, isMile, isAux, statusOf, lagText, DEFAULT_CAL, CAL24
  };
})(window.M = window.M || {});
