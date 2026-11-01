/* Meridian - Costi: sintesi per dimensione, curve economiche, curve dei materiali, cash flow, contratto e varianti */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;
  const TABS = [['sintesi', 'Sintesi'], ['curve', 'Curve economiche'], ['mat', 'Materiali'], ['cash', 'Cash flow'], ['contr', 'Contratto e varianti']];
  const DIMS = [['wbs', 'WBS'], ['company', 'Impresa'], ['mat', 'Materiale'], ['cbs', 'Conto (CBS)'], ['kind', 'Natura']];

  function tabSintesi(ctx) {
    const dim = S.ui.costDim || 'wbs';
    const rows = M.Costs.aggregate(ctx.p, S.db, ctx.s, ctx.ev, dim);
    const cbsName = (k) => { const c = (S.db.costAccounts || []).find((x) => x.id === k); return c ? c.code + ' ' + c.name : k; };
    const tot = rows.reduce((a, r) => ({ bud: a.bud + r.bud, act: a.act + r.act, rem: a.rem + r.rem, ev: a.ev + r.ev }), { bud: 0, act: 0, rem: 0, ev: 0 });
    const body = rows.map((r) => { const atc = r.act + r.rem; const cpi = r.act ? r.ev / r.act : null; return '<tr><td>' + esc(dim === 'cbs' ? cbsName(r.label) : r.label) + '</td><td class="n">' + U.num(r.bud) + '</td><td class="n">' + U.num(r.ev) + '</td><td class="n">' + U.num(r.act) + '</td><td class="n">' + U.num(r.rem) + '</td><td class="n ' + (atc > r.bud + 1 ? 'neg' : '') + '">' + U.num(atc) + '</td><td class="n ' + (atc > r.bud + 1 ? 'neg' : 'pos') + '">' + U.num(r.bud - atc) + '</td><td class="n ' + (cpi !== null && cpi < 0.95 ? 'neg' : '') + '">' + (cpi === null ? '' : U.num(cpi)) + '</td></tr>'; });
    body.push('<tr class="tot"><td><b>Totale</b></td><td class="n"><b>' + U.num(tot.bud) + '</b></td><td class="n"><b>' + U.num(tot.ev) + '</b></td><td class="n"><b>' + U.num(tot.act) + '</b></td><td class="n"><b>' + U.num(tot.rem) + '</b></td><td class="n"><b>' + U.num(tot.act + tot.rem) + '</b></td><td class="n"><b>' + U.num(tot.bud - tot.act - tot.rem) + '</b></td><td class="n"><b>' + (tot.act ? U.num(tot.ev / tot.act) : '') + '</b></td></tr>');
    const dc = M.Costs.doubleCount(ctx.p, S.db);
    return '<div class="kpis">' + UI.kpi('Budget (BAC)', U.keur(ctx.ev.BAC), 'risorse e righe di costo', '', 'BAC') + UI.kpi('Consuntivo (AC)', U.keur(ctx.ev.AC), 'alla data date', '', 'AC') + UI.kpi('Stima a finire (EAC)', U.keur(ctx.ev.EAC), 'metodo ' + ({ cpi: 'BAC / CPI', rem: 'AC + rimanente', cpispi: 'AC + (BAC-EV)/(CPI x SPI)', pf1: 'AC + BAC - EV' })[S.S().eacMethod], ctx.ev.EAC > ctx.ev.BAC ? 'neg' : '', 'EAC') + UI.kpi('Rimanente a budget', U.keur(ctx.ev.REM), 'righe e risorse non ancora eseguite') + UI.kpi('Valore contrattuale', U.keur(contractNow(ctx.p)), 'con varianti approvate', '', 'contract') + '</div>' +
      UI.card('Aggregazione dei costi', '<div class="seg mb">' + DIMS.map(([k, l]) => '<button type="button" class="btn sm' + (dim === k ? ' on' : '') + '" aria-pressed="' + (dim === k) + '" data-a="costDim" data-k="' + k + '">' + l + '</button>').join('') + '</div>' + UI.table([DIMS.find((d) => d[0] === dim)[1], { t: 'Budget', n: 1 }, { t: 'EV', n: 1 }, { t: 'Consuntivo', n: 1 }, { t: 'Rimanente', n: 1 }, { t: 'A finire', n: 1 }, { t: 'Budget - A finire', n: 1 }, { t: 'CPI', n: 1 }], body) + '<p class="help">A finire = consuntivo + rimanente a budget; la stima EAC del progetto usa invece il metodo scelto in Amministrazione. Importi in euro.</p>', { info: 'costs' }) +
      UI.card('Regola anti doppio conteggio', (dc.length ? '<p class="warnbox">' + UI.ic('alert', 16) + ' ' + dc.length + ' casi da verificare:</p>' + UI.table(['Attività', 'Risorsa con prezzo', 'Subappalto con manodopera'], dc.map((x) => '<tr><td><button type="button" class="lnk" data-a="selAct" data-id="' + esc(x.act.id) + '" data-r="attivita">' + esc(x.act.code + ' ' + x.act.name) + '</button></td><td>' + esc(x.res.name) + '</td><td>' + x.lines.map((l) => esc(l.company)).join(', ') + '</td></tr>')) : '<p class="pos">' + UI.ic('check', 16) + ' Nessun caso: le risorse a tempo con prezzo non si sovrappongono a subappalti che comprendono manodopera.</p>') + '<p class="help">Regola: le risorse a tempo (manodopera, mezzi) sono costi interni; le righe a quantità sono costi esterni. Se un subappalto comprende la manodopera, le ore del subappaltatore si tracciano al più come risorsa con prezzo zero.</p>', { info: 'doubleCount' });
  }

  function contractNow(p) { return (p.contractValue || 0) + U.sum((p.changes || []).filter((c) => c.status === 'Approvata'), (c) => c.amount); }

  function tabCurve(ctx) {
    const rows = M.Costs.curves(ctx.p, ctx.s, ctx.bl, ctx.bls, S.db, ctx.ev);
    const labels = rows.map((r) => U.monthLabel(r.key, true));
    const ddKey = U.monthKey(U.dnOf(ctx.p.dataDate));
    const ddi = rows.findIndex((r) => r.key === ddKey);
    const k = (v) => U.num(v / 1000, 0);
    const chart = UI.lineChart({ w: 980, h: 380, mr: 200, labels, yFmt: (v) => U.num(v / 1000, 0) + ' k€', series: [
      { name: 'Budget baseline', color: '#e0ad00', pts: rows.map((r, i) => [i, r.pv]), endFmt: (v) => k(v) + ' k€' },
      { name: 'Budget corrente', color: '#9fb2c5', dash: '6 4', pts: rows.map((r, i) => [i, r.plan]), endFmt: (v) => k(v) + ' k€' },
      { name: 'Consuntivo (AC)', color: '#cf3a3a', pts: rows.map((r, i) => (r.ac !== undefined ? [i, r.ac] : null)), w: 3, label: false },
      { name: 'EV', color: '#2f9455', pts: rows.map((r, i) => (r.ev !== undefined ? [i, r.ev] : null)), w: 3, label: false },
      { name: 'Previsione (EAC)', color: '#cf3a3a', dash: '3 4', pts: rows.map((r, i) => (r.fc !== undefined ? [i, r.fc] : null)), endFmt: (v) => k(v) + ' k€' }
    ], vline: ddi, vlabel: 'DD ' + U.fd(ctx.p.dataDate), marks: ddi >= 0 ? [{ x: ddi, y: ctx.ev.AC, color: '#cf3a3a', label: 'AC ' + k(ctx.ev.AC) }, { x: ddi, y: ctx.ev.EV, color: '#2f9455', label: 'EV ' + k(ctx.ev.EV), dy: 16 }, { x: ddi, y: ctx.ev.PV, color: '#b88a00', label: 'PV ' + k(ctx.ev.PV), dy: -10, dx: 8, anchor: 'start' }] : [], aria: 'Curva economica cumulata' });
    let pv0 = 0, ac0 = 0, fc0 = 0;
    const per = rows.map((r) => { const o = { key: r.key, pv: r.pv - pv0, ac: r.ac !== undefined ? r.ac - ac0 : null, fc: r.fc !== undefined && r.key > ddKey ? r.fc - fc0 : null }; pv0 = r.pv; if (r.ac !== undefined) ac0 = r.ac; if (r.fc !== undefined) fc0 = r.fc; return o; });
    const bars = UI.barChart({ w: 980, h: 240, labels, stacks: per.map((x) => [x.ac !== null ? x.ac : 0, x.fc !== null ? x.fc : 0]), colors: ['#cf3a3a', '#f2b3b3'], names: ['Consuntivo del mese', 'Previsione del mese'], line: per.map((x) => x.pv), lineName: 'Budget baseline', yFmt: (v) => U.num(v / 1000, 0) + ' k€', aria: 'Costi per mese' });
    return UI.card('Curva economica cumulata (k€)', chart + '<p class="help">I valori sono scritti sulle curve. Previsione = AC alla data date più l\'ETC (' + U.keur(ctx.ev.ETC) + ') distribuito come il lavoro rimanente sul programma corrente.</p>', { info: 'cashflow' }) + UI.card('Costi per mese', bars + UI.legend([['Consuntivo del mese', '#cf3a3a'], ['Previsione del mese', '#f2b3b3'], ['Budget baseline del mese', '#0f2a40', 'height:3px']]));
  }

  function tabMat(ctx) {
    const company = S.ui.matCompany || '';
    const comps = [...new Set(ctx.p.activities.flatMap((a) => (a.costs || []).map((l) => l.company)).filter(Boolean))].sort();
    const groups = M.Costs.materialCurves(ctx.p, ctx.s, S.db, company ? { company } : null);
    /* materiali come risorse Material */
    if (!company) S.db.resources.filter((r) => r.type === 'Material').forEach((r) => { const pr = M.Costs.resourceProfile(S.db, r.id, [ctx.p], { [ctx.p.id]: ctx.s }); if (!pr || !pr.rows.length) return; const g = { mat: r.name + ' (risorsa)', um: r.unit, plan: new Map(), done: new Map(), tot: 0, doneTot: 0 }; pr.rows.forEach((m) => g.plan.set(m.key, m.total)); pr.lines.forEach((l) => { g.tot += (l.asg.act || 0) + (l.asg.rem || 0); g.doneTot += l.asg.act || 0; }); groups.push(g); });
    const DD = U.dnOf(ctx.p.dataDate), ddKey = U.monthKey(DD);
    const cards = groups.filter((g) => g.tot > 0 && g.um !== 'a corpo' && g.um !== 'mese').map((g) => {
      const ks = [...new Set([...g.plan.keys(), ...g.done.keys()])].sort((a, b) => a - b);
      if (!ks.length) return '';
      const keys = []; for (let k = ks[0]; k <= ks[ks.length - 1]; k++) keys.push(k);
      let cum = 0;
      const cumPts = keys.map((k) => { cum += g.plan.get(k) || 0; return cum; });
      const chart = UI.barChart({ w: 520, h: 230, labels: keys.map((k) => U.monthLabel(k, true)), stacks: keys.map((k) => [k <= ddKey ? g.done.get(k) || 0 : 0, k > ddKey ? g.plan.get(k) || 0 : 0]), colors: ['#2b6fd6', '#9fc3e6'], names: ['Eseguito', 'Previsto'], yFmt: (v) => U.num(v, 0), aria: 'Quantità di ' + g.mat + ' per mese' });
      const line = UI.lineChart({ w: 520, h: 200, mr: 110, labels: keys.map((k) => U.monthLabel(k, true)), series: [{ name: 'Cumulata prevista', color: '#1c5a8a', pts: cumPts.map((v, i) => [i, v]), endFmt: (v) => U.num(v, 0) + ' ' + g.um }], vline: keys.indexOf(ddKey) >= 0 ? keys.indexOf(ddKey) : null, vlabel: 'DD', yFmt: (v) => U.num(v, 0), aria: 'Cumulata di ' + g.mat });
      return UI.card(g.mat + ' (' + g.um + ')', '<p class="small">Totale <b>' + U.num(g.tot, 2) + ' ' + esc(g.um) + '</b>, eseguito <b>' + U.num(g.doneTot, 2) + ' ' + esc(g.um) + '</b> (' + U.pct(g.tot ? (g.doneTot / g.tot) * 100 : 0) + ')</p>' + chart + line, { style: 'flex:1 1 460px' });
    }).join('');
    return '<div class="tool card"><label class="lbl">Impresa ' + UI.i('materials') + '<select class="inp sm" data-c="matCompany"><option value="">Tutte</option>' + comps.map((c) => '<option' + (c === company ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label><span class="muted small">Quantità fisiche per tipo di materiale e unità di misura: le curve si sommano solo a parità di unità.</span></div><div class="row">' + (cards || '<p class="muted">Nessun materiale con unità di misura per questo filtro.</p>') + '</div>';
  }

  function tabCash(ctx) {
    const rows = M.Costs.curves(ctx.p, ctx.s, ctx.bl, ctx.bls, S.db, ctx.ev);
    const ddKey = U.monthKey(U.dnOf(ctx.p.dataDate));
    let pv0 = 0, ac0 = 0, fc0 = 0, plan0 = 0;
    const per = rows.map((r) => { const o = { key: r.key, pv: r.pv - pv0, plan: r.plan - plan0, ac: r.ac !== undefined ? r.ac - ac0 : null, fc: r.fc !== undefined && r.key > ddKey ? r.fc - fc0 : null, cpv: r.pv, cac: r.ac, cfc: r.fc }; pv0 = r.pv; plan0 = r.plan; if (r.ac !== undefined) ac0 = r.ac; if (r.fc !== undefined) fc0 = r.fc; return o; });
    const fp = (k) => (S.db.periods || []).find((x) => U.monthKey(U.dnOf(x.start)) === k);
    const body = per.map((x) => { const f = fp(x.key); return '<tr class="' + (x.key === ddKey ? 'sel' : '') + '"><td>' + esc(f ? f.name : U.monthLabel(x.key, true)) + (f && f.stored ? ' ' + UI.chip('storicizzato', 'ok') : '') + '</td><td class="n">' + U.num(x.pv) + '</td><td class="n">' + U.num(x.plan) + '</td><td class="n">' + (x.ac !== null ? U.num(x.ac) : '') + '</td><td class="n">' + (x.fc !== null ? U.num(x.fc) : '') + '</td><td class="n">' + U.num(x.cpv) + '</td><td class="n">' + (x.cac !== undefined ? U.num(x.cac) : x.cfc !== undefined ? U.num(x.cfc) : '') + '</td></tr>'; });
    return UI.card('Cash flow per financial period (euro)', UI.table(['Periodo', { t: 'Budget baseline', n: 1 }, { t: 'Budget corrente', n: 1 }, { t: 'Consuntivo', n: 1 }, { t: 'Previsione', n: 1 }, { t: 'Baseline cumulata', n: 1 }, { t: 'Effettivo e previsto cumulato', n: 1 }], body, { cls: 'compact' }) + '<p class="help">Consuntivi dei periodi passati dallo storico (Storicizza periodo); il periodo della data date usa il valore corrente. Previsione = ETC distribuito sul rimanente.</p>', { info: 'cashflow' });
  }

  function tabContr(ctx) {
    const p = ctx.p;
    const appr = U.sum((p.changes || []).filter((c) => c.status === 'Approvata'), (c) => c.amount);
    const prop = U.sum((p.changes || []).filter((c) => c.status === 'Proposta'), (c) => c.amount);
    const cv = (p.contractValue || 0) + appr;
    const mBud = cv - ctx.ev.BAC, mEac = cv - ctx.ev.EAC;
    const can = S.can('cost'); const d = can ? '' : ' disabled';
    const rows = (p.changes || []).map((c, i) => '<tr><td class="mono">' + esc(c.id) + '</td><td>' + UI.sel('chgF', ['Variante', 'Extra'], c.type, 'data-i="' + i + '" data-k="type"' + d) + '</td><td><input class="inp" value="' + esc(c.title) + '" data-c="chgF" data-i="' + i + '" data-k="title"' + d + '></td><td class="n"><input class="inp sm" type="number" step="0.01" value="' + c.amount + '" data-c="chgF" data-i="' + i + '" data-k="amount"' + d + '></td><td>' + UI.sel('chgF', ['Proposta', 'Approvata', 'Respinta'], c.status, 'data-i="' + i + '" data-k="status"' + d) + '</td><td>' + U.fd(c.date) + '</td><td>' + (can ? '<button type="button" class="ibx" data-a="chgDel" data-i="' + i + '" aria-label="Elimina">' + UI.ic('trash', 15) + '</button>' : '') + '</td></tr>');
    return '<div class="kpis">' + UI.kpi('Valore contrattuale iniziale', U.keur(p.contractValue || 0), '', '', 'contract') + UI.kpi('Varianti ed extra approvati', U.keur(appr), 'proposti ' + U.keur(prop), '', 'changes') + UI.kpi('Valore contrattuale aggiornato', U.keur(cv), '') + UI.kpi('Margine su budget', U.keur(mBud), U.pct(cv ? (mBud / cv) * 100 : 0), mBud < 0 ? 'neg' : 'pos') + UI.kpi('Margine atteso su EAC', U.keur(mEac), U.pct(cv ? (mEac / cv) * 100 : 0), mEac < 0 ? 'neg' : mEac < mBud ? 'warnc' : 'pos') + '</div>' +
      UI.card('Varianti ed extra', UI.table(['ID', 'Tipo', 'Descrizione', { t: 'Importo €', n: 1 }, 'Stato', 'Data', ''], rows, { empty: 'Nessuna variante' }) + (can ? '<div class="acts"><button type="button" class="btn sm" data-a="chgAdd">+ Variante o extra</button></div>' : '') + '<p class="help">Il budget (costo previsto) si confronta con il valore contrattuale aggiornato dalle sole varianti approvate. Una variante approvata che cambia tempi o quantità va riportata anche nel programma e in una nuova baseline.</p>', { info: 'changes' });
  }

  M.Views.costi = {
    title: 'Costi',
    render() {
      const ctx = VH.ctx(); M.VH.lastEV = ctx.ev;
      const t = S.ui.costTab || 'sintesi';
      const body = { sintesi: tabSintesi, curve: tabCurve, mat: tabMat, cash: tabCash, contr: tabContr }[t](ctx);
      return '<div class="head"><div><p class="ey">' + esc(ctx.p.code) + ' - ' + esc(ctx.p.workName || ctx.p.name) + '</p><h1>Costi ' + UI.i('costs') + '</h1><p class="sub">Righe di costo per attività (impresa, lavoro, materiale, unità, quantità, prezzo) e risorse a tempo, aggregate e distribuite nel tempo.</p></div><div class="acts"><button type="button" class="btn" data-a="costExport">' + UI.ic('down') + 'Esporta righe di costo</button><a class="btn" href="#/attivita">Righe per attività</a></div></div>' +
        '<div class="tabs" role="tablist" aria-label="Sezioni dei costi">' + TABS.map(([k, l]) => '<button type="button" class="tab' + (k === t ? ' on' : '') + '" role="tab" aria-selected="' + (k === t) + '" data-a="costTab" data-t="' + k + '">' + l + '</button>').join('') + '</div>' + body;
    }
  };

  Object.assign(M.A, {
    costTab(el) { S.ui.costTab = el.getAttribute('data-t'); S.saveUi(); M.App.render(); },
    costDim(el) { S.ui.costDim = el.getAttribute('data-k'); S.saveUi(); M.App.render(true); },
    chgAdd() { S.mutate((w) => { w.changes = w.changes || []; w.changes.push({ id: 'V-' + String(w.changes.length + 1).padStart(2, '0'), type: 'Variante', title: 'Nuova variante', amount: 0, status: 'Proposta', date: U.isoOf(U.todayDn()) }); }, { cap: 'cost', affects: false }); },
    chgDel(el) { const i = Number(el.getAttribute('data-i')); S.mutate((w) => { w.changes.splice(i, 1); }, { cap: 'cost', affects: false }); },
    costExport() {
      const ctx = VH.ctx(); const p = ctx.p;
      const head = ['ID attività', 'Attività', 'WBS', 'Impresa', 'Descrizione', 'Materiale', 'UM', 'Quantità', 'Costo unitario', 'Importo', 'Q.tà eseguita', 'Consuntivo', 'Distribuzione', 'Natura', 'Conto', 'Con manodopera'];
      const rows = [head.map((h) => ({ v: h, s: 1 }))];
      p.activities.forEach((a) => (a.costs || []).forEach((l) => rows.push([a.code, a.name, VH.wbsPath(ctx, a.wbsId), l.company, l.desc, l.mat, l.um, Number(l.qty) || 0, Number(l.unit) || 0, M.Costs.lineAmount(l), Number(l.qtyDone) || 0, Number(l.actual) || 0, M.Costs.DIST[l.dist] || l.dist, l.kind, l.cbs, l.withLabor ? 'sì' : 'no'])));
      U.download('Righe_di_costo_' + U.slug(p.code) + '.xlsx', M.Zip.xlsx([{ name: 'Righe di costo', rows, freeze: 1, autoFilter: true, cols: [10, 28, 14, 24, 36, 18, 8, 10, 12, 14, 10, 12, 12, 12, 10, 10] }]));
      UI.toast('Righe di costo esportate. Puoi aggiornarle e reimportarle da Scambio dati (abbinamento per ID attività e descrizione).', 'ok');
    }
  });
  Object.assign(M.C, {
    matCompany(el) { S.ui.matCompany = el.value; S.saveUi(); M.App.render(true); },
    chgF(el) { const i = Number(el.getAttribute('data-i')), k = el.getAttribute('data-k'); S.mutate((w) => { w.changes[i][k] = k === 'amount' ? Number(el.value) || 0 : el.value; }, { cap: 'cost', affects: false }); }
  });
})(window.M = window.M || {});
