/* Meridian - 04 Schedulazione: parametri, F9 e Anteprima, log, percorsi critici, DCMA, versioni */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;

  M.Views.schedula = {
    title: 'Schedulazione',
    render() {
      const ctx = VH.ctx(); const p = ctx.p, s = ctx.s, st = S.S();
      const c = S.confirmed();
      const prev = (c.versions || []).length > 1 ? c.versions[c.versions.length - 2] : null;
      const sep = S.baseline(p, 'secondary');
      const blFin = ctx.bls ? ctx.bls.finishDay : null;
      const dBL = blFin !== null && s.finish ? M.Cal.between(ctx.pcal, s.finish, ctx.bls.finish) : null;
      const dPrev = sep && sep.sched && sep.sched.finish && s.finish ? M.Cal.between(ctx.pcal, sep.sched.finish, s.finish) : null;
      const can = S.can('schedule');
      const dis = can ? '' : ' disabled';
      const q = s.ok ? M.CPM.quality(p, s, ctx.bls, S.db, st.dcma) : [];
      const passed = q.filter((x) => x.ok).length;
      const params = '<div class="col gap">' +
        '<label class="fld">Data date ' + UI.i('dataDate') + '<input class="inp" type="date" value="' + p.dataDate + '" data-c="pDataDate"' + dis + '></label>' +
        '<label class="fld">Must finish by ' + UI.i('mustFinish') + '<input class="inp" type="date" value="' + (p.mustFinish || '') + '" data-c="pMustFinish"' + dis + '></label>' +
        '<label class="fld">Attività critiche ' + UI.i('critical') + UI.sel('setOpt', [['LP', 'Longest Path'], ['TF', 'Total float minore o uguale a']], st.criticalMode, 'data-k="criticalMode"' + dis) + '</label>' +
        (st.criticalMode === 'TF' ? '<label class="fld">Soglia di total float (g)<input class="inp" type="number" value="' + st.tfThreshold + '" data-c="setOpt" data-k="tfThreshold"' + dis + '></label>' : '') +
        '<label class="sw"><input type="checkbox" data-c="setOpt" data-k="subOn"' + (st.subOn ? ' checked' : '') + dis + '> Evidenzia le sub-critiche con float verso la fine fino a</label><label class="fld">Soglia sub-critico (g) ' + UI.i('subcrit') + '<input class="inp" type="number" min="0" value="' + st.subThreshold + '" data-c="setOpt" data-k="subThreshold"' + dis + '></label>' +
        '<label class="fld adv">Attività fuori sequenza ' + UI.i('oos') + UI.sel('setOpt', [['retained', 'Retained Logic'], ['override', 'Progress Override'], ['actual', 'Actual Dates']], st.oos, 'data-k="oos"' + dis) + '</label>' +
        '<label class="fld adv">Calendario per i lag ' + UI.i('lagCal') + UI.sel('setOpt', [['pred', 'Del predecessore'], ['succ', 'Del successore'], ['24h', '24 ore'], ['proj', 'Del progetto']], st.lagCal, 'data-k="lagCal"' + dis) + '</label>' +
        '<fieldset class="fs"><legend>Ricalcolo ' + UI.i('preview') + '</legend><label class="ck"><input type="radio" name="rm" value="manual" data-c="recalcMode"' + (st.recalcMode !== 'preview' ? ' checked' : '') + dis + '> Manuale con F9 (come P6)</label><label class="ck"><input type="radio" name="rm" value="preview" data-c="recalcMode"' + (st.recalcMode === 'preview' ? ' checked' : '') + dis + '> Anteprima: ricalcolo immediato da confermare</label></fieldset>' +
        '<div class="acts">' + (S.inPreview() ? '<button type="button" class="btn-p" data-a="previewConfirm">Conferma anteprima</button><button type="button" class="btn" data-a="previewCancel">Annulla anteprima</button>' : '<button type="button" class="btn-p" data-a="f9"' + dis + '>Schedula ora (F9)</button><button type="button" class="btn" data-a="startPreviewNow"' + dis + '>Apri un\'anteprima</button>') + '</div>' +
        '<p class="help">Prima di uno scenario conviene lavorare su una copia nel nodo BKG (Portafoglio, Copie e scenari).</p></div>';
      const logRows = (s.log || []).map((l) => '<div class="logi ' + l.lvl + '">' + UI.chip(l.lvl === 'err' ? 'Errore' : l.lvl === 'warn' ? 'Avviso' : 'Risultato', l.lvl === 'err' ? 'bad' : l.lvl === 'warn' ? 'warn' : 'ok') + '<span>' + esc(l.text) + '</span>' + (l.actId ? '<button type="button" class="btn sm" data-a="selAct" data-id="' + esc(l.actId) + '" data-r="attivita">' + (l.fix === 'link' ? 'Aggiungi legame' : 'Apri') + '</button>' : l.fix === 'variance' ? '<a class="btn sm" href="#/controllo">Vedi scostamenti</a>' : '') + '</div>').join('');
      const paths = (s.paths || []).map((x) => '<div class="cpw"><p class="ey"><i class="pdot" style="background:' + VH.pathColor(x.n) + '"></i>Percorso ' + x.n + ' - ' + x.count + ' attività, ' + U.int(x.length) + ' g lavorativi, total float ' + U.int(x.float) + ' g</p><div class="cp">' + x.members.map((id, i) => { const a = ctx.byId.get(id); const r = s.acts[id] || {}; const d = VH.dates(ctx, a); return (i ? '<span class="arr" aria-hidden="true">→</span>' : '') + '<button type="button" class="cpn" style="border-color:' + VH.pathColor(x.n) + '" data-a="selAct" data-id="' + esc(id) + '" data-r="attivita"><b>' + esc(a.code) + '</b>' + esc(a.name.length > 22 ? a.name.slice(0, 21) + '…' : a.name) + '<br><span>' + (M.CPM.isMile(a) ? U.fd(d.finish !== null ? d.finish : d.start) : (a.as ? U.int(a.rd || 0) + ' g rim.' : U.int(a.od || 0) + ' g')) + '</span><span class="drv">' + esc(r.driverType || '') + '</span></button>'; }).join('') + '</div></div>').join('');
      const vers = (c.versions || []).slice().reverse();
      return '<div class="head"><div><p class="ey">' + esc(p.code) + ' - ' + esc(p.workName || p.name) + '</p><h1>Schedulazione</h1><p class="sub">Calcolo del percorso critico: passaggio in avanti per le date Early, all\'indietro per le date Late. In modalità manuale le date cambiano solo quando lanci F9.</p></div><div class="acts"><a class="btn" href="#/attivita">Torna al Gantt</a></div></div>' +
        '<div class="row">' + UI.card('Parametri', params, { info: 'f9', style: 'flex:1 1 300px' }) +
        UI.card('Risultato e log', '<div class="kpis inline"><div><p class="ey">Fine calcolata</p><div class="big">' + U.fd(s.finishDay) + '</div><p class="small">' + (dBL !== null ? '<span class="' + UI.dayCls(dBL) + '">' + U.signed(dBL) + ' g</span> su baseline (' + U.fd(blFin) + ')' : 'nessuna baseline') + '</p></div><div><p class="ey">Rispetto al cut-off precedente</p><div class="big">' + (dPrev === null ? '-' : U.signed(dPrev) + ' g') + '</div><p class="small muted">' + (sep ? esc(sep.code) + ': ' + U.fd(sep.sched && sep.sched.finishDay) : 'nessuna copia assegnata come Secondary') + '</p></div><div><p class="ey">Errori</p><div class="big">' + (s.errors || 0) + '</div><p class="small muted">' + (s.errors ? 'loop da rompere' : 'nessun loop') + '</p></div><div><p class="ey">Avvisi</p><div class="big">' + (s.warnings || 0) + '</div><p class="small muted">da verificare</p></div><div><p class="ey">Percorsi critici</p><div class="big">' + (s.paths || []).length + '</div><p class="small muted">' + (s.subCount || 0) + ' sub-critiche</p></div></div><p class="small muted">Eseguita il ' + U.fts(s.ranAt) + (s.ranBy ? ' da ' + esc(s.ranBy) : '') + ' in ' + (s.ms || 0) + ' ms' + (c.dirty ? ' - <b class="neg">dati cambiati dopo questa schedulazione</b>' : '') + '</p>' + logRows + '<h3 class="h3">Percorsi critici (' + (st.criticalMode === 'TF' ? 'Total float ≤ ' + st.tfThreshold : 'Longest Path') + ') da qui alla fine ' + UI.i('paths') + '</h3>' + (paths || '<p class="muted">Nessun percorso critico.</p>'), { info: 'log', style: 'flex:2 1 520px' }) + '</div>' +
        UI.card('Controlli di qualità del programma', UI.table(['Controllo', 'Cosa verifica', { t: 'Soglia', n: 1 }, { t: 'Valore', n: 1 }, 'Esito', ''], q.map((x) => '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.what) + '</td><td class="n">' + esc(x.th) + '</td><td class="n">' + esc(x.val) + '</td><td>' + UI.chip(x.ok ? 'Superato' : 'Non superato', x.ok ? 'ok' : 'bad') + '</td><td>' + (x.acts && x.acts.length && !x.ok ? '<button type="button" class="btn sm" data-a="qaShow" data-ids="' + esc(x.acts.join(',')) + '" data-n="' + esc(x.name) + '">Vedi ' + x.acts.length + '</button>' : '') + '</td></tr>')) + '<p class="help">Valori calcolati sulle ' + p.activities.filter((a) => !a.af && a.type !== 'loe' && a.type !== 'wbs').length + ' attività non concluse del progetto. Le soglie si modificano in Amministrazione.</p>', { info: 'dcma', tools: '<span class="chip ' + (passed === q.length ? 'ok' : 'info') + '">Modello DCMA a 14 punti - ' + passed + ' su ' + q.length + ' superati</span>' }) +
        UI.card('Storico versioni', UI.table(['Versione', 'Data', 'Autore', 'Nota', 'Fine', ''], vers.map((v) => '<tr><td class="mono">v' + v.n + '</td><td>' + U.fts(v.at) + '</td><td>' + esc(v.by) + '</td><td>' + esc(v.note) + '</td><td>' + U.fd(v.finish) + '</td><td>' + (v.snap ? '<button type="button" class="btn sm" data-a="verCompare" data-n="' + v.n + '">Confronta con la corrente</button>' : '<span class="muted small">solo sintesi</span>') + '</td></tr>'), { empty: 'Nessuna versione' }), { info: 'versions' });
    }
  };

  Object.assign(M.A, {
    startPreviewNow() { if (!S.can('schedule')) return; S.startPreview(); S.schedule(S.preview.work); S.persistPreview(); UI.toast('Anteprima aperta: le modifiche vengono ricalcolate subito e restano private finché non confermi.', 'info'); M.App.render(true); },
    qaShow(el) { const ids = el.getAttribute('data-ids').split(','); const ctx = VH.ctx(); UI.modal({ title: el.getAttribute('data-n'), body: UI.table(['ID', 'Attività', 'TF', 'Durata'], ids.map((id) => { const a = ctx.byId.get(id); if (!a) return ''; const r = ctx.s.acts[id] || {}; return '<tr><td><button type="button" class="lnk mono" data-a="qaGo" data-id="' + esc(id) + '">' + esc(a.code) + '</button></td><td>' + esc(a.name) + '</td><td class="n">' + (r.tf === null || r.tf === undefined ? '' : r.tf) + '</td><td class="n">' + (a.od || 0) + '</td></tr>'; })) }); },
    qaGo(el) { UI.closeModal(); S.ui.sel = el.getAttribute('data-id'); S.saveUi(); M.App.go('attivita'); },
    verCompare(el) {
      const n = Number(el.getAttribute('data-n')); const c = S.confirmed(); const v = c.versions.find((x) => x.n === n); if (!v || !v.snap) return;
      const ctx = VH.ctx(c);
      const rows = [];
      c.activities.forEach((a) => {
        const o = v.snap[a.id], r = ctx.s.acts[a.id];
        if (!r) return;
        if (!o) { rows.push('<tr><td class="mono">' + esc(a.code) + '</td><td>' + esc(a.name) + '</td><td colspan="4">nuova dopo la v' + n + '</td></tr>'); return; }
        const ds = M.Cal.between(ctx.pcal, o[0], r.es), df = M.Cal.between(ctx.pcal, o[1], r.ef);
        if (ds || df || o[2] !== r.tf || !!o[3] !== !!r.crit) rows.push('<tr><td class="mono">' + esc(a.code) + '</td><td>' + esc(a.name) + '</td><td class="n ' + UI.dayCls(-ds) + '">' + U.signed(ds) + ' g</td><td class="n ' + UI.dayCls(-df) + '">' + U.signed(df) + ' g</td><td class="n">' + (o[2] === null ? '' : o[2]) + ' → ' + (r.tf === null || r.tf === undefined ? '' : r.tf) + '</td><td>' + (!!o[3] === !!r.crit ? '' : r.crit ? '<b class="neg">diventa critica</b>' : '<b class="pos">non più critica</b>') + '</td></tr>');
      });
      UI.modal({ title: 'Versione ' + n + ' contro corrente (v' + c.version + ')', wide: true, info: 'versions', body: '<p>Fine: ' + U.fd(v.finish) + ' → <b>' + U.fd(ctx.s.finishDay) + '</b>. ' + esc(v.note || '') + '</p>' + UI.table(['ID', 'Attività', { t: 'Delta inizio', n: 1 }, { t: 'Delta fine', n: 1 }, { t: 'TF', n: 1 }, 'Criticità'], rows, { empty: 'Nessuna differenza' }) });
    }
  });
  Object.assign(M.C, {
    setOpt(el) {
      const k = el.getAttribute('data-k'); let v = el.type === 'checkbox' ? el.checked : el.value;
      if (['tfThreshold', 'subThreshold'].includes(k)) v = Number(v) || 0;
      S.db.settings[k] = v; S.save();
      const p = S.P();
      if (S.inPreview()) { S.schedule(S.preview.work); S.persistPreview(); }
      else if (S.S().recalcMode === 'manual') { const c = S.confirmed(); c.dirty = true; S.save(); }
      void p;
      UI.toast('Opzione aggiornata.' + (S.inPreview() ? ' Anteprima ricalcolata.' : ' Lancia F9 per applicarla.'), 'info');
      M.App.render(true);
    },
    recalcMode(el) { S.db.settings.recalcMode = el.value; S.save(); UI.toast(el.value === 'preview' ? 'Modalità Anteprima: ogni modifica viene ricalcolata subito e va confermata.' : 'Modalità manuale: le date cambiano solo con F9.', 'info'); M.App.render(true); },
    pDataDate(el) { if (!el.value) return; S.mutate((w) => { w.dataDate = el.value; }); },
    pMustFinish(el) { S.mutate((w) => { w.mustFinish = el.value || ''; }); }
  });
})(window.M = window.M || {});
