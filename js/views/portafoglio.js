/* Meridian - 01 Portafoglio */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;

  function projSummary(p) {
    const c = VH.ctx(p);
    const bl = c.bl, s = c.s;
    const fin = s.finishDay, blFin = c.bls ? c.bls.finishDay : null;
    const varF = blFin !== null && fin !== undefined ? M.Cal.between(c.pcal, s.finish, c.bls.finish) : null;
    const e = c.ev;
    let st = ['In linea', 'ok'];
    if ((varF !== null && varF < 0) && e.CPI !== null && e.CPI < 0.95) st = ['Ritardo e extra costo', 'bad'];
    else if (varF !== null && varF < 0) st = ['In ritardo', 'bad'];
    else if (e.CPI !== null && e.CPI < 0.99) st = ['Costi da seguire', 'warn'];
    else if (e.SPI !== null && e.SPI < 0.95) st = ['Produzione da seguire', 'warn'];
    return { p, c, fin, blFin, varF, e, st, bl };
  }

  function epsTree() {
    const projs = S.projects();
    const node = (e, lvl) => {
      const kids = S.db.eps.filter((x) => x.parent === e.id);
      const ps = projs.filter((p) => p.epsId === e.id);
      const collapsed = S.ui.collapsed['eps:' + e.id];
      let h = '';
      if (e.kind === 'node') {
        h += '<div class="tr l' + lvl + '">' + (kids.length || ps.length ? '<button type="button" class="tg" data-a="toggleEps" data-id="' + e.id + '" aria-expanded="' + !collapsed + '" aria-label="' + (collapsed ? 'Espandi ' : 'Comprimi ') + esc(e.name) + '">' + UI.ic(collapsed ? 'chevR' : 'chevD', 14) + '</button>' : '<span class="tg"></span>') + (lvl ? '<b>' + esc(e.code) + '</b> ' : '<b>') + esc(e.name) + (lvl ? '' : '</b>') + '</div>';
      } else {
        h += '<div class="tr l' + lvl + '"><span class="node n' + e.kind + '">' + e.kind + '</span></div>';
      }
      if (!collapsed) {
        ps.forEach((p) => { h += '<div class="tr l' + (lvl + 1) + '"><span class="node n' + p.status + '">' + p.status + '</span><button type="button" class="lnk mono" data-a="openProject" data-id="' + p.id + '">' + esc(p.code) + '</button>' + (p.id === S.db.activeProject ? ' <span class="chip info">aperto</span>' : '') + '</div>'; });
        kids.forEach((k) => { h += node(k, lvl + 1); });
      }
      return h;
    };
    const root = S.db.eps.find((e) => !e.parent);
    return root ? node(root, 0) : '';
  }

  M.Views.portafoglio = {
    title: 'Portafoglio',
    render() {
      const curr = S.projects((p) => p.status === 'CURR').map(projSummary);
      const worst = curr.filter((x) => x.varF !== null).sort((a, b) => a.varF - b.varF)[0];
      const issues = U.sum(curr, (x) => (x.p.issues || []).filter((i) => i.status !== 'Chiuso').length);
      const fromTh = U.sum(curr, (x) => (x.p.issues || []).filter((i) => i.status !== 'Chiuso' && i.source === 'soglia').length);
      const nextCut = curr.map((x) => x.p.nextCutoff).filter(Boolean).sort()[0];
      const act = S.confirmed();
      const actS = projSummary(S.P());
      const steps = ['Copia datata nel nodo CURR', 'Nuova data date ' + U.fd(act.dataDate), 'Dati dal cantiere', 'Schedulazione F9 e log', 'Storicizza periodo', 'Confronto con baseline ed EV'];
      const pending = (act.progress || []).filter((x) => x.status === 'Inviato').length;
      const copies = S.projects((p) => p.status === 'BKG' && p.work === act.work);
      const totalBAC = U.sum(curr, (x) => x.e.BAC), totalEAC = U.sum(curr, (x) => x.e.EAC);
      return '<div class="head"><div><p class="ey">Enterprise</p><h1>Portafoglio ' + UI.i('portfolio') + '</h1><p class="sub">Programmi correnti di tutti i lavori, letti dal nodo CURR di ogni ramo EPS.</p></div><div class="acts"><button type="button" class="btn" data-a="newEps">Nuovo nodo EPS</button><button type="button" class="btn-p" data-a="newProject">' + UI.ic('plus') + 'Nuovo progetto</button></div></div>' +
        '<div class="kpis">' + UI.kpi('Progetti correnti', String(curr.length), 'uno per lavoro, nodo CURR') +
        UI.kpi('Peggior scostamento fine', worst ? U.signed(worst.varF) + ' g' : '-', worst ? esc(worst.p.workName || worst.p.name) + ', rispetto a ' + esc(worst.bl ? worst.bl.code : '') : '', worst && worst.varF < 0 ? 'neg' : '') +
        UI.kpi('Issue aperti', String(issues), fromTh + ' generati dalle soglie') +
        UI.kpi('Prossimo cut-off', nextCut ? U.fd(nextCut) : '-', 'aggiornamento mensile') +
        UI.kpi('EAC portafoglio', U.keur(totalEAC), 'BAC ' + U.keur(totalBAC), totalEAC > totalBAC ? 'neg' : '') + '</div>' +
        '<div class="row">' + UI.card('Albero EPS', '<div class="tree">' + epsTree() + '</div><p class="help">BASE: baseline approvate, modificabili solo con change. CURR: programma vivo. BKG: copie e simulazioni.</p>', { info: 'eps', style: 'flex:1 1 300px' }) +
        UI.card('Programmi correnti', UI.table(['Progetto', 'Data date', 'Fine baseline', 'Fine prevista', { t: 'Var. fine', n: 1 }, { t: 'SPI', n: 1 }, { t: 'CPI', n: 1 }, { t: 'EAC', n: 1 }, 'Stato'], curr.map((x) => '<tr><td><button type="button" class="lnk mono" data-a="openProject" data-id="' + x.p.id + '" data-r="attivita">' + esc(x.p.code) + '</button><br><span class="small muted">' + esc(x.p.workName || x.p.name) + '</span></td><td>' + U.fd(x.p.dataDate) + '</td><td>' + U.fd(x.blFin) + '</td><td>' + U.fd(x.fin) + '</td><td class="n ' + UI.dayCls(x.varF) + '">' + (x.varF === null ? '' : U.signed(x.varF) + ' g') + '</td><td class="n ' + (x.e.SPI < 0.95 ? 'neg' : '') + '">' + U.num(x.e.SPI) + '</td><td class="n ' + (x.e.CPI < 0.95 ? 'neg' : '') + '">' + U.num(x.e.CPI) + '</td><td class="n">' + U.keur(x.e.EAC) + '</td><td>' + UI.chip(x.st[0], x.st[1]) + (x.p.dirty ? ' ' + UI.chip('Da ricalcolare', 'warn') : '') + '</td></tr>')) + '<p class="help">Var. fine = baseline - corrente in giorni lavorativi: negativo significa ritardo. Indici alla data date di ogni progetto.</p>', { style: 'flex:3 1 640px', tools: '<span class="chip info">Filtro: nodo CURR</span><span class="chip info">Raggruppa: lavoro</span>' }) + '</div>' +
        '<div class="row">' + UI.card('Ciclo di aggiornamento - ' + (act.workName || act.name), '<ol class="steps">' + steps.map((t, i) => { const n = i + 1, cur = act.cycleStep || 1; return '<li><span class="dot ' + (n < cur ? 'd-done' : n === cur ? 'd-now' : 'd-todo') + '">' + n + '</span>' + (n === cur ? '<b>' + esc(t) + '</b>' : esc(t)) + (n === 3 && pending ? ' <span class="chip warn">' + pending + ' inserimenti da approvare</span>' : '') + '</li>'; }).join('') + '</ol><div class="acts"><a class="btn-p" href="#/avanzamento">Riprendi aggiornamento</a></div>', { info: 'cycle', style: 'flex:1 1 300px' }) +
        UI.card('Ultima schedulazione', '<p class="muted">' + esc(act.code) + ', eseguita il ' + U.fts(actS.c.s.ranAt) + (actS.c.s.ranBy ? ' da ' + esc(actS.c.s.ranBy) : '') + '</p><dl class="kv"><dt>Fine calcolata</dt><dd><b>' + U.fd(actS.fin) + '</b></dd><dt>Errori (loop)</dt><dd>' + UI.chip(String(actS.c.s.errors || 0), actS.c.s.errors ? 'bad' : 'ok') + '</dd><dt>Avvisi</dt><dd>' + UI.chip(String(actS.c.s.warnings || 0), actS.c.s.warnings ? 'warn' : 'ok') + '</dd><dt>Percorsi critici</dt><dd><b>' + (actS.c.s.paths || []).length + '</b></dd><dt>Controlli qualità superati</dt><dd><b>' + qaScore(S.P(), actS.c) + '</b></dd><dt>Versione</dt><dd>' + (act.version || 0) + '</dd></dl><div class="acts"><a class="btn" href="#/schedula">Apri il log</a></div>', { info: 'log', style: 'flex:1 1 300px' }) +
        UI.card('Copie e scenari', '<p class="muted">Le simulazioni si fanno sempre su una copia nel nodo BKG.</p>' + UI.table(['Copia', 'Creata', 'Fine'], copies.map((p) => '<tr><td><button type="button" class="lnk mono" data-a="openProject" data-id="' + p.id + '">' + esc(p.code) + '</button></td><td>' + U.fd(p.savedAt || (p.versions[0] || {}).at) + '</td><td>' + U.fd(p.sched && p.sched.finishDay) + '</td></tr>'), { empty: 'Nessuna copia' }) + '<div class="acts"><button type="button" class="btn" data-a="newCopy">Nuova copia di simulazione</button><a class="btn" href="#/controllo">Confronta</a></div>', { info: 'copies', style: 'flex:1 1 300px' }) + '</div>';
    }
  };
  function qaScore(p, c) { try { const q = M.CPM.quality(p, c.s, c.bls, S.db, S.S().dcma); return q.filter((x) => x.ok).length + ' su ' + q.length; } catch (e) { return '-'; } }
  M.Views.qaScore = qaScore;

  Object.assign(M.A, {
    toggleEps(el) { const k = 'eps:' + el.getAttribute('data-id'); S.ui.collapsed[k] = !S.ui.collapsed[k]; S.saveUi(); M.App.render(true); },
    openProject(el) { const id = el.getAttribute('data-id'); if (S.setActive(id)) { const r = el.getAttribute('data-r'); if (r) M.App.go(r); else M.App.render(true); } },
    newCopy() {
      const c = S.confirmed();
      UI.prompt('Nuova copia di simulazione', 'Nome della copia (nodo BKG)', c.work + '_' + U.isoOf(U.dnOf(c.dataDate)) + '_scenario', (code) => {
        if (!code) return;
        const p = S.copyProject(S.P(), { code, name: c.workName + ' - ' + code, status: 'BKG', epsId: S.epsNodeFor(c.work, 'BKG') || c.epsId, savedAt: U.isoOf(U.todayDn()) });
        UI.toast('Copia ' + p.code + ' creata nel nodo BKG.', 'ok');
        S.setActive(p.id);
      }, { help: 'Il nome dice cosa contiene, ad esempio ED-A_2026-10-31_scenario+10%.' });
    },
    newEps() {
      if (!S.can('structure')) { UI.toast('Il tuo ruolo non permette di modificare l\'EPS.', 'warn'); return; }
      UI.modal({ title: 'Nuovo nodo EPS per un lavoro', info: 'eps', body: '<label class="fld">Codice lavoro<input class="inp" id="ne-code" placeholder="Es. SC-D"></label><label class="fld">Nome<input class="inp" id="ne-name" placeholder="Es. Scuola D"></label><label class="fld">Responsabile (OBS)' + UI.sel('noop', S.db.obs.map((o) => [o.id, o.name]), 'o2', 'id="ne-obs"') + '</label><p class="help">Meridian crea il nodo del lavoro con i tre sottonodi BASE, CURR e BKG.</p>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="newEpsOk">Crea</button>' });
    },
    newEpsOk() {
      const code = U.$('#ne-code').value.trim(), name = U.$('#ne-name').value.trim(), obs = U.$('#ne-obs').value;
      if (!code || !name) { UI.toast('Codice e nome sono obbligatori.', 'warn'); return; }
      if (S.db.eps.some((e) => e.code === code)) { UI.toast('Esiste già un nodo con questo codice.', 'warn'); return; }
      const id = U.uid('e');
      S.db.eps.push({ id, code, name, parent: 'e0', kind: 'node', obs });
      ['BASE', 'CURR', 'BKG'].forEach((k) => S.db.eps.push({ id: id + '_' + k, code: code + '.' + k, name: k, parent: id, kind: k }));
      S.save(); UI.closeModal(); UI.toast('Nodo EPS ' + code + ' creato.', 'ok'); M.App.render(true);
    },
    newProject() {
      if (!S.can('structure')) { UI.toast('Il tuo ruolo non permette di creare progetti.', 'warn'); return; }
      const works = S.db.eps.filter((e) => e.kind === 'node' && e.parent);
      UI.modal({ title: 'Nuovo progetto', info: 'projDefaults', body: '<div class="grid2"><label class="fld">Lavoro (nodo EPS)' + UI.sel('noop', works.map((w) => [w.code, w.code + ' ' + w.name]), works[0] && works[0].code, 'id="np-work"') + '</label><label class="fld">Project ID<input class="inp" id="np-code" placeholder="Es. SC-D_' + U.isoOf(U.todayDn()) + '"></label><label class="fld">Nome<input class="inp" id="np-name"></label><label class="fld">Planned start<input class="inp" type="date" id="np-start" value="' + U.isoOf(U.todayDn()) + '"></label><label class="fld">Must finish by (facoltativa)<input class="inp" type="date" id="np-mf"></label><label class="fld">Calendario' + UI.sel('noop', S.db.calendars.map((c) => [c.id, c.name]), 'cal5', 'id="np-cal"') + '</label></div><p class="help">Il progetto nasce nel nodo CURR con una WBS radice e due milestone. Per caricare un programma esistente usa Scambio dati.</p>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="newProjectOk">Crea progetto</button>' });
    },
    newProjectOk() {
      const work = U.$('#np-work').value, code = U.$('#np-code').value.trim(), name = U.$('#np-name').value.trim() || code;
      const start = U.$('#np-start').value, mf = U.$('#np-mf').value, cal = U.$('#np-cal').value;
      if (!code || !start) { UI.toast('Project ID e data di inizio sono obbligatori.', 'warn'); return; }
      const node = S.db.eps.find((e) => e.code === work);
      const id = U.uid('p');
      const p = { id, code, name, work, workName: node ? node.name : work, epsId: S.epsNodeFor(work, 'CURR'), status: 'CURR', obsId: node ? node.obs : '', plannedStart: start, mustFinish: mf, dataDate: U.isoOf(U.dnOf(start) - 1), calId: cal, rateType: 'Price/Unit', defaults: { durType: 'FDU', pctType: 'phys', actType: 'task' }, nextCutoff: U.isoOf(U.lastOfMonth(U.dnOf(start))), contractValue: 0,
        wbs: [{ id: 'W-' + id, code: work, name: node ? node.name : name, parent: null }], drawings: [], baselines: {}, versions: [], version: 1, dirty: true, progress: [], proposals: [], issues: [], risks: [], thresholds: [], changes: [], periodHistory: [], layouts: [], notes: [], cycleStep: 1, rels: [],
        activities: [{ id: 'M0010', code: 'M0010', name: 'Inizio lavori', wbsId: 'W-' + id, type: 'start', od: 0, pct: 0, assign: [], costs: [], steps: [], codes: {}, udf: {}, drawings: [], notes: [] }, { id: 'M9990', code: 'M9990', name: 'Fine lavori', wbsId: 'W-' + id, type: 'finish', od: 0, pct: 0, assign: [], costs: [], steps: [], codes: {}, udf: {}, drawings: [], notes: [] }] };
      p.rels.push({ id: U.uid('r'), pred: 'M0010', succ: 'M9990', type: 'FS', lag: 0 });
      S.schedule(p); p.dirty = false;
      S.db.projects.push(p); S.save(); UI.closeModal();
      S.setActive(id); M.App.go('attivita');
      UI.toast('Progetto ' + code + ' creato.', 'ok');
    },
    noop() {}
  });
  M.C.noop = function () {};
})(window.M = window.M || {});
