/* Meridian - pannello dettagli dell'attività (parte bassa come in P6) */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, CPM = M.CPM, esc = U.esc;
  const TABS = ['Generale', 'Stato', 'Risorse', 'Legami', 'Costi', 'Codici', 'Passi', 'Tavole', 'Note'];
  const DT = { FDU: 'Fixed Duration and Units/Time', FDQ: 'Fixed Duration and Units', FR: 'Fixed Units/Time', FQ: 'Fixed Units' };
  const PT = { phys: 'Physical', dur: 'Duration', units: 'Units', qty: 'Quantità (righe di costo)' };

  const opt = (list, val) => list.map(([k, v]) => '<option value="' + esc(k) + '"' + (String(k) === String(val === undefined || val === null ? '' : val) ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  const ro = () => !S.can('schedule');
  const dis = (cap) => (S.can(cap || 'schedule') ? '' : ' disabled');

  function cur(p) { return p.activities.find((a) => a.id === S.ui.sel); }

  function tabGenerale(ctx, a) {
    const wbsOpts = (ctx.p.wbs || []).map((w) => [w.id, VH.wbsPath(ctx, w.id) + ' ' + w.name]);
    return '<div class="pane"><div class="grid3">' +
      '<label class="fld">Activity ID<input class="inp mono" value="' + esc(a.code) + '" data-c="af" data-k="code"' + dis() + '></label>' +
      '<label class="fld span2">Nome<input class="inp" value="' + esc(a.name) + '" data-c="af" data-k="name"' + dis() + '></label>' +
      '<label class="fld">WBS ' + UI.i('wbs') + '<select class="inp" data-c="af" data-k="wbsId"' + dis() + '>' + opt(wbsOpts, a.wbsId) + '</select></label>' +
      '<label class="fld">Tipo attività ' + UI.i('actType') + '<select class="inp" data-c="af" data-k="type"' + dis() + '>' + opt(Object.entries(CPM.TYPES), a.type) + '</select></label>' +
      '<label class="fld">Calendario ' + UI.i('calendar') + '<select class="inp" data-c="af" data-k="calId"' + dis() + '>' + opt([['', 'Del progetto (' + ((S.cal(ctx.p.calId) || {}).name || '') + ')']].concat(S.db.calendars.map((c) => [c.id, c.name])), a.calId || '') + '</select></label>' +
      '<label class="fld">Responsabile (OBS)<select class="inp" data-c="af" data-k="obs"' + dis() + '>' + opt([['', '-']].concat(S.db.obs.map((o) => [o.id, o.name])), a.obs || '') + '</select></label>' +
      '<label class="fld adv">Tipo di durata ' + UI.i('durType') + '<select class="inp" data-c="af" data-k="durType"' + dis() + '>' + opt(Object.entries(DT), a.durType || 'FDU') + '</select></label>' +
      '<label class="fld">Tipo % completamento ' + UI.i('pctType') + '<select class="inp" data-c="af" data-k="pctType"' + dis() + '>' + opt(Object.entries(PT), a.pctType || 'phys') + '</select></label>' +
      '</div>' + (S.can('schedule') ? '<div class="acts"><button type="button" class="btn sm" data-a="actDup">' + UI.ic('copy', 16) + 'Duplica</button><button type="button" class="btn-d sm" data-a="actDel">' + UI.ic('trash', 16) + 'Elimina attività</button></div>' : '') + '</div>';
  }

  function tabStato(ctx, a) {
    const r = ctx.s.acts[a.id] || {};
    const mile = CPM.isMile(a);
    const actualDur = a.as ? M.Cal.between(S.cal(a.calId || ctx.p.calId) || ctx.pcal, U.dnOf(a.as), a.af ? U.dnOf(a.af) + 1 : U.dnOf(ctx.p.dataDate) + 1) : 0;
    const rem = a.af ? 0 : a.as ? (a.rd !== undefined ? a.rd : a.od) : a.od;
    const byCalc = (a.steps && a.steps.length && a.stepsDrive !== false && (a.pctType || 'phys') === 'phys') || a.pctType === 'qty' || a.pctType === 'dur' || a.pctType === 'units';
    const pct = M.Costs.actPct(a, r, S.db);
    const cstr = a.cstr || {};
    return '<div class="pane flexw">' +
      '<div class="pblk"><p class="ey">Durata (giorni)</p><dl class="kv"><dt>Original</dt><dd>' + (a.type === 'loe' ? U.int(r.odCalc || 0) + ' <span class="muted small">dai legami</span>' : mile ? '0' : '<input class="inp xs" type="number" min="0" value="' + (a.od || 0) + '" data-c="af" data-k="od"' + dis() + ' aria-label="Durata originale">') + '</dd><dt>Actual</dt><dd>' + U.int(actualDur) + '</dd><dt>Remaining</dt><dd>' + (a.as && !a.af && !mile && a.type !== 'loe' ? '<input class="inp xs" type="number" min="0" value="' + rem + '" data-c="af" data-k="rd"' + dis('progress') + ' aria-label="Durata rimanente">' : U.int(a.type === 'loe' ? r.dur || 0 : rem || 0)) + '</dd><dt>At completion</dt><dd' + (actualDur + (rem || 0) > (a.od || 0) && a.as && !mile ? ' class="neg"' : '') + '>' + U.int(actualDur + (rem || 0)) + '</dd></dl></div>' +
      '<div class="pblk"><p class="ey">Stato ' + UI.i('progressEntry') + '</p><dl class="kv"><dt><label><input type="checkbox" data-c="af" data-k="started"' + (a.as ? ' checked' : '') + dis('progress') + '> Started</label></dt><dd>' + (a.as ? '<input class="inp sm" type="date" value="' + a.as + '" data-c="af" data-k="as"' + dis('progress') + ' aria-label="Inizio reale">' : '<span class="muted">-</span>') + '</dd><dt><label><input type="checkbox" data-c="af" data-k="finished"' + (a.af ? ' checked' : '') + dis('progress') + (a.as ? '' : ' disabled') + '> Finished</label></dt><dd>' + (a.af ? '<input class="inp sm" type="date" value="' + a.af + '" data-c="af" data-k="af"' + dis('progress') + ' aria-label="Fine reale">' : '<span class="muted">da compilare</span>') + '</dd><dt>' + PT[a.pctType || 'phys'] + ' %</dt><dd>' + (byCalc ? '<b>' + U.pct(pct) + '</b> <span class="muted small">calcolata</span>' : '<input class="inp xs" type="number" min="0" max="100" step="0.01" value="' + (Number(a.pct) || 0) + '" data-c="af" data-k="pct"' + dis('progress') + ' aria-label="Percentuale">') + '</dd></dl></div>' +
      '<div class="pblk"><p class="ey">Vincolo e float ' + UI.i('constraint') + '</p><dl class="kv"><dt>Vincolo primario</dt><dd><select class="inp sm" data-c="af" data-k="cstrT"' + dis() + '>' + opt([['', 'nessuno']].concat(Object.entries(CPM.CSTR)), cstr.t || '') + '</select></dd>' + (cstr.t && cstr.t !== 'ALAP' ? '<dt>Data vincolo</dt><dd><input class="inp sm" type="date" value="' + (cstr.d || '') + '" data-c="af" data-k="cstrD"' + dis() + '></dd>' : '') + '<dt>Total float</dt><dd class="' + (r.tf < 0 ? 'neg' : '') + '">' + (r.tf === null || r.tf === undefined ? '-' : U.int(r.tf)) + '</dd><dt>Free float</dt><dd>' + (r.ff === null || r.ff === undefined ? '-' : U.int(r.ff)) + '</dd><dt>Sul Longest Path</dt><dd>' + (r.dist === 0 ? 'sì' : r.dist === null || r.dist === undefined ? '-' : 'no (' + U.int(r.dist) + ' g)') + '</dd><dt>Percorso critico</dt><dd>' + (r.crit ? '<i class="pdot" style="background:' + VH.pathColor(r.path) + '"></i>P' + r.paths.join(', P') : r.sub ? 'sub-critica' : 'no') + '</dd></dl></div>' +
      '<div class="pblk why"><p class="ey">Perché è qui ' + UI.i('driverType') + '</p><p>' + esc(r.why || 'Non ancora schedulata: lancia F9.') + '</p>' + (r.margin ? '<p class="small">Margine sul secondo vincolo: <b>' + r.margin.days + ' g</b> (' + esc(r.margin.by) + ').</p>' : '') + '<p class="small muted">Prima la spunta, poi la data. Le date reali devono stare entro la data date (' + U.fd(ctx.p.dataDate) + '), le rimanenti dopo.' + (S.ui.trace.on ? ' In Traccia le modifiche vanno in anteprima.' : '') + '</p></div></div>';
  }

  function tabRisorse(ctx, a) {
    const res = S.db.resources.filter((r) => !r.group);
    const rows = (a.assign || []).map((x, i) => {
      const r = S.res(x.resId) || {}; const pr = Number(x.price !== undefined ? x.price : r.price) || 0;
      const atc = (x.act || 0) + (x.rem || 0);
      return '<tr><td><select class="inp sm" data-c="asg" data-i="' + i + '" data-k="resId"' + dis() + '>' + opt(res.map((y) => [y.id, y.name]), x.resId) + '</select></td><td>' + esc(r.type || '') + '</td><td class="n"><input class="inp xs" type="number" step="0.01" value="' + (x.upd || 0) + '" data-c="asg" data-i="' + i + '" data-k="upd"' + dis() + '> ' + esc(r.unit || 'h') + '/g</td><td class="n"><input class="inp xs" type="number" step="0.01" value="' + (x.bud || 0) + '" data-c="asg" data-i="' + i + '" data-k="bud"' + dis() + '></td><td class="n"><input class="inp xs" type="number" step="0.01" value="' + (x.act || 0) + '" data-c="asg" data-i="' + i + '" data-k="act"' + dis('progress') + '></td><td class="n"><input class="inp xs" type="number" step="0.01" value="' + (x.rem || 0) + '" data-c="asg" data-i="' + i + '" data-k="rem"' + dis('progress') + '></td><td class="n ' + (atc > (x.bud || 0) + 0.01 ? 'neg' : '') + '">' + U.num(atc, 0) + '</td><td class="n">' + U.eur(pr) + '</td><td class="n">' + U.eur((x.bud || 0) * pr) + '</td><td><select class="inp sm" data-c="asg" data-i="' + i + '" data-k="curve"' + dis() + '>' + opt(Object.entries(M.Costs.CURVES).map(([k, v]) => [k, v.name]).concat((S.db.curves || []).map((c) => [c.id, c.name])), x.curve || 'uniform') + '</select></td><td>' + (S.can('schedule') ? '<button type="button" class="ibx" data-a="asgDel" data-i="' + i + '" aria-label="Rimuovi assegnazione">' + UI.ic('trash', 16) + '</button>' : '') + '</td></tr>';
    });
    return '<div class="pane col">' + UI.table(['Risorsa', 'Tipo', { t: 'Units/Time', n: 1 }, { t: 'Budgeted', n: 1 }, { t: 'Actual', n: 1 }, { t: 'Remaining', n: 1 }, { t: 'At completion', n: 1 }, { t: 'Prezzo', n: 1 }, { t: 'Costo budget', n: 1 }, 'Curva', ''], rows, { empty: 'Nessuna risorsa assegnata' }) + '<div class="acts">' + (S.can('schedule') ? '<button type="button" class="btn sm" data-a="asgAdd">' + UI.ic('plus', 16) + 'Assegna risorsa</button>' : '') + '<a class="btn sm" href="#/risorse">Apri in Risorse</a>' + UI.i('assignments') + '<span class="help">Tipo di durata: <b>' + DT[a.durType || 'FDU'] + '</b>. Cambiando durata, unità o ritmo Meridian ricalcola la grandezza non fissa.</span></div></div>';
  }

  function relTable(ctx, a, dir) {
    const list = ctx.p.rels.filter((r) => (dir === 'pred' ? r.succ === a.id : r.pred === a.id));
    const rows = list.map((r) => {
      const o = ctx.byId.get(dir === 'pred' ? r.pred : r.succ) || {};
      const rr = ctx.s.rels && ctx.s.rels[r.id];
      return '<tr><td><button type="button" class="lnk mono" data-a="selRow" data-id="' + esc(o.id) + '">' + esc(o.code) + '</button></td><td>' + esc(o.name) + '</td><td><select class="inp xs" data-c="rel" data-id="' + r.id + '" data-k="type"' + dis() + '>' + opt([['FS', 'FS'], ['SS', 'SS'], ['FF', 'FF'], ['SF', 'SF']], r.type) + '</select></td><td class="n"><input class="inp xs" type="number" value="' + (r.lag || 0) + '" data-c="rel" data-id="' + r.id + '" data-k="lag"' + dis() + ' aria-label="Lag"></td><td class="n">' + (rr && rr.rf !== null && rr.rf !== undefined ? U.int(rr.rf) : '') + '</td><td>' + (rr && rr.driving ? '<span class="chip bad">sì</span>' : 'no') + '</td><td>' + (S.can('schedule') ? '<button type="button" class="ibx" data-a="relDel" data-id="' + r.id + '" aria-label="Elimina legame">' + UI.ic('trash', 16) + '</button>' : '') + '</td></tr>';
    });
    return UI.table(['ID', 'Nome', 'Tipo', { t: 'Lag', n: 1 }, { t: 'Margine', n: 1 }, 'Spingente', ''], rows, { empty: dir === 'pred' ? 'Nessun predecessore' : 'Nessun successore' }) + (S.can('schedule') ? '<div class="acts"><input class="inp sm" id="reladd-' + dir + '" placeholder="' + (dir === 'pred' ? 'Es. A1010 FS+2' : 'Es. A1040 SS+5') + '" aria-label="Nuovo ' + (dir === 'pred' ? 'predecessore' : 'successore') + '"><button type="button" class="btn sm" data-a="relAdd" data-dir="' + dir + '">' + UI.ic('plus', 16) + 'Aggiungi</button></div>' : '');
  }
  function tabLegami(ctx, a) { return '<div class="pane"><div class="pblk wide"><p class="ey">Predecessori ' + UI.i('relTypes') + '</p>' + relTable(ctx, a, 'pred') + '</div><div class="pblk wide"><p class="ey">Successori</p>' + relTable(ctx, a, 'succ') + '</div></div>'; }

  function tabCosti(ctx, a) {
    const c = M.Costs.actCost(a, S.db);
    const comps = [...new Set(S.db.projects.flatMap((p) => p.activities.flatMap((x) => (x.costs || []).map((l) => l.company))).filter(Boolean))].sort();
    const mats = [...new Set(S.db.projects.flatMap((p) => p.activities.flatMap((x) => (x.costs || []).map((l) => l.mat))).filter(Boolean))].sort();
    const dc = M.Costs.doubleCount({ activities: [a] }, S.db);
    const cd = dis('cost');
    const rows = (a.costs || []).map((l, i) => {
      const amt = M.Costs.lineAmount(l);
      const I = (k, v, t, w) => '<input class="inp ' + (w || 'sm') + '"' + (t ? ' type="' + t + '" step="0.01"' : '') + ' value="' + esc(v === undefined || v === null ? '' : v) + '" data-c="cl" data-i="' + i + '" data-k="' + k + '"' + (k === 'company' ? ' list="dl-comp"' : k === 'mat' ? ' list="dl-mat"' : '') + cd + ' aria-label="' + k + '">';
      return '<tr><td>' + I('company', l.company) + '</td><td>' + I('desc', l.desc, '', 'md') + '</td><td>' + I('mat', l.mat) + '</td><td>' + I('um', l.um, '', 'xs') + '</td><td class="n">' + I('qty', l.qty, 'number', 'xs') + '</td><td class="n">' + I('unit', l.unit, 'number', 'xs') + '</td><td class="n"><b>' + U.num(amt) + '</b></td><td class="n">' + I('qtyDone', l.qtyDone, 'number', 'xs') + '</td><td class="n">' + I('actual', l.actual, 'number', 'xs') + '</td><td><select class="inp sm" data-c="cl" data-i="' + i + '" data-k="dist"' + cd + '>' + opt(Object.entries(M.Costs.DIST).concat((S.db.curves || []).map((x) => [x.id, x.name])), l.dist || 'linear') + '</select></td><td><select class="inp sm" data-c="cl" data-i="' + i + '" data-k="kind"' + cd + '>' + opt(['Materiale', 'Subappalto', 'Nolo', 'Servizio', 'Spesa'].map((x) => [x, x]), l.kind || 'Materiale') + '</select></td><td><select class="inp sm" data-c="cl" data-i="' + i + '" data-k="cbs"' + cd + '>' + opt([['', '-']].concat((S.db.costAccounts || []).map((x) => [x.id, x.code])), l.cbs || '') + '</select></td><td><label class="ck"><input type="checkbox" data-c="cl" data-i="' + i + '" data-k="withLabor"' + (l.withLabor ? ' checked' : '') + cd + '> sì</label></td><td>' + (S.can('cost') ? '<button type="button" class="ibx" data-a="clDel" data-i="' + i + '" aria-label="Elimina riga">' + UI.ic('trash', 16) + '</button>' : '') + '</td></tr>';
    });
    return '<div class="pane col"><datalist id="dl-comp">' + comps.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist><datalist id="dl-mat">' + mats.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>' +
      '<div class="kpis sm"><div class="kpi"><p class="ey">Budget attività</p><div class="v">' + U.eur(c.bud) + '</div><p>risorse ' + U.eur(c.budRes) + ', righe ' + U.eur(c.budLines) + '</p></div><div class="kpi"><p class="ey">Consuntivo</p><div class="v">' + U.eur(c.act) + '</div></div><div class="kpi"><p class="ey">Rimanente</p><div class="v">' + U.eur(c.rem) + '</div></div><div class="kpi"><p class="ey">A finire</p><div class="v ' + (c.atc > c.bud ? 'neg' : '') + '">' + U.eur(c.atc) + '</div></div></div>' +
      UI.table(['Impresa', 'Descrizione lavoro', 'Materiale', 'UM', { t: 'Quantità', n: 1 }, { t: 'Costo unit.', n: 1 }, { t: 'Importo', n: 1 }, { t: 'Q.tà eseguita', n: 1 }, { t: 'Consuntivo €', n: 1 }, 'Distribuzione', 'Natura', 'Conto', 'Con manodopera', ''], rows, { empty: 'Nessuna riga di costo', cls: 'compact' }) +
      (dc.length ? '<p class="warnbox">' + UI.ic('alert', 16) + ' Possibile doppio conteggio: ' + dc.map((x) => esc(x.res.name)).join(', ') + ' con prezzo su un\'attività che ha un subappalto comprensivo di manodopera. ' + UI.i('doubleCount', true) + '</p>' : '') +
      '<div class="acts">' + (S.can('cost') ? '<button type="button" class="btn sm" data-a="clAdd">' + UI.ic('plus', 16) + 'Riga di costo</button><button type="button" class="btn sm" data-a="pasteCosts">' + UI.ic('paste', 16) + 'Incolla righe da Excel</button>' : '') + UI.i('costLines') + '<span class="help">Con tipo % "Quantità" le quantità eseguite calcolano la % fisica dell\'attività.</span></div></div>';
  }

  function tabCodici(ctx, a) {
    return '<div class="pane"><div class="pblk"><p class="ey">Codici attività ' + UI.i('codes') + '</p><dl class="kv">' + (S.db.codeTypes || []).map((t) => '<dt>' + esc(t.id + ' - ' + t.name) + '</dt><dd><select class="inp sm" data-c="acode" data-t="' + t.id + '"' + dis() + '>' + opt([['', '-']].concat(t.values.map((v) => [v.code, v.code + ' ' + v.desc])), (a.codes || {})[t.id] || '') + '</select></dd>').join('') + '</dl></div><div class="pblk"><p class="ey">Campi personalizzati (UDF) ' + UI.i('udf') + '</p><dl class="kv">' + (S.db.udfTypes || []).map((t) => { const v = (a.udf || {})[t.id]; return '<dt>' + esc(t.name) + '</dt><dd>' + (t.type === 'indicator' ? '<select class="inp sm" data-c="audf" data-t="' + t.id + '"' + dis() + '>' + opt([['', '-'], ['Verde', 'Verde'], ['Giallo', 'Giallo'], ['Rosso', 'Rosso']], v || '') + '</select>' + (v ? ' <span class="chip ' + ({ Verde: 'ok', Giallo: 'warn', Rosso: 'bad' })[v] + '">' + esc(v) + '</span>' : '') : '<input class="inp sm" ' + (t.type === 'number' || t.type === 'cost' ? 'type="number" step="0.01"' : t.type === 'date' ? 'type="date"' : '') + ' value="' + esc(v === undefined || v === null ? '' : v) + '" data-c="audf" data-t="' + t.id + '"' + dis() + '>' + (t.unit ? ' ' + esc(t.unit) : '')) + '</dd>'; }).join('') + '</dl></div></div>';
  }

  function tabPassi(ctx, a) {
    const st = a.steps || [];
    const W = U.sum(st, (s) => s.w);
    const rows = st.map((s, i) => '<tr><td><input class="inp md" value="' + esc(s.name) + '" data-c="step" data-i="' + i + '" data-k="name"' + dis() + '></td><td class="n"><input class="inp xs" type="number" value="' + s.w + '" data-c="step" data-i="' + i + '" data-k="w"' + dis() + '></td><td class="n"><input class="inp xs" type="number" min="0" max="100" value="' + (s.pct || 0) + '" data-c="step" data-i="' + i + '" data-k="pct"' + dis('progress') + '></td><td>' + (S.can('schedule') ? '<button type="button" class="ibx" data-a="stepDel" data-i="' + i + '" aria-label="Elimina step">' + UI.ic('trash', 16) + '</button>' : '') + '</td></tr>');
    if (st.length) rows.push('<tr class="tot"><td><b>Physical % (media pesata)</b></td><td class="n"><b>' + U.int(W) + '</b></td><td class="n"><b>' + U.pct(W ? U.sum(st, (s) => s.w * (s.pct || 0)) / W : 0) + '</b></td><td></td></tr>');
    return '<div class="pane col">' + UI.table(['Step', { t: 'Peso', n: 1 }, { t: '% completato', n: 1 }, ''], rows, { empty: 'Nessuno step' }) + '<div class="acts">' + (S.can('schedule') ? '<button type="button" class="btn sm" data-a="stepAdd">' + UI.ic('plus', 16) + 'Step</button><label class="sw"><input type="checkbox" data-c="af" data-k="stepsDrive"' + (a.stepsDrive !== false ? ' checked' : '') + '> La % fisica è calcolata dagli step</label>' : '') + UI.i('steps') + '</div></div>';
  }

  function tabTavole(ctx, a) {
    const lastF9 = ctx.s.ranAt ? ctx.s.ranAt.slice(0, 10) : '';
    const reg = ctx.p.drawings || [];
    return '<div class="pane col"><p class="help">Tavole di progetto a cui si riferisce l\'attività. Il registro completo è in Struttura, scheda Registro tavole. ' + UI.i('drawings') + '</p>' + UI.table(['', 'Codice', 'Titolo', 'Rev.', 'Data', 'Stato', 'Link'], reg.map((d) => { const on = (a.drawings || []).includes(d.id); const chg = (d.changedAt || d.date) > lastF9; return '<tr><td><input type="checkbox" data-c="adraw" value="' + d.id + '"' + (on ? ' checked' : '') + dis() + ' aria-label="Collega ' + esc(d.code) + '"></td><td class="mono">' + esc(d.code) + '</td><td>' + esc(d.title) + '</td><td class="mono">' + esc(d.rev) + '</td><td>' + U.fd(d.date) + '</td><td>' + (chg ? '<span class="chip warn">Nuova revisione dopo l\'ultimo F9</span>' : '') + '</td><td>' + (d.link ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener">apri</a>' : '<span class="muted">-</span>') + '</td></tr>'; }), { empty: 'Registro tavole vuoto' }) + '</div>';
  }

  function tabNote(ctx, a) {
    const list = (a.notes || []).slice().reverse();
    return '<div class="pane col"><div class="notes">' + (list.length ? list.map((n) => '<div class="note"><b>' + esc(n.by || '') + '</b> <span class="muted small">' + U.fts(n.at) + (n.period ? ' - periodo ' + esc(((S.db.periods || []).find((p) => p.id === n.period) || {}).name || '') : '') + '</span><p>' + esc(n.text) + '</p></div>').join('') : '<p class="muted">Nessuna nota.</p>') + '</div>' + (S.can('progress') || S.can('schedule') ? '<label class="fld">Nuova nota ' + UI.i('notesAct') + '<textarea class="inp" rows="2" id="note-new" placeholder="Es. getto rinviato per maltempo"></textarea></label><div class="acts"><button type="button" class="btn sm" data-a="noteAdd">Aggiungi nota</button></div>' : '') + '</div>';
  }

  M.Views.detail = {
    render(ctx) {
      const a = cur(ctx.p);
      if (!a) return '<section class="card"><p class="muted">Seleziona un\'attività per vederne i dettagli.</p></section>';
      const r = ctx.s.acts[a.id];
      const tab = TABS.includes(S.ui.detailTab) ? S.ui.detailTab : 'Generale';
      const fn = { Generale: tabGenerale, Stato: tabStato, Risorse: tabRisorse, Legami: tabLegami, Costi: tabCosti, Codici: tabCodici, Passi: tabPassi, Tavole: tabTavole, Note: tabNote }[tab];
      return '<section class="card pad0 detail" aria-labelledby="det-t"><div class="det-h"><h2 id="det-t"><span class="mono acc">' + esc(a.code) + '</span> ' + esc(a.name) + '</h2>' + VH.statusChip(a, r) + (r && r.why ? '<span class="muted small why1">' + esc(r.why) + '</span>' : '') + '</div><div class="tabs" role="tablist" aria-label="Dettagli attività">' + TABS.map((t) => '<button type="button" class="tab' + (t === tab ? ' on' : '') + '" role="tab" aria-selected="' + (t === tab) + '" data-a="detTab" data-t="' + t + '">' + t + (t === 'Risorse' && (a.assign || []).length ? ' <em class="cnt">' + a.assign.length + '</em>' : t === 'Costi' && (a.costs || []).length ? ' <em class="cnt">' + a.costs.length + '</em>' : t === 'Note' && (a.notes || []).length ? ' <em class="cnt">' + a.notes.length + '</em>' : t === 'Tavole' && (a.drawings || []).length ? ' <em class="cnt">' + a.drawings.length + '</em>' : '') + '</button>').join('') + '</div>' + fn(ctx, a) + '</section>';
    }
  };

  /* applica una modifica all'attività selezionata */
  function edit(fn, o) {
    o = o || {};
    const opts = Object.assign({ preview: !!S.ui.trace.on && o.affects !== false }, o);
    S.mutate((w) => { const a = w.activities.find((x) => x.id === S.ui.sel); if (a) fn(a, w); }, opts);
  }
  function recalcAssign(a, what, x) {
    const dt = a.durType || 'FDU';
    const dur = a.as && !a.af ? (a.rd !== undefined ? a.rd : a.od) : a.od;
    if (what === 'od') { (a.assign || []).forEach((y) => { if (a.as) return; if (dt === 'FDU' || dt === 'FR') { y.bud = U.round2((y.upd || 0) * (a.od || 0)); y.rem = U.round2(y.bud - (y.act || 0)); } else if (a.od) { y.upd = U.round2((y.bud || 0) / a.od); } }); }
    if (what === 'upd' && x) { if (dt === 'FDU' || dt === 'FDQ') { if (!a.as) { x.bud = U.round2((x.upd || 0) * (a.od || 0)); x.rem = U.round2(x.bud - (x.act || 0)); } else x.rem = U.round2((x.upd || 0) * (dur || 0)); } else if (x.upd) { const d = Math.ceil((a.as ? x.rem : x.bud) / x.upd); if (a.as) a.rd = d; else a.od = d; } }
    if (what === 'bud' && x) { if (dt === 'FDU' || dt === 'FDQ') { if (a.od) x.upd = U.round2(x.bud / a.od); x.rem = U.round2(x.bud - (x.act || 0)); } else if (x.upd) { a.od = Math.ceil(x.bud / x.upd); x.rem = U.round2(x.bud - (x.act || 0)); } }
  }

  Object.assign(M.A, {
    detTab(el) { S.ui.detailTab = el.getAttribute('data-t'); S.saveUi(); M.App.render(true); },
    actDel() {
      const a = cur(S.P()); if (!a) return;
      UI.confirm('Eliminare ' + a.code + '?', 'L\'attività e i suoi legami verranno eliminati. ' + (S.S().recalcMode === 'preview' ? 'La modifica va in anteprima.' : 'Puoi annullare con Ctrl+Z.'), 'Elimina', () => {
        S.mutate((w) => { w.activities = w.activities.filter((x) => x.id !== a.id); w.rels = w.rels.filter((r) => r.pred !== a.id && r.succ !== a.id); });
        S.ui.sel = null; S.saveUi(); M.App.render(true);
      }, true);
    },
    actDup() {
      const a = cur(S.P()); if (!a) return;
      S.mutate((w) => { const n = U.clone(w.activities.find((x) => x.id === a.id)); const base = VH.newActivity(w); n.id = U.uid('a'); n.code = base.code; n.name = a.name + ' (copia)'; delete n.as; delete n.af; delete n.rd; n.pct = 0; (n.assign || []).forEach((x) => { x.id = U.uid('as'); x.act = 0; x.rem = x.bud; }); (n.costs || []).forEach((l) => { l.id = U.uid('c'); l.qtyDone = 0; l.actual = 0; }); n.notes = []; w.activities.push(n); S.ui.sel = n.id; });
      UI.toast('Attività duplicata senza avanzamento.', 'ok');
    },
    asgAdd() { edit((a) => { const r = S.db.resources.find((x) => !x.group); a.assign = a.assign || []; const bud = U.round2((r.defUpd || 8) * (a.od || 0)); a.assign.push({ id: U.uid('as'), resId: r.id, upd: r.defUpd || 8, bud, act: 0, rem: bud, curve: 'uniform' }); }, { affects: false }); },
    asgDel(el) { const i = Number(el.getAttribute('data-i')); edit((a) => { a.assign.splice(i, 1); }, { affects: false }); },
    clAdd() { edit((a) => { a.costs = a.costs || []; a.costs.push({ id: U.uid('c'), company: '', desc: 'Nuova riga', mat: '', um: 'a corpo', qty: 1, unit: 0, qtyDone: 0, actual: 0, dist: 'linear', kind: 'Materiale', cbs: '' }); }, { affects: false, cap: 'cost' }); },
    clDel(el) { const i = Number(el.getAttribute('data-i')); edit((a) => { a.costs.splice(i, 1); }, { affects: false, cap: 'cost' }); },
    pasteCosts() { M.Paste.open('', 'costs'); },
    stepAdd() { edit((a) => { a.steps = a.steps || []; a.steps.push({ name: 'Nuovo step', w: 10, pct: 0 }); }, { affects: false }); },
    stepDel(el) { const i = Number(el.getAttribute('data-i')); edit((a) => { a.steps.splice(i, 1); }, { affects: false }); },
    relAdd(el) {
      const dir = el.getAttribute('data-dir'); const inp = U.$('#reladd-' + dir); const p = S.P(); const a = cur(p);
      const t = inp.value.trim(); if (!t) return;
      const parsed = VH.parseRels(t, p, a.id);
      if (parsed.errs.length) { UI.toast(parsed.errs.join('; '), 'warn'); return; }
      S.mutate((w) => { parsed.rels.forEach((r) => { const rel = dir === 'pred' ? { id: U.uid('r'), pred: r.pred, succ: a.id, type: r.type, lag: r.lag } : { id: U.uid('r'), pred: a.id, succ: r.pred, type: r.type, lag: r.lag }; if (!w.rels.some((x) => x.pred === rel.pred && x.succ === rel.succ)) w.rels.push(rel); }); }, { preview: !!S.ui.trace.on });
    },
    relDel(el) { const id = el.getAttribute('data-id'); S.mutate((w) => { w.rels = w.rels.filter((r) => r.id !== id); }, { preview: !!S.ui.trace.on }); },
    noteAdd() { const t = (U.$('#note-new') || {}).value; if (!t) return; const per = (S.db.periods || []).find((x) => U.dnOf(x.start) <= U.dnOf(S.P().dataDate) && U.dnOf(x.end) >= U.dnOf(S.P().dataDate)); edit((a) => { a.notes = a.notes || []; a.notes.push({ at: U.nowStamp(), by: S.user().name, text: t, period: per ? per.id : '' }); }, { affects: false, cap: S.can('schedule') ? 'schedule' : 'progress' }); }
  });

  Object.assign(M.C, {
    af(el) {
      const k = el.getAttribute('data-k'); const v = el.type === 'checkbox' ? el.checked : el.value;
      const p = S.P(); const a0 = cur(p); if (!a0) return;
      if (k === 'code') { const c = String(v).trim(); if (!c) { UI.toast('L\'ID non può essere vuoto.', 'warn'); M.App.render(true); return; } if (p.activities.some((x) => x.code === c && x.id !== a0.id)) { UI.toast('ID ' + c + ' già usato.', 'warn'); M.App.render(true); return; } }
      const DD = U.dnOf(p.dataDate);
      if (k === 'as' && v && U.dnOf(v) > DD) UI.toast('Attenzione: inizio reale dopo la data date ' + U.fd(DD) + '.', 'warn');
      if (k === 'af' && v && U.dnOf(v) > DD) UI.toast('Attenzione: fine reale dopo la data date ' + U.fd(DD) + '.', 'warn');
      if (k === 'af' && v && a0.as && U.dnOf(v) < U.dnOf(a0.as)) { UI.toast('La fine reale non può precedere l\'inizio reale.', 'bad'); M.App.render(true); return; }
      const progressKeys = ['started', 'finished', 'as', 'af', 'rd', 'pct'];
      const cap = progressKeys.includes(k) && !S.can('schedule') ? 'progress' : 'schedule';
      const affects = !['name', 'obs', 'pctType', 'stepsDrive'].includes(k);
      edit((a) => {
        if (k === 'od') { a.od = Math.max(0, Number(v) || 0); recalcAssign(a, 'od'); }
        else if (k === 'rd') a.rd = Math.max(0, Number(v) || 0);
        else if (k === 'pct') a.pct = U.clamp(Number(v) || 0, 0, 100);
        else if (k === 'started') { if (v) { a.as = a.as || U.isoOf(Math.min(DD, (p.sched && p.sched.acts[a.id] ? p.sched.acts[a.id].es : DD))); if (a.rd === undefined) a.rd = a.od; } else { delete a.as; delete a.af; delete a.rd; } }
        else if (k === 'finished') { if (v) { a.af = a.af || U.isoOf(DD); a.rd = 0; a.pct = 100; } else { delete a.af; if (!a.rd) a.rd = 1; } }
        else if (k === 'as' || k === 'af') { if (v) a[k] = v; }
        else if (k === 'cstrT') { if (!v) delete a.cstr; else a.cstr = { t: v, d: (a.cstr && a.cstr.d) || U.isoOf(DD + 1) }; }
        else if (k === 'cstrD') { a.cstr = a.cstr || { t: 'SNET' }; a.cstr.d = v; }
        else if (k === 'calId') { if (v) a.calId = v; else delete a.calId; }
        else if (k === 'stepsDrive') a.stepsDrive = !!v;
        else if (k === 'type') { a.type = v; if (CPM.isMile(a)) a.od = 0; }
        else a[k] = v;
      }, { cap, affects });
    },
    asg(el) {
      const i = Number(el.getAttribute('data-i')), k = el.getAttribute('data-k'), v = el.value;
      const cap = (k === 'act' || k === 'rem') && !S.can('schedule') ? 'progress' : 'schedule';
      edit((a) => { const x = a.assign[i]; if (!x) return; if (k === 'resId' || k === 'curve') x[k] = v; else { x[k] = Number(v) || 0; if (k === 'upd' || k === 'bud') recalcAssign(a, k, x); if (k === 'act' && !a.as) { /* nessuna data reale: le ore restano a budget */ } } }, { cap, affects: k === 'upd' || k === 'bud' ? ['FR', 'FQ'].includes((cur(S.P()) || {}).durType) : false });
    },
    cl(el) {
      const i = Number(el.getAttribute('data-i')), k = el.getAttribute('data-k');
      const v = el.type === 'checkbox' ? el.checked : ['qty', 'unit', 'qtyDone', 'actual'].includes(k) ? Number(el.value) || 0 : el.value;
      edit((a) => { const l = a.costs[i]; if (l) l[k] = v; }, { cap: k === 'qtyDone' && !S.can('cost') ? 'progress' : 'cost', affects: false });
    },
    rel(el) {
      const id = el.getAttribute('data-id'), k = el.getAttribute('data-k');
      S.mutate((w) => { const r = w.rels.find((x) => x.id === id); if (r) r[k] = k === 'lag' ? Number(el.value) || 0 : el.value; }, { preview: !!S.ui.trace.on });
    },
    acode(el) { const t = el.getAttribute('data-t'); edit((a) => { a.codes = a.codes || {}; if (el.value) a.codes[t] = el.value; else delete a.codes[t]; }, { affects: false }); },
    audf(el) { const t = el.getAttribute('data-t'); const def = (S.db.udfTypes || []).find((x) => x.id === t) || {}; edit((a) => { a.udf = a.udf || {}; a.udf[t] = def.type === 'number' || def.type === 'cost' ? (el.value === '' ? undefined : Number(el.value)) : el.value; }, { affects: false }); },
    step(el) { const i = Number(el.getAttribute('data-i')), k = el.getAttribute('data-k'); edit((a) => { const s = a.steps[i]; if (s) s[k] = k === 'name' ? el.value : Number(el.value) || 0; }, { affects: false, cap: k === 'pct' && !S.can('schedule') ? 'progress' : 'schedule' }); },
    adraw(el) { const id = el.value; edit((a) => { a.drawings = a.drawings || []; if (el.checked) { if (!a.drawings.includes(id)) a.drawings.push(id); } else a.drawings = a.drawings.filter((x) => x !== id); }, { affects: false }); }
  });
})(window.M = window.M || {});
