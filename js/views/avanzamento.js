/* Meridian - 06 Avanzamento: ciclo di aggiornamento, inserimento con validazione, approvazioni da campo, finestra, offline */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;
  const STEPS = ['Copia datata in BKG', 'Nuova data date', 'Dati dal cantiere', 'Schedula F9', 'Storicizza periodo', 'Confronto baseline'];

  const laborAct = (a) => U.sum((a.assign || []).filter((x) => { const r = S.res(x.resId); return r && r.type === 'Labor'; }), (x) => x.act || 0);
  const laborStored = (a) => U.sum((a.assign || []).filter((x) => { const r = S.res(x.resId); return r && r.type === 'Labor'; }), (x) => x.storedAct || 0);
  function periodOf(dn) { return (S.db.periods || []).find((f) => U.dnOf(f.start) <= dn && U.dnOf(f.end) >= dn); }

  /* controlli prima della conferma di un inserimento */
  function validate(p, a, v, DD) {
    const out = [];
    if (a.type === 'loe') { v = Object.assign({}, v, { rd: v.finished ? 0 : 1, pct: 0 }); }
    const as = v.as ? U.dnOf(v.as) : null, af = v.af ? U.dnOf(v.af) : null;
    if (v.started && !as) out.push({ lvl: 'bad', t: 'Spuntata come iniziata ma senza data di inizio reale' });
    if (as !== null && as > DD) out.push({ lvl: 'bad', t: 'Inizio reale ' + U.fd(as) + ' oltre la data date ' + U.fd(DD) });
    if (af !== null && af > DD) out.push({ lvl: 'bad', t: 'Fine reale ' + U.fd(af) + ' oltre la data date' });
    if (af !== null && as !== null && af < as) out.push({ lvl: 'bad', t: 'Fine reale prima dell\'inizio' });
    if (v.finished && !af) out.push({ lvl: 'bad', t: 'Spuntata come finita ma senza data di fine reale' });
    if (v.pct >= 100 && !v.finished) out.push({ lvl: 'warn', t: '% al 100 ma attività non finita' });
    if (v.finished && v.rd > 0) out.push({ lvl: 'warn', t: 'Finita ma con durata rimanente ' + v.rd + ' g' });
    if (!v.finished && v.started && v.rd === 0) out.push({ lvl: 'warn', t: 'Rimanente 0 ma non finita' });
    if (v.pct > 0 && !v.started) out.push({ lvl: 'bad', t: '% maggiore di zero su attività non iniziata' });
    if (v.started && as !== null) {
      (p.rels || []).filter((r) => r.succ === a.id).forEach((r) => {
        const pr = p.activities.find((x) => x.id === r.pred); if (!pr) return;
        if (r.type === 'FS' && (!pr.af || U.dnOf(pr.af) >= as) && pr.type !== 'start') out.push({ lvl: 'warn', t: 'Fuori sequenza: ' + pr.code + ' non era finita' });
        if (r.type === 'SS' && (!pr.as || U.dnOf(pr.as) > as)) out.push({ lvl: 'warn', t: 'Fuori sequenza: ' + pr.code + ' non era iniziata' });
      });
    }
    return out;
  }
  const curVals = (a) => ({ started: !!a.as, as: a.as || '', finished: !!a.af, af: a.af || '', pct: Number(a.pct) || 0, rd: a.af ? 0 : a.as ? (a.rd !== undefined ? a.rd : a.od) : a.od });

  /* finestra di inserimento da campo */
  function windowInfo(p, at) {
    const st = S.S().window || { before: 5, after: 3 };
    const t = at ? U.dnOf(at.slice(0, 10)) : U.todayDn();
    const DD = U.dnOf(p.dataDate);
    const next = U.dnOf(p.nextCutoff || U.isoOf(U.lastOfMonth(DD + 1)));
    const cut = Math.abs(t - DD) <= Math.abs(t - next) ? DD : next;
    const from = cut - st.before, to = cut + st.after;
    return { open: t >= from && t <= to, cut, from, to, today: t };
  }

  function stepper(p) {
    const cur = p.cycleStep || 1;
    return '<ol class="stepper" aria-label="Passi del ciclo di aggiornamento">' + STEPS.map((t, i) => { const n = i + 1; return '<li class="' + (n < cur ? 'done' : n === cur ? 'now' : '') + '"' + (n === cur ? ' aria-current="step"' : '') + '><button type="button" data-a="cycleGo" data-n="' + n + '"><span class="dot">' + (n < cur ? UI.ic('check', 14) : n) + '</span>' + esc(t) + '</button></li>'; }).join('') + '</ol>';
  }

  function stepPanel(ctx) {
    const p = ctx.p, cur = p.cycleStep || 1, can = S.can('approve');
    const DD = U.dnOf(p.dataDate);
    const per = periodOf(DD);
    if (cur === 1) return '<div class="stepbox"><p>Prima di aggiornare, salva una copia datata del programma corrente nel nodo BKG: servirà per il confronto cut-off contro cut-off.</p><button type="button" class="btn-p" data-a="cycleCopy"' + (can ? '' : ' disabled') + '>Crea copia ' + esc(p.work + '_' + p.dataDate) + '</button> <button type="button" class="btn" data-a="cycleNext">Già fatta, avanti</button></div>';
    if (cur === 2) { const next = p.nextCutoff || U.isoOf(U.lastOfMonth(DD + 1)); return '<div class="stepbox"><p>Sposta la data date alla fine del periodo da aggiornare. Data date attuale: <b>' + U.fd(DD) + '</b>.</p><label class="lbl">Nuova data date <input class="inp sm" type="date" id="cy-dd" value="' + next + '"></label> <button type="button" class="btn-p" data-a="cycleDD"' + (can ? '' : ' disabled') + '>Imposta</button> <button type="button" class="btn" data-a="cycleNext">Mantieni ' + U.fd(DD) + '</button></div>'; }
    if (cur === 3) { const pend = (p.progress || []).filter((x) => x.status === 'Inviato').length; return '<div class="stepbox"><p>Inserisci o approva i dati del cantiere alla data date. Inserimenti da campo in attesa: <b>' + pend + '</b>.</p><button type="button" class="btn-p" data-a="cycleNext">Dati completi, avanti</button></div>'; }
    if (cur === 4) return '<div class="stepbox"><p>Lancia F9 e leggi il log prima di andare avanti.</p><button type="button" class="btn-p" data-a="cycleF9"' + (S.can('schedule') ? '' : ' disabled') + '>Schedula F9</button> <a class="btn" href="#/schedula">Apri il log</a></div>';
    if (cur === 5) { const ok = per && U.dnOf(per.end) === DD && !p.dirty; return '<div class="stepbox"><p>Storicizza il periodo <b>' + esc(per ? per.name : '-') + '</b>: salva EV, AC, PV e le ore del periodo. ' + (ok ? '' : '<b class="neg">Si attiva dopo F9, quando data date e fine periodo coincidono.</b>') + '</p><button type="button" class="btn-p" data-a="storePeriod"' + (ok && can ? '' : ' disabled') + '>Storicizza ' + esc(per ? per.name : '') + '</button> ' + UI.i('storePeriod') + ' <button type="button" class="btn" data-a="cycleNext">Salta</button></div>'; }
    return '<div class="stepbox"><p>Confronta il programma aggiornato con la baseline e con il cut-off precedente, poi monitora le soglie.</p><a class="btn-p" href="#/controllo">Apri Baseline ed EV</a> <button type="button" class="btn" data-a="cycleRestart">Nuovo ciclo</button></div>';
  }

  function entryTable(ctx) {
    const p = ctx.p, DD = U.dnOf(p.dataDate);
    const canP = S.can('progress');
    const per = periodOf(DD);
    const pend = new Set((p.progress || []).filter((x) => x.status === 'Inviato').map((x) => x.actId));
    const list = p.activities.filter((a) => {
      if (a.type === 'wbs' || M.CPM.isMile(a) && a.af) return false;
      if (a.as && !a.af) return true;
      if (pend.has(a.id)) return true;
      const r = ctx.s.acts[a.id]; if (!r || a.af) return false;
      return r.es <= DD + 30 && r.es >= DD - 30;
    });
    let errs = 0;
    const rows = list.map((a) => {
      const v = curVals(a);
      const iss = validate(p, a, v, DD);
      const fieldE = (p.progress || []).find((x) => x.actId === a.id && x.status === 'Inviato');
      const fe = fieldE ? validate(p, a, Object.assign(curVals(a), fieldE.values, { finished: !!fieldE.values.af }), DD) : [];
      if (iss.some((x) => x.lvl === 'bad') || fe.some((x) => x.lvl === 'bad')) errs++;
      const loe = a.type === 'loe';
      const d = canP ? '' : ' disabled';
      const thisPer = laborAct(a) - laborStored(a);
      return '<tr><td><span class="mono">' + esc(a.code) + '</span> ' + esc(a.name) + '</td><td><label class="ck"><input type="checkbox" data-c="pe" data-id="' + esc(a.id) + '" data-k="started"' + (a.as ? ' checked' : '') + d + ' aria-label="' + esc(a.code) + ' iniziata"></label>' + (a.as ? '<input class="inp sm" type="date" value="' + a.as + '" data-c="pe" data-id="' + esc(a.id) + '" data-k="as"' + d + (U.dnOf(a.as) > DD ? ' aria-invalid="true"' : '') + ' aria-label="' + esc(a.code) + ' inizio reale">' : '') + '</td><td><label class="ck"><input type="checkbox" data-c="pe" data-id="' + esc(a.id) + '" data-k="finished"' + (a.af ? ' checked' : '') + (a.as ? d : ' disabled') + ' aria-label="' + esc(a.code) + ' finita"></label>' + (a.af ? '<input class="inp sm" type="date" value="' + a.af + '" data-c="pe" data-id="' + esc(a.id) + '" data-k="af"' + d + '>' : '') + '</td><td>' + (loe ? 'da legami' : (a.steps && a.steps.length && a.stepsDrive !== false) || a.pctType === 'qty' ? U.pct(M.Costs.actPct(a, ctx.s.acts[a.id], S.db)) + ' <span class="muted small">calc.</span>' : '<input class="inp xs" type="number" min="0" max="100" step="0.01" value="' + v.pct + '" data-c="pe" data-id="' + esc(a.id) + '" data-k="pct"' + d + ' aria-label="' + esc(a.code) + ' percentuale">') + '</td><td>' + (loe ? 'da legami' : '<input class="inp xs" type="number" min="0" value="' + (v.rd || 0) + '" data-c="pe" data-id="' + esc(a.id) + '" data-k="rd"' + (a.as && !a.af ? d : ' disabled') + ' aria-label="' + esc(a.code) + ' rimanente">') + '</td><td><input class="inp xs" type="number" min="0" value="' + U.round2(laborAct(a)) + '" data-c="pe" data-id="' + esc(a.id) + '" data-k="actH"' + ((a.assign || []).some((x) => (S.res(x.resId) || {}).type === 'Labor') ? d : ' disabled') + ' aria-label="' + esc(a.code) + ' ore effettive"></td><td><input class="inp xs" type="number" value="' + U.round2(thisPer) + '" data-c="pe" data-id="' + esc(a.id) + '" data-k="perH"' + ((a.assign || []).some((x) => (S.res(x.resId) || {}).type === 'Labor') ? d : ' disabled') + ' aria-label="' + esc(a.code) + ' ore del periodo"></td><td>' + (iss.length ? iss.map((x) => UI.chip(x.t, x.lvl)).join(' ') : UI.chip('Coerente', 'ok')) + (fieldE ? ' ' + UI.chip('inserimento da campo in attesa', fe.some((x) => x.lvl === 'bad') ? 'bad' : 'info') : '') + '</td></tr>';
    });
    return { html: UI.table(['Attività', 'Started', 'Finished', 'Physical %', 'Remaining (g)', 'Actual (h)', 'Questo periodo (h)', 'Verifica'], rows, { empty: 'Nessuna attività da aggiornare nel periodo' }), errs, per };
  }

  function fieldEntries(ctx) {
    const p = ctx.p, DD = U.dnOf(p.dataDate);
    const can = S.can('approve');
    const list = (p.progress || []).slice().sort((a, b) => (a.at < b.at ? 1 : -1));
    const outbox = S.outbox().filter((x) => x.projectId === p.id);
    const rows = list.map((e) => {
      const a = ctx.byId.get(e.actId); if (!a) return '';
      const v = Object.assign(curVals(a), e.values, { finished: !!e.values.af, started: e.values.started !== undefined ? e.values.started : !!e.values.as });
      const iss = validate(p, a, v, DD);
      const u = S.db.users.find((x) => x.id === e.by) || { name: e.by };
      const w = windowInfo(p, e.at);
      return '<tr><td><span class="mono">' + esc(a.code) + '</span> ' + esc(a.name) + '</td><td>' + esc(u.name) + '<br><span class="small muted">' + U.fts(e.at) + '</span></td><td class="small">' + (v.as ? 'inizio ' + U.fd(v.as) + '<br>' : '') + (v.af ? 'fine ' + U.fd(v.af) + '<br>' : '') + '% ' + U.num(v.pct) + ', rim. ' + (v.rd || 0) + ' g</td><td class="small">' + esc(e.note || '') + (e.photos && e.photos.length ? '<div class="thumbs">' + e.photos.map((ph) => '<img src="' + ph.src + '" alt="Foto del ' + U.fd(ph.date) + '" title="Foto del ' + U.fd(ph.date) + '">').join('') + '</div>' : '') + '</td><td>' + (w.open ? '' : UI.chip('fuori finestra: proposta', 'warn') + ' ') + (iss.length ? iss.map((x) => UI.chip(x.t, x.lvl)).join(' ') : UI.chip('Coerente', 'ok')) + '</td><td>' + UI.chip(e.status, e.status === 'Approvato' ? 'ok' : e.status === 'Respinto' ? 'bad' : e.status === 'Bozza' ? 'neutral' : 'info') + (e.reason ? '<br><span class="small">' + esc(e.reason) + '</span>' : '') + '</td><td>' + (e.status === 'Inviato' && can ? '<button type="button" class="btn sm" data-a="peApprove" data-id="' + e.id + '"' + (iss.some((x) => x.lvl === 'bad') ? ' disabled title="Correggi gli errori prima di approvare"' : '') + '>Approva</button><button type="button" class="btn sm" data-a="peReject" data-id="' + e.id + '">Respingi</button>' : '') + '</td></tr>';
    });
    const props = (p.proposals || []).map((x) => { const u = S.db.users.find((y) => y.id === x.by) || { name: x.by }; return '<tr><td>' + esc(x.kind) + '</td><td>' + esc(x.text) + '</td><td>' + esc(u.name) + '<br><span class="small muted">' + U.fts(x.at) + '</span></td><td>' + UI.chip(x.status, x.status === 'Approvata' ? 'ok' : x.status === 'Respinta' ? 'bad' : 'info') + '</td><td>' + (x.status === 'Inviata' && S.can('schedule') ? '<button type="button" class="btn sm" data-a="propApprove" data-id="' + x.id + '">Approva</button><button type="button" class="btn sm" data-a="propReject" data-id="' + x.id + '">Respingi</button>' : '') + '</td></tr>'; });
    return UI.card('Inserimenti da campo', UI.table(['Attività', 'Da', 'Valori', 'Note e foto', 'Controlli', 'Stato', ''], rows, { empty: 'Nessun inserimento da campo' }) + '<div class="acts">' + (can ? '<button type="button" class="btn-p sm" data-a="peApproveAll">Approva in blocco i coerenti</button>' : '') + (outbox.length ? '<span class="chip warn">' + outbox.length + ' in coda offline su questo dispositivo</span><button type="button" class="btn sm" data-a="syncOutbox">Sincronizza</button>' + UI.i('offline') : '') + '</div>', { info: 'approvals' }) +
      UI.card('Proposte di modifica dal campo', UI.table(['Tipo', 'Proposta', 'Da', 'Stato', ''], props, { empty: 'Nessuna proposta' }), { info: 'proposals' });
  }

  /* modulo da tablet per l'inserimento da campo */
  function fieldForm(ctx) {
    const p = ctx.p, DD = U.dnOf(p.dataDate);
    const w = windowInfo(p);
    const list = p.activities.filter((a) => !a.af && a.type !== 'wbs' && a.type !== 'loe' && !M.CPM.isMile(a)).filter((a) => { const r = ctx.s.acts[a.id]; return a.as || (r && r.es <= DD + 45); });
    const drafts = (p.progress || []).filter((x) => x.status === 'Bozza' && x.by === S.user().id);
    return '<div class="fieldhead">' + (w.open ? UI.chip('Finestra aperta fino al ' + U.fd(w.to), 'ok') : UI.chip('Finestra chiusa (' + U.fd(w.from) + ' - ' + U.fd(w.to) + '): gli inserimenti diventano proposte da approvare', 'warn')) + UI.i('window') + (navigator.onLine ? '' : UI.chip('Offline: gli inserimenti restano in coda', 'warn')) + '<span class="muted small">Cut-off ' + U.fd(w.cut) + ' - inserimenti come ' + esc(S.user().name) + '</span></div><div class="fcards">' + list.map((a) => {
      const d = drafts.find((x) => x.actId === a.id); const v = Object.assign(curVals(a), d ? d.values : {});
      return '<form class="fcard" data-id="' + esc(a.id) + '" onsubmit="return false"><h3><span class="mono">' + esc(a.code) + '</span> ' + esc(a.name) + '</h3><p class="small muted">' + (a.as ? 'In corso dal ' + U.fd(a.as) : 'Prevista dal ' + U.fd((ctx.s.acts[a.id] || {}).es)) + (d ? ' - bozza salvata' : '') + '</p>' +
        '<label class="tgl"><input type="checkbox" name="started"' + (v.started ? ' checked' : '') + '> Iniziata</label><label class="fld">Data inizio reale<input class="inp" type="date" name="as" value="' + esc(v.as || '') + '" max="' + U.isoOf(DD) + '"></label>' +
        '<label class="tgl"><input type="checkbox" name="finished"' + (v.finished ? ' checked' : '') + '> Finita</label><label class="fld">Data fine reale<input class="inp" type="date" name="af" value="' + esc(v.af || '') + '" max="' + U.isoOf(DD) + '"></label>' +
        '<div class="grid2"><label class="fld">% fisica<input class="inp" type="number" name="pct" min="0" max="100" step="1" value="' + v.pct + '" inputmode="decimal"></label><label class="fld">Giorni rimanenti<input class="inp" type="number" name="rd" min="0" value="' + (v.rd || 0) + '" inputmode="numeric"></label></div>' +
        '<label class="fld">Nota<textarea class="inp" name="note" rows="2" placeholder="Cosa è successo nel periodo">' + esc(d ? d.note || '' : '') + '</textarea></label><label class="fld">Foto<input class="inp" type="file" name="photo" accept="image/*" capture="environment"></label>' +
        '<div class="acts"><button type="button" class="btn" data-a="feDraft">Salva bozza</button><button type="button" class="btn-p" data-a="feCheck">Controlla e invia</button><button type="button" class="btn sm" data-a="fePropose">Proponi modifica</button></div></form>';
    }).join('') + '</div>';
  }

  M.Views.avanzamento = {
    title: 'Avanzamento',
    render() {
      const ctx = VH.ctx(); const p = ctx.p;
      const field = S.user().role === 'field' || S.ui.advTab === 'campo';
      const tab = field ? 'campo' : S.ui.advTab || 'inserimento';
      const DD = U.dnOf(p.dataDate);
      const et = entryTable(ctx);
      const per = et.per;
      const oos = (ctx.s.log || []).filter((l) => l.code === 'oos');
      const after = (ctx.s.log || []).filter((l) => l.code === 'actdd');
      const pend = (p.progress || []).filter((x) => x.status === 'Inviato').length;
      const bkg = S.projects((x) => x.status === 'BKG' && x.work === p.work && x.dataDate === p.dataDate).length > 0;
      const remBefore = p.activities.filter((a) => !a.af && ctx.s.acts[a.id] && ctx.s.acts[a.id].rs !== null && ctx.s.acts[a.id].rs !== undefined && ctx.s.acts[a.id].rs <= DD && ctx.s.acts[a.id].dur > 0).length;
      const autoOn = S.db.resources.some((r) => r.autoActuals);
      const checks = [[bkg || (p.cycleStep || 1) > 1, 'Copia datata nel nodo BKG con le baseline incluse'], [!after.length, after.length ? '<b>Date reali oltre la data date:</b> ' + after.map((l) => esc((ctx.byId.get(l.actId) || {}).code)).join(', ') : 'Date reali entro la data date'], [!remBefore, 'Date rimanenti dopo la data date'], [p.activities.filter((a) => a.as && !a.af).every((a) => (a.pctType || 'phys') !== 'dur'), 'Percentuali stimate in cantiere, non dal tempo trascorso'], [!autoOn, 'Auto Compute Actuals spento: con i Financial periods le ore del periodo si inseriscono a mano'], [!pend, pend ? '<b>' + pend + ' inserimenti da campo</b> in attesa di approvazione' : 'Nessun inserimento da campo in attesa']];
      const perH = U.sum(p.activities, (a) => laborAct(a) - laborStored(a));
      const tabs = '<div class="tabs" role="tablist">' + [['inserimento', 'Inserimento e approvazioni'], ['campo', 'Modulo da campo (tablet)']].map(([k, l]) => '<button type="button" class="tab' + (k === tab ? ' on' : '') + '" role="tab" aria-selected="' + (k === tab) + '" data-a="advTab" data-t="' + k + '"' + (S.user().role === 'field' && k !== 'campo' ? ' disabled' : '') + '>' + l + '</button>').join('') + '</div>';
      const head = '<div class="head"><div><p class="ey">' + esc(p.code) + ' - aggiornamento ' + (per ? esc(per.name) : '') + '</p><h1>Avanzamento ' + UI.i('cycle') + '</h1><p class="sub">Il ciclo di aggiornamento guidato: gli stessi passi a ogni cut-off, nello stesso ordine.</p></div><div class="acts"><button type="button" class="btn" data-a="pasteProgress">' + UI.ic('paste') + 'Importa foglio di cantiere</button></div></div>';
      if (tab === 'campo') return head + stepper(p) + tabs + UI.card('Inserimento da campo', fieldForm(ctx), { info: 'progressEntry' });
      return head + stepper(p) + UI.card('Passo ' + (p.cycleStep || 1) + ': ' + STEPS[(p.cycleStep || 1) - 1], stepPanel(ctx)) + tabs +
        UI.card('Attività da aggiornare nel periodo ' + (per ? U.fd(per.start) + ' - ' + U.fd(per.end) : ''), et.html + '<p class="help">Ordine di inserimento: spunta, data, percentuale, durata rimanente, ore. Actual e Questo periodo si aggiornano a vicenda. ' + (S.S().recalcMode === 'preview' ? 'In modalità Anteprima ogni inserimento ricalcola subito.' : 'Le date cambiano con F9.') + '</p>', { info: 'progressEntry', tools: UI.chip('In corso o previste entro 30 g dalla data date', 'info') + (et.errs ? UI.chip(et.errs + (et.errs === 1 ? ' errore' : ' errori'), 'bad') : UI.chip('nessun errore', 'ok')) }) +
        fieldEntries(ctx) +
        '<div class="row">' + UI.card('Controlli prima di F9', '<ul class="checks">' + checks.map(([ok, t]) => '<li class="' + (ok ? 'ok' : 'bad') + '">' + UI.ic(ok ? 'check' : 'alert', 16) + '<span>' + t + '</span></li>').join('') + '</ul><div class="acts"><button type="button" class="btn-p" data-a="f9">Schedula F9</button><button type="button" class="btn" data-a="storePeriod"' + (per && U.dnOf(per.end) === DD && !p.dirty && S.can('approve') && !per.stored ? '' : ' disabled') + '>Storicizza ' + esc(per ? per.name : '') + '</button></div><p class="help">Storicizza si attiva dopo F9, quando data date e fine periodo coincidono.</p>', { style: 'flex:1 1 360px' }) +
        UI.card('Financial period', '<dl class="kv"><dt>Calendario</dt><dd>' + esc(p.periodsCal || 'Mensile') + '</dd><dt>Periodo</dt><dd>' + (per ? esc(per.name) + ' (' + U.fd(per.start) + ' - ' + U.fd(per.end) + ')' : '-') + '</dd><dt>Stato</dt><dd>' + (per ? UI.chip(per.stored ? 'Storicizzato' : 'Da storicizzare', per.stored ? 'ok' : 'warn') : '-') + '</dd><dt>Ore del periodo</dt><dd>' + U.num(perH, 0) + ' h</dd><dt>Coincide con la data date</dt><dd>' + (per && U.dnOf(per.end) === DD ? 'sì' : 'no') + '</dd></dl><p class="help">Storicizza periodo salva i parziali e li azzera per il periodo successivo. Un periodo già usato non si può più dividere.</p>', { info: 'storePeriod', style: 'flex:1 1 300px' }) +
        UI.card('Fuori sequenza', (oos.length ? '<ul class="plain">' + oos.map((l) => '<li>' + esc(l.text) + '</li>').join('') + '</ul>' : '<p>Nessuna attività iniziata prima della fine del suo predecessore.</p>') + '<dl class="kv"><dt>Regola di calcolo</dt><dd>' + ({ retained: 'Retained Logic', override: 'Progress Override', actual: 'Actual Dates' })[S.S().oos] + '</dd></dl><a class="btn sm" href="#/schedula">Cambia nelle opzioni</a>', { info: 'oos', style: 'flex:1 1 280px' }) +
        UI.card('Note di periodo', (p.notes || []).slice().reverse().map((n) => '<div class="note"><b>' + esc(n.by) + '</b> <span class="small muted">' + U.fts(n.at) + '</span><p>' + esc(n.text) + '</p></div>').join('') + (S.can('progress') ? '<label class="fld">Nuova nota di periodo<textarea class="inp" id="pnote" rows="2"></textarea></label><div class="acts"><button type="button" class="btn sm" data-a="pNoteAdd">Aggiungi</button></div>' : ''), { style: 'flex:1 1 280px' }) + '</div>';
    },
    syncOutbox(auto) {
      const ob = S.outbox(); if (!ob.length) return;
      if (!navigator.onLine) { if (!auto) UI.toast('Ancora offline: la coda verrà sincronizzata al ritorno della rete.', 'warn'); return; }
      let n = 0;
      ob.forEach((e) => { const p = S.proj(e.projectId); if (!p) return; const w = windowInfo(p, e.at); p.progress = p.progress || []; p.progress.push(Object.assign({}, e.entry, { outOfWindow: !w.open, synced: U.nowStamp() })); n++; });
      S.setOutbox([]); S.save(); UI.toast(n + ' inserimenti sincronizzati e validati con l\'ora in cui sono stati fatti.', 'ok'); M.App.render(true);
    },
    validate, curVals, windowInfo
  };

  function readForm(form) {
    const f = (n) => form.querySelector('[name="' + n + '"]');
    const v = { started: f('started').checked, as: f('as').value, finished: f('finished').checked, af: f('af').value, pct: Number(f('pct').value) || 0, rd: Number(f('rd').value) || 0 };
    if (!v.started) { v.as = ''; v.pct = 0; }
    if (v.finished) { v.rd = 0; v.pct = 100; } else v.af = '';
    return { v, note: f('note').value, file: f('photo').files && f('photo').files[0] };
  }
  function shrink(file) {
    return new Promise((res) => {
      if (!file) { res(null); return; }
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 640 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.6)); };
      img.onerror = () => res(null); img.src = url;
    });
  }
  function saveEntry(form, status) {
    const id = form.getAttribute('data-id'); const r = readForm(form);
    return shrink(r.file).then((src) => {
      const entry = { id: U.uid('pg'), actId: id, by: S.user().id, at: U.nowStamp(), status, values: r.v, note: r.note, photos: src ? [{ src, date: U.isoOf(U.todayDn()) }] : [] };
      const p = S.confirmed();
      if (!navigator.onLine && status === 'Inviato') { const ob = S.outbox(); ob.push({ projectId: p.id, at: entry.at, entry }); S.setOutbox(ob); UI.toast('Sei offline: inserimento messo in coda. Verrà validato alla sincronizzazione.', 'warn'); M.App.render(true); return; }
      p.progress = (p.progress || []).filter((x) => !(x.status === 'Bozza' && x.actId === id && x.by === entry.by));
      const w = windowInfo(p);
      if (status === 'Inviato' && !w.open) entry.outOfWindow = true;
      p.progress.push(entry); S.save();
      UI.toast(status === 'Bozza' ? 'Bozza salvata.' : 'Inviato al pianificatore' + (entry.outOfWindow ? ' come proposta (fuori finestra).' : '.'), 'ok');
      M.App.render(true);
    });
  }
  function applyValues(a, v) {
    if (v.started) { a.as = v.as || a.as; } else { delete a.as; delete a.af; }
    if (v.finished && v.af) { a.af = v.af; a.rd = 0; a.pct = 100; } else { delete a.af; if (a.as) a.rd = v.rd; }
    if (v.pct !== undefined && !(a.steps && a.steps.length && a.stepsDrive !== false)) a.pct = v.pct;
  }

  Object.assign(M.A, {
    advTab(el) { S.ui.advTab = el.getAttribute('data-t'); S.saveUi(); M.App.render(); },
    cycleGo(el) { if (!S.can('approve')) return; const n = Number(el.getAttribute('data-n')); S.mutate((w) => { w.cycleStep = n; }, { affects: false, cap: 'approve' }); },
    cycleNext() { S.mutate((w) => { w.cycleStep = Math.min(6, (w.cycleStep || 1) + 1); }, { affects: false, cap: S.can('approve') ? 'approve' : 'progress' }); },
    cycleRestart() { S.mutate((w) => { w.cycleStep = 1; }, { affects: false, cap: 'approve' }); },
    cycleCopy() {
      const c = S.confirmed();
      const code = c.work + '_' + c.dataDate;
      const p = S.copyProject(S.P(), { code, name: (c.workName || '') + ' - cut-off ' + U.fd(c.dataDate), status: 'BKG', epsId: S.epsNodeFor(c.work, 'BKG') || c.epsId, savedAt: U.isoOf(U.todayDn()) });
      S.mutate((w) => { w.cycleStep = 2; w.baselines = w.baselines || {}; w.baselines.secondary = p.id; }, { affects: false, cap: 'approve' });
      UI.toast('Copia ' + p.code + ' salvata in BKG e assegnata come baseline Secondary per il confronto.', 'ok');
    },
    cycleDD() { const v = U.$('#cy-dd').value; if (!v) return; S.mutate((w) => { w.dataDate = v; w.cycleStep = 3; const nx = U.lastOfMonth(U.dnOf(v) + 1); w.nextCutoff = U.isoOf(nx); }); UI.toast('Data date impostata al ' + U.fd(v) + '.', 'ok'); },
    cycleF9() { M.A.f9(); const c = S.confirmed(); if (!c.dirty && !S.inPreview()) { c.cycleStep = 5; S.save(); M.App.render(true); } },
    storePeriod() {
      const ctx = VH.ctx(S.confirmed()); const p = ctx.p; const DD = U.dnOf(p.dataDate); const per = periodOf(DD);
      if (!per || U.dnOf(per.end) !== DD) { UI.toast('La data date deve coincidere con la fine del periodo.', 'warn'); return; }
      if (p.dirty) { UI.toast('Lancia prima F9.', 'warn'); return; }
      UI.confirm('Storicizzare ' + per.name + '?', 'Si salvano EV ' + U.keur(ctx.ev.EV) + ', AC ' + U.keur(ctx.ev.AC) + ', PV ' + U.keur(ctx.ev.PV) + ' e le ore del periodo; i parziali ripartono da zero. L\'operazione non si annulla.', 'Storicizza', () => {
        p.periodHistory = (p.periodHistory || []).filter((h) => h.periodId !== per.id);
        p.periodHistory.push({ periodId: per.id, end: per.end, pv: Math.round(ctx.ev.PV), ev: Math.round(ctx.ev.EV), ac: Math.round(ctx.ev.AC), spi: ctx.ev.SPI, cpi: ctx.ev.CPI, storedAt: U.nowStamp(), by: S.user().name });
        p.activities.forEach((a) => (a.assign || []).forEach((x) => { x.storedAct = x.act || 0; }));
        per.stored = true; p.cycleStep = 6; S.save();
        UI.toast(per.name + ' storicizzato.', 'ok'); M.App.render(true);
      });
    },
    peApprove(el) {
      const id = el.getAttribute('data-id'); const c = S.confirmed(); const e = c.progress.find((x) => x.id === id); if (!e) return;
      S.mutate((w) => { const a = w.activities.find((x) => x.id === e.actId); if (a) { applyValues(a, e.values); if (e.note) { a.notes = a.notes || []; a.notes.push({ at: e.at, by: (S.db.users.find((u) => u.id === e.by) || {}).name || e.by, text: e.note }); } } const ee = w.progress.find((x) => x.id === id); ee.status = 'Approvato'; ee.approvedBy = S.user().name; ee.approvedAt = U.nowStamp(); }, { cap: 'approve' });
      UI.toast('Inserimento approvato e applicato al programma.', 'ok');
    },
    peReject(el) { const id = el.getAttribute('data-id'); UI.prompt('Respingi inserimento', 'Motivo (obbligatorio)', '', (reason) => { if (!reason) { UI.toast('Il motivo è obbligatorio.', 'warn'); return; } S.mutate((w) => { const e = w.progress.find((x) => x.id === id); e.status = 'Respinto'; e.reason = reason; }, { cap: 'approve', affects: false }); }); },
    peApproveAll() {
      const c = S.confirmed(); const DD = U.dnOf(c.dataDate);
      const ok = (c.progress || []).filter((e) => { if (e.status !== 'Inviato') return false; const a = c.activities.find((x) => x.id === e.actId); if (!a) return false; return !validate(c, a, Object.assign(curVals(a), e.values, { finished: !!e.values.af }), DD).some((x) => x.lvl === 'bad'); });
      if (!ok.length) { UI.toast('Nessun inserimento coerente da approvare.', 'info'); return; }
      S.mutate((w) => { ok.forEach((e0) => { const e = w.progress.find((x) => x.id === e0.id); const a = w.activities.find((x) => x.id === e.actId); applyValues(a, e.values); if (e.note) { a.notes = a.notes || []; a.notes.push({ at: e.at, by: (S.db.users.find((u) => u.id === e.by) || {}).name || e.by, text: e.note }); } e.status = 'Approvato'; e.approvedBy = S.user().name; }); }, { cap: 'approve' });
      UI.toast(ok.length + ' inserimenti approvati in blocco.', 'ok');
    },
    propApprove(el) { const id = el.getAttribute('data-id'); S.mutate((w) => { const x = w.proposals.find((y) => y.id === id); x.status = 'Approvata'; if (x.kind === 'durata' && x.payload) { const a = w.activities.find((y) => y.id === x.actId); if (a) Object.assign(a, x.payload); } }); UI.toast('Proposta approvata.', 'ok'); },
    propReject(el) { const id = el.getAttribute('data-id'); S.mutate((w) => { const x = w.proposals.find((y) => y.id === id); x.status = 'Respinta'; }, { affects: false }); },
    syncOutbox() { M.Views.avanzamento.syncOutbox(false); },
    feDraft(el) { saveEntry(el.closest('form'), 'Bozza'); },
    feCheck(el) {
      const form = el.closest('form'); const p = S.confirmed(); const a = p.activities.find((x) => x.id === form.getAttribute('data-id'));
      const r = readForm(form); const DD = U.dnOf(p.dataDate);
      const iss = validate(p, a, r.v, DD); const w = windowInfo(p);
      const bad = iss.some((x) => x.lvl === 'bad');
      UI.modal({ title: 'Controlla prima di inviare: ' + a.code, info: 'progressEntry', body: '<dl class="kv"><dt>Iniziata</dt><dd>' + (r.v.started ? 'sì, il ' + U.fd(r.v.as) : 'no') + '</dd><dt>Finita</dt><dd>' + (r.v.finished ? 'sì, il ' + U.fd(r.v.af) : 'no') + '</dd><dt>% fisica</dt><dd>' + U.pct(r.v.pct) + '</dd><dt>Giorni rimanenti</dt><dd>' + r.v.rd + '</dd><dt>Nota</dt><dd>' + esc(r.note || '-') + '</dd><dt>Foto</dt><dd>' + (r.file ? esc(r.file.name) : 'nessuna') + '</dd></dl><ul class="checks">' + (iss.length ? iss.map((x) => '<li class="' + (x.lvl === 'bad' ? 'bad' : 'warnl') + '">' + UI.ic('alert', 16) + '<span>' + esc(x.t) + '</span></li>').join('') : '<li class="ok">' + UI.ic('check', 16) + '<span>Tutti i controlli superati</span></li>') + '</ul>' + (w.open ? '' : '<p class="warnbox">Fuori dalla finestra di inserimento (' + U.fd(w.from) + ' - ' + U.fd(w.to) + '): l\'inserimento diventa una proposta da approvare.</p>'), foot: '<button type="button" class="btn" data-a="closeModal">Correggi</button><button type="button" class="btn-p" data-a="feSend"' + (bad ? ' disabled' : '') + '>Confermo e invio</button>', after: () => { M.Views.avanzamento._form = form; } });
    },
    feSend() { UI.closeModal(); const f = M.Views.avanzamento._form; if (f) saveEntry(f, 'Inviato'); },
    fePropose(el) {
      const form = el.closest('form'); const id = form.getAttribute('data-id'); const a = S.confirmed().activities.find((x) => x.id === id);
      UI.modal({ title: 'Proponi una modifica su ' + a.code, info: 'proposals', body: '<label class="fld">Tipo' + UI.sel('noop', [['durata', 'Durata'], ['legame', 'Legame'], ['nuova attività', 'Nuova attività'], ['altro', 'Altro']], 'durata', 'id="pp-k"') + '</label><label class="fld">Nuova durata (se tipo Durata)<input class="inp" type="number" id="pp-d" value="' + (a.od || 0) + '"></label><label class="fld">Descrizione<textarea class="inp" id="pp-t" rows="3" placeholder="Es. serve una seconda squadra per 10 giorni"></textarea></label><p class="help">Le modifiche strutturali dal tablet diventano proposte da approvare da computer.</p>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="feProposeOk" data-id="' + esc(id) + '">Invia proposta</button>' });
    },
    feProposeOk(el) { const id = el.getAttribute('data-id'); const k = U.$('#pp-k').value, t = U.$('#pp-t').value, d = Number(U.$('#pp-d').value); const c = S.confirmed(); c.proposals = c.proposals || []; c.proposals.push({ id: U.uid('pr'), by: S.user().id, at: U.nowStamp(), status: 'Inviata', kind: k, actId: id, text: (c.activities.find((x) => x.id === id) || {}).code + ': ' + (t || (k === 'durata' ? 'durata ' + d + ' g' : k)), payload: k === 'durata' ? { od: d } : null }); S.save(); UI.closeModal(); UI.toast('Proposta inviata al pianificatore.', 'ok'); M.App.render(true); },
    pNoteAdd() { const t = (U.$('#pnote') || {}).value; if (!t) return; const per = periodOf(U.dnOf(S.P().dataDate)); S.mutate((w) => { w.notes = w.notes || []; w.notes.push({ at: U.nowStamp(), by: S.user().name, text: t, period: per ? per.id : '' }); }, { affects: false, cap: 'progress' }); },
    pasteProgress() { M.Paste.open('', 'progress'); }
  });

  Object.assign(M.C, {
    pe(el) {
      const id = el.getAttribute('data-id'), k = el.getAttribute('data-k'); const v = el.type === 'checkbox' ? el.checked : el.value;
      const p = S.P(); const DD = U.dnOf(p.dataDate);
      if (k === 'as' && v && U.dnOf(v) > DD) UI.toast('Inizio reale oltre la data date ' + U.fd(DD) + ': correggi prima di F9.', 'warn');
      S.mutate((w) => {
        const a = w.activities.find((x) => x.id === id); if (!a) return;
        if (k === 'started') { if (v) { a.as = a.as || U.isoOf(Math.min(DD, (w.sched && w.sched.acts[a.id] ? w.sched.acts[a.id].es : DD))); if (a.rd === undefined) a.rd = a.od; } else { delete a.as; delete a.af; delete a.rd; } }
        else if (k === 'finished') { if (v) { a.af = U.isoOf(DD); a.rd = 0; a.pct = 100; } else { delete a.af; a.rd = a.rd || 1; } }
        else if (k === 'as' || k === 'af') { if (v) a[k] = v; }
        else if (k === 'pct') a.pct = U.clamp(Number(v) || 0, 0, 100);
        else if (k === 'rd') a.rd = Math.max(0, Number(v) || 0);
        else if (k === 'actH' || k === 'perH') {
          const lab = (a.assign || []).filter((x) => (S.res(x.resId) || {}).type === 'Labor');
          const tot = k === 'actH' ? Number(v) || 0 : laborStored(a) + (Number(v) || 0);
          const cur = U.sum(lab, (x) => x.act || 0) || 1;
          lab.forEach((x, i) => { const share = lab.length === 1 ? 1 : (x.act || 0) / cur; x.act = U.round2(i === lab.length - 1 && lab.length > 1 ? tot - U.sum(lab.slice(0, -1), (y) => y.act) : tot * share); if (a.durType !== 'FQ') x.rem = Math.max(0, U.round2((x.upd || 0) * (a.rd !== undefined ? a.rd : a.od))); });
        }
      }, { cap: 'progress', affects: !['actH', 'perH'].includes(k) });
    }
  });
})(window.M = window.M || {});
