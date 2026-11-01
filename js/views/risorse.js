/* Meridian - 05 Risorse: RBS, profilo di utilizzo multiprogetto, sovrallocazioni, assegnazioni, livellamento */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;
  const PCOL = ['#1c5a8a', '#9fc3e6', '#5b8c5a', '#c8a2c8', '#e0ad00', '#7a8a99'];

  function scope() {
    const projs = S.projects((p) => p.status === 'CURR').map((p) => (S.inPreview() && p.id === S.preview.projectId ? S.preview.work : p));
    const scheds = {}; projs.forEach((p) => { scheds[p.id] = p.sched; });
    return { projs, scheds };
  }

  M.Views.risorse = {
    title: 'Risorse',
    render() {
      const sc = scope();
      const resId = S.res(S.ui.risSel) ? S.ui.risSel : (S.db.resources.find((r) => !r.group) || {}).id;
      const prof = M.Costs.resourceProfile(S.db, resId, sc.projs, sc.scheds);
      const r = prof.res;
      const over = prof.rows.filter((x) => x.over > 0.5);
      const rbs = S.db.resources.map((x) => {
        if (x.group) return '<div class="lab2">' + esc(x.name) + '</div>';
        const pr = M.Costs.resourceProfile(S.db, x.id, sc.projs, sc.scheds);
        const ov = pr && x.maxUpd && pr.rows.some((m) => m.over > 0.5);
        return '<button type="button" class="li' + (x.id === resId ? ' on' : '') + '" aria-pressed="' + (x.id === resId) + '" data-a="risPick" data-id="' + x.id + '">' + esc(x.name) + (ov ? ' <span class="chip bad">Sovrallocata</span>' : '') + '</button>';
      }).join('') + '<div class="lab2">Ruoli</div>' + (S.db.roles || []).map((ro) => '<span class="li muted">' + esc(ro.name) + '</span>').join('');
      const projIds = sc.projs.map((p) => p.id).filter((id) => prof.rows.some((m) => m.per[id]));
      const labels = prof.rows.map((m) => U.monthLabel(m.key, true));
      const chart = prof.rows.length ? UI.barChart({ labels, stacks: prof.rows.map((m) => projIds.map((id) => m.per[id] || 0)), colors: projIds.map((id, i) => PCOL[i % PCOL.length]), names: projIds.map((id) => S.proj(id).work || S.proj(id).code), cap: r.maxUpd ? prof.rows.map((m) => m.avail) : null, showTotals: true, yFmt: (v) => U.num(v, 0), aria: 'Utilizzo mensile di ' + r.name + ' su tutti i progetti' }) : '<p class="muted">Nessuna assegnazione nei programmi correnti.</p>';
      const table = UI.table(['Mese'].concat(projIds.map((id) => S.proj(id).work || S.proj(id).code)).concat([{ t: 'Totale', n: 1 }, { t: 'Disponibile', n: 1 }, { t: 'Eccesso', n: 1 }]), prof.rows.map((m) => '<tr><td>' + U.monthLabel(m.key, true) + '</td>' + projIds.map((id) => '<td class="n">' + U.num(m.per[id] || 0, 0) + ' ' + esc(r.unit) + '</td>').join('') + '<td class="n"><b>' + U.num(m.total, 0) + ' ' + esc(r.unit) + '</b></td><td class="n">' + (r.maxUpd ? U.num(m.avail, 0) + ' ' + esc(r.unit) : '-') + '</td><td class="n ' + (m.over > 0.5 ? 'neg' : '') + '">' + (r.maxUpd ? U.num(m.over, 0) + ' ' + esc(r.unit) : '-') + '</td></tr>'), { cls: 'compact' });
      const asg = prof.lines.map((l) => { const x = l.asg; const s = l.project.sched && l.project.sched.acts[l.act.id]; return '<tr><td>' + esc(l.project.work || l.project.code) + '</td><td>' + (l.project.id === S.db.activeProject ? '<button type="button" class="lnk" data-a="selAct" data-id="' + esc(l.act.id) + '" data-r="attivita">' + esc(l.act.code + ' ' + l.act.name) + '</button>' : esc(l.act.code + ' ' + l.act.name)) + '</td><td class="n">' + U.num(x.upd, 2) + ' ' + esc(r.unit) + '/g</td><td class="n">' + U.num(x.bud, 0) + '</td><td class="n">' + U.num(x.act || 0, 0) + '</td><td class="n">' + U.num(x.rem || 0, 0) + '</td><td class="n ' + ((x.act || 0) + (x.rem || 0) > x.bud + 0.5 ? 'neg' : '') + '">' + U.num((x.act || 0) + (x.rem || 0), 0) + '</td><td>' + esc((M.Costs.CURVES[x.curve] || { name: x.curve }).name) + '</td><td class="n">' + (s && s.tf !== null && s.tf !== undefined ? s.tf : '') + '</td><td>' + (s && s.crit ? UI.chip('critica', 'bad') : '') + '</td></tr>'; });
      const sugg = suggestions(prof, sc);
      return '<div class="head"><div><p class="ey">Enterprise e ' + esc(S.P().code) + '</p><h1>Risorse e assegnazioni</h1><p class="sub">Le risorse sono comuni a tutto il database: il profilo somma gli impegni di tutti i programmi correnti.' + (S.inPreview() ? ' Il progetto in anteprima è incluso con le date non confermate.' : '') + '</p></div><div class="acts"><button type="button" class="btn" data-a="levelCopy" data-id="' + resId + '">' + UI.ic('layers') + 'Livella su copia BKG</button>' + UI.i('leveling') + '</div></div>' +
        '<div class="row">' + UI.card('RBS', '<div class="list">' + rbs + '</div>', { info: 'resources', style: 'flex:1 1 220px' }) +
        UI.card('Profilo di utilizzo - ' + r.name, chart + UI.legend(projIds.map((id, i) => [S.proj(id).work + ' ' + (S.proj(id).workName || ''), PCOL[i % PCOL.length]]).concat(r.maxUpd ? [['Oltre la disponibilità', '#cf3a3a'], ['Disponibilità massima (' + U.num(r.maxUpd, 0) + ' ' + r.unit + '/g x giorni lavorativi)', 'none', 'border-top:2px dashed #0f2a40;height:0;border-radius:0']] : [])) + table, { info: 'histogram', style: 'flex:3 1 640px', tools: (over.length ? UI.chip(over.length + ' mesi sovrallocati', 'bad') : UI.chip('nessuna sovrallocazione', 'ok')) + UI.chip(r.unit === 'h' ? 'Ore al mese' : 'Quantità al mese', 'info') + UI.chip('Tutti i progetti', 'info') }) + '</div>' +
        '<div class="row">' + UI.card('Anagrafica', '<dl class="kv"><dt>Tipo</dt><dd>' + esc(r.type) + '</dd><dt>Composizione</dt><dd>' + esc(r.note || '-') + '</dd><dt>Default Units/Time</dt><dd>' + U.num(r.defUpd || 0, 2) + ' ' + esc(r.unit) + '/g</dd><dt>Max Units/Time</dt><dd>' + (r.maxUpd ? U.num(r.maxUpd, 2) + ' ' + esc(r.unit) + '/g' : 'illimitata') + '</dd><dt>Price/Unit</dt><dd>' + U.num(r.price || 0, 2) + ' €/' + esc(r.unit) + '</dd><dt>Calendario</dt><dd>' + esc((S.cal(r.calId) || {}).name || '') + '</dd><dt>Auto Compute Actuals ' + UI.i('autoActuals') + '</dt><dd>' + (r.autoActuals ? 'Sì' : 'No') + '</dd><dt>Giorni sovrallocati</dt><dd class="' + (prof.overDays ? 'neg' : '') + '">' + prof.overDays + '</dd></dl><div class="acts"><button type="button" class="btn sm" data-a="struttGo" data-t="res">Modifica in Struttura</button></div>', { style: 'flex:1 1 280px' }) +
        UI.card('Assegnazioni', UI.table(['Progetto', 'Attività', { t: 'Units/Time', n: 1 }, { t: 'Budgeted', n: 1 }, { t: 'Actual', n: 1 }, { t: 'Remaining', n: 1 }, { t: 'At completion', n: 1 }, 'Curva', { t: 'TF', n: 1 }, ''], asg, { empty: 'Nessuna assegnazione' }), { info: 'assignments', style: 'flex:2 1 520px' }) +
        UI.card('Come risolvere', sugg, { info: 'overalloc', style: 'flex:1 1 300px' }) + '</div>';
    }
  };

  function suggestions(prof, sc) {
    const r = prof.res;
    if (!r.maxUpd || !prof.rows.some((m) => m.over > 0.5)) return '<p class="muted">Nessuna sovrallocazione da risolvere per questa risorsa.</p>';
    const items = [];
    prof.lines.forEach((l) => {
      const s = l.project.sched && l.project.sched.acts[l.act.id]; if (!s || l.act.af) return;
      if (!s.crit && s.tf > 0) items.push('<li><span>Spostare <b>' + esc(l.act.code) + '</b> (' + esc(l.project.work) + ') entro il suo float di ' + s.tf + ' g</span><button type="button" class="btn sm" data-a="simShift" data-p="' + l.project.id + '" data-id="' + esc(l.act.id) + '">Simula</button></li>');
      else if (!l.act.as) { const others = 0; void others; items.push('<li><span><b>' + esc(l.act.code) + '</b> (' + esc(l.project.work) + ') in Fixed Units/Time con meno ' + esc(r.unit) + ' al giorno: durata più lunga</span><button type="button" class="btn sm" data-a="simFixedUnits" data-p="' + l.project.id + '" data-id="' + esc(l.act.id) + '" data-r="' + r.id + '">Simula</button></li>'); }
    });
    items.push('<li><span>Livellamento automatico entro il float su copia BKG e confronto</span><button type="button" class="btn sm" data-a="levelCopy" data-id="' + r.id + '">Avvia</button></li>');
    void sc;
    return '<ul class="actions">' + items.join('') + '</ul><p class="help">Le simulazioni aprono un\'anteprima sul progetto interessato: vedi l\'effetto sulle date e confermi o annulli.</p>';
  }

  /* livellamento semplice entro il float, su una copia */
  function levelProject(src, resId) {
    const copy = U.clone(src);
    const others = S.projects((p) => p.status === 'CURR' && p.id !== src.id);
    const res = S.res(resId);
    const moved = new Map();
    S.schedule(copy);
    for (let it = 0; it < 60; it++) {
      const scheds = {}; others.concat([copy]).forEach((p) => { scheds[p.id] = p.sched; });
      const prof = M.Costs.resourceProfile(S.db, resId, others.concat([copy]), scheds);
      const days = [...prof.daily.entries()].filter(([, v]) => v > res.maxUpd + 0.01).map(([d]) => d).sort((a, b) => a - b);
      if (!days.length) break;
      let done = false;
      for (const d of days) {
        const cands = copy.activities.filter((a) => !a.as && (a.assign || []).some((x) => x.resId === resId)).map((a) => ({ a, r: copy.sched.acts[a.id] })).filter((x) => x.r && x.r.es <= d && x.r.ef > d && !x.r.crit && x.r.tf > 0).sort((x, y) => y.r.tf - x.r.tf);
        for (const c of cands) {
          const cal = S.cal(c.a.calId || copy.calId) || M.CPM.DEFAULT_CAL;
          const need = M.Cal.between(cal, c.r.es, d + 1);
          const shift = Math.min(c.r.tf, Math.max(1, need));
          c.a.levelStart = U.isoOf(M.Cal.add(cal, c.r.es, shift));
          moved.set(c.a.id, (moved.get(c.a.id) || 0) + shift);
          S.schedule(copy); done = true; break;
        }
        if (done) break;
      }
      if (!done) break;
    }
    return { copy, moved };
  }

  Object.assign(M.A, {
    risPick(el) { S.ui.risSel = el.getAttribute('data-id'); S.saveUi(); M.App.render(true); },
    struttGo(el) { S.ui.struttTab = el.getAttribute('data-t'); S.saveUi(); M.App.go('struttura'); },
    simShift(el) {
      const pid = el.getAttribute('data-p'), id = el.getAttribute('data-id');
      if (pid !== S.db.activeProject && !S.setActive(pid)) return;
      const p = S.P(); const r = p.sched.acts[id]; const a = p.activities.find((x) => x.id === id);
      const cal = S.cal(a.calId || p.calId) || M.CPM.DEFAULT_CAL;
      S.mutate((w) => { const x = w.activities.find((y) => y.id === id); x.levelStart = U.isoOf(M.Cal.add(cal, r.es, r.tf)); }, { preview: true });
      UI.toast('Anteprima: ' + a.code + ' spostata in avanti di ' + r.tf + ' g (entro il float). Controlla il profilo e conferma o annulla.', 'info');
    },
    simFixedUnits(el) {
      const pid = el.getAttribute('data-p'), id = el.getAttribute('data-id'), rid = el.getAttribute('data-r');
      if (pid !== S.db.activeProject && !S.setActive(pid)) return;
      const res = S.res(rid);
      const sc = scope(); const prof = M.Costs.resourceProfile(S.db, rid, sc.projs, sc.scheds);
      const a = S.P().activities.find((x) => x.id === id); const asg = a.assign.find((x) => x.resId === rid);
      const peakOther = Math.max.apply(null, [...prof.daily.values()]) - asg.upd;
      const newUpd = Math.max(1, Math.min(asg.upd - 1, Math.floor(res.maxUpd - Math.max(0, peakOther))));
      S.mutate((w) => { const x = w.activities.find((y) => y.id === id); x.durType = 'FR'; const y = x.assign.find((z) => z.resId === rid); y.upd = newUpd; x.od = Math.ceil(y.bud / newUpd); }, { preview: true });
      UI.toast('Anteprima: ' + a.code + ' a ' + newUpd + ' ' + res.unit + '/g (Fixed Units/Time), durata ' + Math.ceil(asg.bud / newUpd) + ' g.', 'info');
    },
    levelCopy(el) {
      const rid = el.getAttribute('data-id'); const res = S.res(rid);
      if (!res.maxUpd) { UI.toast('La risorsa non ha una disponibilità massima: niente da livellare.', 'info'); return; }
      const src = S.P();
      const { copy, moved } = levelProject(src, rid);
      const pc = S.cal(src.calId) || M.CPM.DEFAULT_CAL;
      const dFin = M.Cal.between(pc, src.sched.finish, copy.sched.finish);
      const code = src.work + '_' + U.isoOf(U.dnOf(src.dataDate)) + '_livellato_' + res.code;
      const rows = [...moved.entries()].map(([id, d]) => { const a = copy.activities.find((x) => x.id === id); return '<tr><td class="mono">' + esc(a.code) + '</td><td>' + esc(a.name) + '</td><td class="n">+' + d + ' g</td></tr>'; });
      UI.modal({ title: 'Livellamento di ' + res.name + ' su copia', info: 'leveling', body: '<p>Attività spostate entro il float: <b>' + moved.size + '</b>. Fine del progetto: <b class="' + UI.dayCls(-dFin) + '">' + (dFin ? U.signed(dFin) + ' g' : 'invariata') + '</b>.</p>' + UI.table(['ID', 'Attività', { t: 'Spostamento', n: 1 }], rows, { empty: 'Nessuna attività spostabile entro il float: servono durate più lunghe o più risorse.' }) + '<p class="help">La copia viene salvata nel nodo BKG come ' + esc(code) + ' e si confronta con il corrente in Baseline ed EV.</p>', foot: '<button type="button" class="btn" data-a="closeModal">Scarta</button><button type="button" class="btn-p" data-a="levelSave">Salva la copia in BKG e confronta</button>', after: () => { M.Views.risorse._lv = { copy, code }; } });
    },
    levelSave() {
      const lv = M.Views.risorse._lv; if (!lv) return;
      const src = S.confirmed();
      const p = S.copyProject(lv.copy, { code: lv.code, name: (src.workName || '') + ' - livellato', status: 'BKG', epsId: S.epsNodeFor(src.work, 'BKG') || src.epsId, savedAt: U.isoOf(U.todayDn()) });
      UI.closeModal();
      S.ui.ctrlA = src.id; S.ui.ctrlB = p.id; S.saveUi();
      UI.toast('Copia ' + p.code + ' salvata in BKG. Confronto aperto.', 'ok');
      M.App.go('controllo');
    }
  });
})(window.M = window.M || {});
