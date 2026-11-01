/* Meridian - 07 Baseline ed Earned Value: baseline, indici spiegati, curve, andamento, confronti, scostamenti, issue, rischi, soglie */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;
  const ROLES = [['project', 'Project'], ['primary', 'Primary'], ['secondary', 'Secondary'], ['tertiary', 'Tertiary']];
  const EVK = ['BAC', 'PV', 'EV', 'AC', 'SV', 'SPI', 'CV', 'CPI', 'EAC', 'ETC', 'VAC', 'TCPI'];

  function evFor(ctx, wbs) { return wbs ? M.Costs.ev(ctx.p, ctx.s, ctx.bl, ctx.bls, S.db, { technique: S.S().evTechnique, eac: S.S().eacMethod, wbs }) : ctx.ev; }
  const fmtEV = (k, v) => (v === null || v === undefined ? '-' : ['SPI', 'CPI', 'TCPI'].includes(k) ? U.num(v) : U.keur(v));

  function matrix(e) {
    const ci = e.CPI === null ? 1 : e.CPI > 1.005 ? 0 : e.CPI >= 0.995 ? 1 : 2;
    const si = e.SPI === null ? 1 : e.SPI > 1.005 ? 0 : e.SPI >= 0.995 ? 1 : 2;
    const H = ['SPI &gt; 1', 'SPI = 1', 'SPI &lt; 1'], R = ['CPI &gt; 1', 'CPI = 1', 'CPI &lt; 1'];
    const T = [['anticipo, sotto budget', 'nei tempi, sotto budget', 'ritardo, sotto budget'], ['anticipo, nel budget', 'nei tempi, nel budget', 'ritardo, nel budget'], ['anticipo, sopra budget', 'nei tempi, sopra budget', 'ritardo, sopra budget']];
    const C = [['ok', 'ok', 'warn'], ['ok', 'ok', 'warn'], ['warn', 'warn', 'bad']];
    let h = '<div class="mx" role="table" aria-label="Matrice tempi e costi"><div role="row" class="mxr"><span role="columnheader"></span>' + H.map((x) => '<span role="columnheader" class="mxh">' + x + '</span>').join('') + '</div>';
    R.forEach((r, i) => { h += '<div role="row" class="mxr"><span role="rowheader" class="mxh">' + r + '</span>' + T[i].map((t, j) => '<span role="cell" class="mxc ' + C[i][j] + (i === ci && j === si ? ' cur' : '') + '">' + t + (i === ci && j === si ? '<b> - siamo qui</b>' : '') + '</span>').join('') + '</div>'; });
    return h + '</div>';
  }

  function compareTable(ctx) {
    const A = S.proj(S.ui.ctrlA) || ctx.bl || ctx.p, B = S.ui.ctrlB === ctx.p.id || !S.proj(S.ui.ctrlB) ? ctx.p : S.proj(S.ui.ctrlB);
    const ca = VH.ctx(A), cb = VH.ctx(B.id === ctx.p.id ? ctx.p : B);
    const wf = M.Costs.wbsFilter(ctx.p, S.ui.ctrlWbs || null);
    const rows = [];
    const ids = new Set(A.activities.map((a) => a.id).concat(B.activities.map((a) => a.id)));
    let sum = { db: 0, dev: 0 };
    ids.forEach((id) => {
      const a = A.activities.find((x) => x.id === id), b = cb.p.activities.find((x) => x.id === id);
      const ref = b || a; if (!wf(ref)) return;
      if (!a || !b) { rows.push('<tr><td class="mono">' + esc(ref.code) + '</td><td>' + esc(ref.name) + '</td><td colspan="9" class="muted">' + (a ? 'solo in A' : 'solo in B') + '</td></tr>'); return; }
      const da = VH.dates(ca, a), dbb = VH.dates(cb, b);
      const sv = da.start !== null && dbb.start !== null ? M.Cal.between(ctx.pcal, dbb.start, da.start) : null;
      const fv = da.finish !== null && dbb.finish !== null ? M.Cal.between(ctx.pcal, dbb.finish + 1, da.finish + 1) : null;
      const ra = ca.s.acts[id] || {}, rb = cb.s.acts[id] || {};
      const ea = ca.ev.per[id] || {}, eb = cb.ev.per[id] || {};
      const dBud = (eb.bud || 0) - (ea.bud || 0), dEv = (eb.ev || 0) - (ea.ev || 0);
      sum.db += dBud; sum.dev += dEv;
      if (!sv && !fv && !dBud && !dEv && ra.tf === rb.tf && (a.od || 0) === (b.od || 0) && !S.ui.ctrlAll) return;
      rows.push('<tr><td class="mono">' + esc(b.code) + '</td><td>' + esc(b.name) + '</td><td>' + U.fd(da.start) + '</td><td>' + U.fd(dbb.start) + '</td><td class="n ' + UI.dayCls(sv) + '">' + (sv === null ? '' : U.signed(sv) + ' g') + '</td><td>' + U.fd(da.finish) + '</td><td>' + U.fd(dbb.finish) + '</td><td class="n ' + UI.dayCls(fv) + '">' + (fv === null ? '' : U.signed(fv) + ' g') + '</td><td class="n">' + (ra.tf === null || ra.tf === undefined ? '' : ra.tf) + ' → ' + (rb.tf === null || rb.tf === undefined ? '' : rb.tf) + '</td><td class="n">' + (dBud ? U.num(dBud) : '') + '</td><td class="n">' + (dEv ? U.num(dEv) : '') + '</td></tr>');
    });
    const fa = ca.s.finishDay, fb = cb.s.finishDay;
    const opts = S.projects((x) => x.work === ctx.p.work).map((x) => [x.id, x.code + ' (' + x.status + ')']);
    return '<div class="tool"><label class="lbl">A ' + UI.sel('ctrlA', opts, A.id) + '</label><label class="lbl">B ' + UI.sel('ctrlB', opts, B.id) + '</label><label class="lbl">WBS ' + UI.sel('ctrlWbs', [['', 'Tutta']].concat((ctx.p.wbs || []).map((w) => [w.id, VH.wbsPath(ctx, w.id) + ' ' + w.name])), S.ui.ctrlWbs || '') + '</label><label class="sw"><input type="checkbox" data-c="ctrlAll"' + (S.ui.ctrlAll ? ' checked' : '') + '> Anche le righe senza differenze</label><span class="sp"></span><button type="button" class="btn sm" data-a="ctrlExport">' + UI.ic('down', 16) + 'Excel</button></div>' +
      '<div class="kpis sm"><div class="kpi"><p class="ey">Fine A</p><div class="v">' + U.fd(fa) + '</div><p>' + esc(A.code) + '</p></div><div class="kpi"><p class="ey">Fine B</p><div class="v">' + U.fd(fb) + '</div><p>' + esc(B.code) + '</p></div><div class="kpi"><p class="ey">Scostamento fine (A - B)</p><div class="v ' + UI.dayCls(M.Cal.between(ctx.pcal, cb.s.finish, ca.s.finish)) + '">' + U.signed(M.Cal.between(ctx.pcal, cb.s.finish, ca.s.finish)) + ' g</div></div><div class="kpi"><p class="ey">Delta budget (B - A)</p><div class="v">' + U.keur(sum.db) + '</div></div><div class="kpi"><p class="ey">Delta EV (B - A)</p><div class="v">' + U.keur(sum.dev) + '</div></div></div>' +
      UI.table(['ID', 'Attività', 'Inizio A', 'Inizio B', { t: 'Var. inizio', n: 1 }, 'Fine A', 'Fine B', { t: 'Var. fine', n: 1 }, { t: 'TF A → B', n: 1 }, { t: 'Delta budget', n: 1 }, { t: 'Delta EV', n: 1 }], rows, { empty: 'Nessuna differenza', cls: 'compact' }) + '<p class="help">Variazioni in giorni lavorativi come A - B: negativo significa che B è più tardi di A.</p>';
  }

  function periodTable(ctx) {
    const h = (ctx.p.periodHistory || []).slice().sort((a, b) => (a.end < b.end ? -1 : 1));
    const cur = { periodId: 'cur', end: ctx.p.dataDate, pv: ctx.ev.PV, ev: ctx.ev.EV, ac: ctx.ev.AC, current: true };
    const all = h.concat(h.some((x) => x.end === ctx.p.dataDate) ? [] : [cur]);
    let prev = null;
    const rows = all.map((x) => { const spi = x.pv ? x.ev / x.pv : null, cpi = x.ac ? x.ev / x.ac : null; const dev = prev ? x.ev - prev.ev : x.ev, dac = prev ? x.ac - prev.ac : x.ac, dpv = prev ? x.pv - prev.pv : x.pv; const pspi = dpv ? dev / dpv : null, pcpi = dac ? dev / dac : null; prev = x; const per = (S.db.periods || []).find((f) => f.id === x.periodId); return '<tr class="' + (x.current ? 'sel' : '') + '"><td>' + esc(per ? per.name : 'Corrente ' + U.fd(x.end)) + (x.current ? ' ' + UI.chip('non storicizzato', 'warn') : '') + '</td><td class="n">' + U.keur(x.pv) + '</td><td class="n">' + U.keur(x.ev) + '</td><td class="n">' + U.keur(x.ac) + '</td><td class="n ' + (spi < 0.9 ? 'neg' : '') + '">' + U.num(spi) + '</td><td class="n ' + (cpi < 0.9 ? 'neg' : '') + '">' + U.num(cpi) + '</td><td class="n">' + U.keur(dev) + '</td><td class="n">' + U.keur(dac) + '</td><td class="n ' + (pspi !== null && pspi < 0.9 ? 'neg' : '') + '">' + (pspi === null ? '' : U.num(pspi)) + '</td><td class="n ' + (pcpi !== null && pcpi < 0.9 ? 'neg' : '') + '">' + (pcpi === null ? '' : U.num(pcpi)) + '</td></tr>'; });
    return UI.table(['Periodo', { t: 'PV cum.', n: 1 }, { t: 'EV cum.', n: 1 }, { t: 'AC cum.', n: 1 }, { t: 'SPI cum.', n: 1 }, { t: 'CPI cum.', n: 1 }, { t: 'EV del periodo', n: 1 }, { t: 'AC del periodo', n: 1 }, { t: 'SPI del periodo', n: 1 }, { t: 'CPI del periodo', n: 1 }], rows, { cls: 'compact' }) + '<p class="help">Confronto periodo contro periodo dai valori storicizzati (Storicizza periodo). Gli indici del periodo leggono solo il lavoro del mese.</p>';
  }

  M.Views.controllo = {
    title: 'Baseline ed EV',
    render() {
      const ctx = VH.ctx(); const p = ctx.p;
      const wbs = S.ui.evWbs || '';
      const e = evFor(ctx, wbs); M.VH.lastEV = e;
      const es = !wbs ? M.Costs.earnedSchedule(p, e, ctx.bl, ctx.bls, S.db) : null;
      const canB = S.can('baseline');
      const sameWork = S.projects((x) => x.work === p.work && x.id !== p.id && (x.status === 'BASE' || x.status === 'BKG'));
      const bls = UI.table(['Ruolo', 'Baseline', 'Salvata', 'Fine'], ROLES.map(([k, l]) => { const b = p.baselines && p.baselines[k] ? S.proj(p.baselines[k]) : null; return '<tr><td>' + l + '</td><td>' + (canB ? UI.sel('blAssign', [['', 'non assegnata']].concat(sameWork.map((x) => [x.id, x.code])), b ? b.id : '', 'data-k="' + k + '"') : esc(b ? b.code : 'non assegnata')) + '</td><td>' + (b ? U.fd(b.savedAt) : '') + '</td><td>' + (b && b.sched ? U.fd(b.sched.finishDay) : '') + '</td></tr>'; }));
      const cards = EVK.map((k) => { const ev = M.Info.EVI[k]; const l = ev.light(e); const v = e[k]; return '<div class="evk ' + (l || '') + '"><p class="ey">' + esc(ev.t.replace(/ \(.*\)$/, '')) + ' ' + UI.i(k, true) + '</p><b class="' + (l === 'bad' ? 'neg' : '') + '">' + UI.light(l) + fmtEV(k, v) + '</b><small class="mono">' + esc(k + ' = ' + ev.f) + '</small><small>' + esc(ev.say(e)) + '</small></div>'; }).join('');
      /* curve */
      const rows = M.Costs.curves(p, ctx.s, ctx.bl, ctx.bls, S.db, ctx.ev);
      const labels = rows.map((r) => U.monthLabel(r.key, true));
      const ddi = rows.findIndex((r) => r.key === U.monthKey(U.dnOf(p.dataDate)));
      const kf = (v) => U.num(v / 1000, 0);
      const chart = wbs ? '<p class="muted">Le curve sono calcolate sull\'intero progetto: togli il filtro WBS per vederle.</p>' : UI.lineChart({ w: 1000, h: 400, mr: 150, labels, yFmt: (v) => U.num(v / 1000, 0), series: [
        { name: 'PV previsto', color: '#b88a00', pts: rows.map((r, i) => [i, r.pv]), endFmt: (v) => kf(v) },
        { name: 'EV fatto', color: '#2f9455', w: 3, pts: rows.map((r, i) => (r.ev !== undefined ? [i, r.ev] : null)), label: false },
        { name: 'AC speso', color: '#cf3a3a', w: 3, pts: rows.map((r, i) => (r.ac !== undefined ? [i, r.ac] : null)), label: false },
        { name: 'Stima a finire', color: '#cf3a3a', dash: '4 4', pts: rows.map((r, i) => (r.fc !== undefined ? [i, r.fc] : null)), endFmt: (v) => 'EAC ' + kf(v) }
      ], vline: ddi, vlabel: 'Data date', areas: ddi >= 0 ? [{ x: ddi - 0.18, y1: e.PV, y2: e.EV, color: '#b88a00', label: 'SV ' + kf(e.SV) }, { x: ddi + 0.18, y1: e.AC, y2: e.EV, color: '#cf3a3a', label: '' }] : [], marks: ddi >= 0 ? [{ x: ddi, y: e.PV, color: '#b88a00', label: 'PV ' + kf(e.PV) }, { x: ddi, y: e.EV, color: '#2f9455', label: 'EV ' + kf(e.EV), dy: 18 }, { x: ddi, y: e.AC, color: '#cf3a3a', label: 'AC ' + kf(e.AC) + '  CV ' + kf(e.CV), dx: 10, anchor: 'start', dy: -6 }] : [], aria: 'Curve cumulate di PV, EV e AC' });
      /* andamento SPI e CPI */
      const hist = (p.periodHistory || []).slice().sort((a, b) => (a.end < b.end ? -1 : 1)).concat([{ end: p.dataDate, pv: ctx.ev.PV, ev: ctx.ev.EV, ac: ctx.ev.AC }]).filter((x, i, arr) => arr.findIndex((y) => y.end === x.end) === i);
      const trend = UI.lineChart({ w: 640, h: 280, mr: 90, labels: hist.map((h) => U.monthLabel(U.monthKey(U.dnOf(h.end)), true)), minY: 0.6, maxY: 1.2, band: [0.95, 1.05], refLine: 1, refLabel: '1,00', yFmt: (v) => U.num(v, 2), series: [{ name: 'SPI', color: '#1c5a8a', w: 3, pts: hist.map((h, i) => [i, h.pv ? h.ev / h.pv : null]), dots: hist.map((h, i) => [i, h.pv ? h.ev / h.pv : null]), endFmt: (v) => U.num(v) }, { name: 'CPI', color: '#cf3a3a', w: 3, pts: hist.map((h, i) => [i, h.ac ? h.ev / h.ac : null]), dots: hist.map((h, i) => [i, h.ac ? h.ev / h.ac : null]), endFmt: (v) => U.num(v) }], aria: 'Andamento di SPI e CPI per periodo' });
      /* scostamenti sulla fine */
      const fld = VH.fieldsAll();
      const varRows = p.activities.map((a) => ({ a, v: fld.varFinish.get(ctx, a) })).filter((x) => x.v !== null && x.v < 0).sort((x, y) => x.v - y.v).slice(0, 8).map((x) => '<tr><td><span class="mono">' + esc(x.a.code) + '</span> ' + esc(x.a.name) + '</td><td>' + U.fd(fld.blFinish.get(ctx, x.a)) + '</td><td>' + U.fd(fld.finish.get(ctx, x.a)) + (x.a.af ? ' A' : '') + '</td><td class="n neg">' + U.signed(x.v) + ' g</td></tr>');
      const issues = (p.issues || []).map((i, n) => '<li class="iss"><span class="chip ' + (i.prio === 'Alta' ? 'bad' : i.prio === 'Media' ? 'warn' : 'info') + '">' + esc(i.prio) + '</span><span><span class="mono">' + esc(i.id) + '</span> ' + esc(i.title) + '<br><span class="small muted">' + esc(i.source === 'soglia' ? 'da soglia' : 'manuale') + ' - ' + esc(i.owner) + ' - ' + U.fd(i.created) + '</span></span>' + UI.sel('issSt', ['Aperto', 'In corso', 'Chiuso'], i.status, 'data-i="' + n + '" aria-label="Stato issue"' + (S.can('cost') || S.can('schedule') ? '' : ' disabled')) + '</li>').join('');
      const risks = (p.risks || []).slice().sort((a, b) => b.p * b.i - a.p * a.i).map((r) => '<li class="iss"><span class="score ' + (r.type === 'opportunità' ? 'opp' : r.p * r.i >= 15 ? 'bad' : r.p * r.i >= 8 ? 'warn' : 'ok') + '">' + r.p * r.i + '</span><span><span class="mono">' + esc(r.id) + '</span> ' + esc(r.title) + '<br><span class="small muted">' + esc(r.type) + ' - P' + r.p + ' x I' + r.i + ' - risposta: ' + esc(r.response) + ' - ' + esc(r.owner || '') + '</span>' + (r.note ? '<br><span class="small">' + esc(r.note) + '</span>' : '') + '</span></li>').join('');
      const heat = (function () { let h = '<div class="heat" aria-label="Matrice probabilità per impatto">'; for (let pr = 5; pr >= 1; pr--) { for (let im = 1; im <= 5; im++) { const n = (p.risks || []).filter((r) => r.p === pr && r.i === im); const sc = pr * im; h += '<span class="hc ' + (sc >= 15 ? 'bad' : sc >= 8 ? 'warn' : 'ok') + '" title="P' + pr + ' x I' + im + '">' + (n.length ? n.map((r) => esc(r.id)).join(' ') : '') + '</span>'; } } return h + '</div><p class="small muted">Righe: probabilità 5 → 1. Colonne: impatto 1 → 5.</p>'; })();
      const ths = UI.table(['Parametro', 'WBS', 'Condizione', 'Priorità', 'Responsabile', ''], (p.thresholds || []).map((t, i) => '<tr><td>' + UI.sel('thF', ['SPI', 'CPI', 'TF', 'VarFine'], t.param, 'data-i="' + i + '" data-k="param"') + '</td><td>' + UI.sel('thF', (p.wbs || []).map((w) => [w.id, VH.wbsPath(ctx, w.id)]), t.wbsId, 'data-i="' + i + '" data-k="wbsId"') + '</td><td>' + UI.sel('thF', ['<', '>'], t.op, 'data-i="' + i + '" data-k="op"') + ' <input class="inp xs" type="number" step="0.01" value="' + t.value + '" data-c="thF" data-i="' + i + '" data-k="value"></td><td>' + UI.sel('thF', ['Alta', 'Media', 'Bassa'], t.prio, 'data-i="' + i + '" data-k="prio"') + '</td><td><input class="inp sm" value="' + esc(t.owner) + '" data-c="thF" data-i="' + i + '" data-k="owner"></td><td><button type="button" class="ibx" data-a="thDel" data-i="' + i + '" aria-label="Elimina soglia">' + UI.ic('trash', 15) + '</button></td></tr>'));
      const cmpMode = S.ui.cmpMode || 'prog';
      return '<div class="head"><div><p class="ey">' + esc(p.code) + ' - ' + esc(p.workName || p.name) + '</p><h1>Baseline ed Earned Value</h1><p class="sub">Scostamenti e indici alla data date ' + U.fd(p.dataDate) + ', rispetto alla baseline ' + esc(ctx.bl ? ctx.bl.code : 'non assegnata') + '.</p></div><div class="acts"><button type="button" class="btn" data-a="monitorTh">Monitora soglie</button>' + UI.i('thresholds') + '<button type="button" class="btn" data-a="saveBaseline"' + (canB ? '' : ' disabled') + '>Salva nuova baseline</button></div></div>' +
        '<div class="row">' + UI.card('Baseline assegnate', bls + '<p class="help">Ogni variante approvata diventa una nuova baseline nel nodo BASE: la contrattuale non si sovrascrive.</p>', { info: 'baselines', style: 'flex:1 1 340px' }) +
        UI.card('Earned Value', '<div class="tool flat"><label class="lbl">WBS ' + UI.sel('evWbs', [['', 'Tutto il progetto']].concat((p.wbs || []).filter((w) => w.parent).map((w) => [w.id, VH.wbsPath(ctx, w.id) + ' ' + w.name])), wbs) + '</label><span class="chip info">Tecnica: ' + ({ pct: 'Activity percent complete', '0/100': '0/100', '50/50': '50/50' })[S.S().evTechnique] + '</span><span class="chip info">EAC: ' + ({ cpi: 'BAC / CPI', rem: 'AC + Remaining cost', cpispi: 'AC + (BAC-EV)/(CPI x SPI)', pf1: 'AC + (BAC - EV)' })[S.S().eacMethod] + '</span></div><div class="evg">' + cards + '</div>', { style: 'flex:3 1 640px' }) + '</div>' +
        '<div class="row">' + UI.card('Curve cumulate (k€)', chart + '<p class="help">Valori scritti sulle curve. Alla data date: la distanza PV-EV è lo scostamento di tempo (SV), quella EV-AC lo scostamento di costo (CV).</p>', { info: 'EV', style: 'flex:3 1 640px' }) +
        UI.card('Dove siamo', matrix(e) + '<p>' + esc(M.Info.EVI.TCPI.say(e)) + '</p>' + (es ? '<h3 class="h3">Tempo e costo ' + UI.i('es') + '</h3><dl class="kv"><dt>SV in euro</dt><dd class="' + UI.dayCls(e.SV) + '">' + U.keur(e.SV) + '</dd><dt>SV in giorni (Earned Schedule)</dt><dd class="' + UI.dayCls(es.SVt) + '">' + U.signed(es.SVt) + ' g lavorativi</dd><dt>SPI(t)</dt><dd>' + U.num(es.SPIt) + '</dd><dt>Fine prevista da ES</dt><dd>' + U.fd(es.forecastFinish) + '</dd><dt>Fine da CPM</dt><dd>' + U.fd(ctx.s.finishDay) + ' (' + U.signed(ctx.bls ? M.Cal.between(ctx.pcal, ctx.s.finish, ctx.bls.finish) : 0) + ' g)</dd><dt>CV in euro</dt><dd class="' + UI.dayCls(e.CV) + '">' + U.keur(e.CV) + '</dd></dl><p class="help">L\'Earned Schedule misura il ritardo come tempo: è il momento in cui la baseline prevedeva il valore oggi prodotto (' + U.fd(es.esDay) + ').</p>' : ''), { info: 'matrix', style: 'flex:1 1 340px' }) + '</div>' +
        '<div class="row">' + UI.card('Andamento di SPI e CPI per periodo', trend + UI.legend([['SPI', '#1c5a8a'], ['CPI', '#cf3a3a'], ['Fascia di riferimento 0,95 - 1,05', '#e3f3e8']]), { style: 'flex:1 1 460px' }) + UI.card('Scostamenti sulla fine', UI.table(['Attività', 'Fine BL', 'Fine', { t: 'Var.', n: 1 }], varRows, { empty: 'Nessun ritardo sulla baseline' }) + '<div class="acts"><a class="btn sm" href="#/attivita">Apri nel Gantt</a></div>', { style: 'flex:1 1 380px' }) + '</div>' +
        UI.card('Confronti', '<div class="seg mb"><button type="button" class="btn sm' + (cmpMode === 'prog' ? ' on' : '') + '" data-a="cmpMode" data-k="prog">Programma contro programma</button><button type="button" class="btn sm' + (cmpMode === 'per' ? ' on' : '') + '" data-a="cmpMode" data-k="per">Periodo contro periodo</button></div>' + (cmpMode === 'prog' ? compareTable(ctx) : periodTable(ctx)), { info: 'compare' }) +
        '<div class="row">' + UI.card('Issue', '<ul class="isslist">' + (issues || '<li class="muted">Nessun issue</li>') + '</ul><div class="acts"><button type="button" class="btn sm" data-a="issAdd">+ Issue</button></div>', { info: 'issues', style: 'flex:1 1 380px' }) + UI.card('Rischi principali', heat + '<ul class="isslist">' + risks + '</ul><div class="acts"><button type="button" class="btn sm" data-a="riskAdd">+ Rischio</button></div><p class="help">Registro qualitativo. La simulazione Monte Carlo (P50, P80) richiede uno strumento dedicato.</p>', { info: 'risks', style: 'flex:1 1 380px' }) + UI.card('Soglie', ths + '<div class="acts"><button type="button" class="btn sm" data-a="thAdd">+ Soglia</button><button type="button" class="btn-p sm" data-a="monitorTh">Monitora ora</button></div>', { info: 'thresholds', style: 'flex:1 1 420px' }) + '</div>';
    }
  };

  /* calcolo delle soglie e generazione degli issue */
  function monitor() {
    const c = S.confirmed(); const ctx = VH.ctx(c);
    const out = [];
    (c.thresholds || []).forEach((t) => {
      let v = null, where = (ctx.wbsMap.get(t.wbsId) || {}).code || '';
      if (t.param === 'SPI' || t.param === 'CPI') { const e = M.Costs.ev(c, ctx.s, ctx.bl, ctx.bls, S.db, { wbs: t.wbsId }); v = e[t.param]; }
      else if (t.param === 'TF') { const f = M.Costs.wbsFilter(c, t.wbsId); const tfs = c.activities.filter(f).map((a) => (ctx.s.acts[a.id] || {}).tf).filter((x) => x !== null && x !== undefined); v = tfs.length ? Math.min.apply(null, tfs) : null; }
      else if (t.param === 'VarFine') { v = ctx.bls ? M.Cal.between(ctx.pcal, ctx.s.finish, ctx.bls.finish) : null; }
      if (v === null) return;
      const hit = t.op === '<' ? v < t.value : v > t.value;
      if (hit) out.push({ t, v, where });
    });
    let n = 0;
    out.forEach(({ t, v, where }) => {
      const title = t.param + ' ' + (['SPI', 'CPI'].includes(t.param) ? U.num(v) : v + ' g') + (t.op === '<' ? ' sotto' : ' sopra') + ' soglia ' + (['SPI', 'CPI'].includes(t.param) ? U.num(t.value) : t.value) + ' su ' + where;
      if ((c.issues || []).some((i) => i.source === 'soglia' && i.status !== 'Chiuso' && i.thId === t.id)) return;
      c.issues = c.issues || [];
      c.issues.push({ id: 'I-' + String(100 + c.issues.length + 1), title, prio: t.prio, status: 'Aperto', owner: t.owner, source: 'soglia', created: c.dataDate, thId: t.id });
      n++;
    });
    S.save();
    return { hits: out.length, created: n };
  }

  Object.assign(M.A, {
    cmpMode(el) { S.ui.cmpMode = el.getAttribute('data-k'); S.saveUi(); M.App.render(true); },
    monitorTh() { const r = monitor(); UI.toast(r.hits + ' soglie superate, ' + r.created + ' nuovi issue creati.', r.hits ? 'warn' : 'ok'); M.App.render(true); },
    saveBaseline() {
      const c = S.confirmed();
      const n = S.projects((x) => x.status === 'BASE' && x.work === c.work).length + 1;
      UI.modal({ title: 'Salva nuova baseline', info: 'baselines', body: '<label class="fld">Nome<input class="inp" id="bl-code" value="' + esc(c.work + '_BL' + String(n).padStart(2, '0')) + '"></label><label class="fld">Motivo (es. variante approvata)<input class="inp" id="bl-note"></label><label class="sw"><input type="checkbox" id="bl-assign"> Assegnala come baseline Primary</label><p class="help">La baseline è una copia del programma alla data di oggi nel nodo BASE. Prima di salvarla controlla i controlli di qualità in Schedulazione.</p>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="saveBaselineOk">Salva</button>' });
    },
    saveBaselineOk() {
      const c = S.confirmed(); const code = U.$('#bl-code').value.trim(); if (!code) return;
      const note = U.$('#bl-note').value; const asg = U.$('#bl-assign').checked;
      const b = S.copyProject(S.P(), { code, name: (c.workName || '') + ' - baseline ' + code + (note ? ' (' + note + ')' : ''), status: 'BASE', epsId: S.epsNodeFor(c.work, 'BASE') || c.epsId, savedAt: U.isoOf(U.todayDn()) });
      if (asg) { c.baselines = c.baselines || {}; c.baselines.primary = b.id; S.save(); }
      UI.closeModal(); UI.toast('Baseline ' + code + ' salvata nel nodo BASE.', 'ok'); M.App.render(true);
    },
    ctrlExport() {
      const ctx = VH.ctx(); const A = S.proj(S.ui.ctrlA) || ctx.bl || ctx.p, B = S.proj(S.ui.ctrlB) || ctx.p;
      const ca = VH.ctx(A), cb = VH.ctx(B);
      const rows = [['ID', 'Attività', 'Inizio A', 'Inizio B', 'Var. inizio (g)', 'Fine A', 'Fine B', 'Var. fine (g)', 'TF A', 'TF B', 'Budget A', 'Budget B', 'EV A', 'EV B'].map((h) => ({ v: h, s: 1 }))];
      cb.p.activities.forEach((b) => { const a = A.activities.find((x) => x.id === b.id); if (!a) return; const da = VH.dates(ca, a), dbb = VH.dates(cb, b); rows.push([b.code, b.name, da.start !== null ? { v: da.start, t: 'd' } : '', dbb.start !== null ? { v: dbb.start, t: 'd' } : '', da.start !== null && dbb.start !== null ? M.Cal.between(ctx.pcal, dbb.start, da.start) : '', da.finish !== null ? { v: da.finish, t: 'd' } : '', dbb.finish !== null ? { v: dbb.finish, t: 'd' } : '', da.finish !== null && dbb.finish !== null ? M.Cal.between(ctx.pcal, dbb.finish + 1, da.finish + 1) : '', (ca.s.acts[a.id] || {}).tf, (cb.s.acts[b.id] || {}).tf, (ca.ev.per[a.id] || {}).bud || 0, (cb.ev.per[b.id] || {}).bud || 0, (ca.ev.per[a.id] || {}).ev || 0, (cb.ev.per[b.id] || {}).ev || 0]); });
      U.download('Confronto_' + U.slug(A.code) + '_vs_' + U.slug(B.code) + '.xlsx', M.Zip.xlsx([{ name: 'Confronto', rows, freeze: 1, autoFilter: true, cols: [10, 32, 11, 11, 9, 11, 11, 9, 7, 7, 13, 13, 13, 13] }]));
    },
    issAdd() { UI.prompt('Nuovo issue', 'Descrizione del problema', '', (t) => { if (!t) return; S.mutate((w) => { w.issues = w.issues || []; w.issues.push({ id: 'I-' + String(100 + w.issues.length + 1), title: t, prio: 'Media', status: 'Aperto', owner: S.user().name, source: 'manuale', created: U.isoOf(U.todayDn()) }); }, { affects: false, cap: S.can('schedule') ? 'schedule' : 'cost' }); }); },
    riskAdd() { UI.modal({ title: 'Nuovo rischio', info: 'risks', body: '<label class="fld">Titolo<input class="inp" id="rk-t"></label><div class="grid3"><label class="fld">Tipo' + UI.sel('noop', ['minaccia', 'opportunità'], 'minaccia', 'id="rk-k"') + '</label><label class="fld">Probabilità (1-5)<input class="inp" type="number" min="1" max="5" value="3" id="rk-p"></label><label class="fld">Impatto (1-5)<input class="inp" type="number" min="1" max="5" value="3" id="rk-i"></label></div><label class="fld">Risposta' + UI.sel('noop', ['Avoid', 'Mitigate', 'Transfer', 'Accept', 'Exploit', 'Enhance', 'Share'], 'Mitigate', 'id="rk-r"') + '</label>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="riskAddOk">Aggiungi</button>' }); },
    riskAddOk() { const t = U.$('#rk-t').value; if (!t) return; const r = { id: 'R-' + String((S.P().risks || []).length + 10), title: t, type: U.$('#rk-k').value, p: U.clamp(Number(U.$('#rk-p').value) || 3, 1, 5), i: U.clamp(Number(U.$('#rk-i').value) || 3, 1, 5), response: U.$('#rk-r').value, owner: S.user().name }; UI.closeModal(); S.mutate((w) => { w.risks = w.risks || []; w.risks.push(r); }, { affects: false, cap: S.can('schedule') ? 'schedule' : 'cost' }); },
    thAdd() { S.mutate((w) => { w.thresholds = w.thresholds || []; w.thresholds.push({ id: U.uid('th'), param: 'SPI', wbsId: (w.wbs.find((x) => !x.parent) || {}).id, op: '<', value: 0.9, prio: 'Media', owner: S.user().name }); }, { affects: false, cap: S.can('schedule') ? 'schedule' : 'cost' }); },
    thDel(el) { const i = Number(el.getAttribute('data-i')); S.mutate((w) => { w.thresholds.splice(i, 1); }, { affects: false, cap: S.can('schedule') ? 'schedule' : 'cost' }); }
  });
  Object.assign(M.C, {
    blAssign(el) { const k = el.getAttribute('data-k'); S.mutate((w) => { w.baselines = w.baselines || {}; w.baselines[k] = el.value; }, { affects: false, cap: 'baseline' }); },
    evWbs(el) { S.ui.evWbs = el.value; S.saveUi(); M.App.render(true); },
    ctrlA(el) { S.ui.ctrlA = el.value; S.saveUi(); M.App.render(true); },
    ctrlB(el) { S.ui.ctrlB = el.value; S.saveUi(); M.App.render(true); },
    ctrlWbs(el) { S.ui.ctrlWbs = el.value; S.saveUi(); M.App.render(true); },
    ctrlAll(el) { S.ui.ctrlAll = el.checked; S.saveUi(); M.App.render(true); },
    issSt(el) { const i = Number(el.getAttribute('data-i')); S.mutate((w) => { w.issues[i].status = el.value; }, { affects: false, cap: S.can('schedule') ? 'schedule' : 'cost' }); },
    thF(el) { const i = Number(el.getAttribute('data-i')), k = el.getAttribute('data-k'); S.mutate((w) => { w.thresholds[i][k] = k === 'value' ? Number(el.value) || 0 : el.value; }, { affects: false, cap: S.can('schedule') ? 'schedule' : 'cost' }); }
  });
})(window.M = window.M || {});
