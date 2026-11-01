/* Meridian - telefono: sola lettura con Sintesi, Programma, Controllo */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;

  function sintesi(ctx) {
    const p = ctx.p, s = ctx.s, e = ctx.ev;
    const dBL = ctx.bls ? M.Cal.between(ctx.pcal, s.finish, ctx.bls.finish) : null;
    const DD = U.dnOf(p.dataDate);
    const act = p.activities.filter((a) => a.as && !a.af && a.type !== 'loe');
    const next = p.activities.filter((a) => !a.as && (s.acts[a.id] || {}).crit).sort((a, b) => s.acts[a.id].es - s.acts[b.id].es).slice(0, 3);
    const li = (a, chip) => { const d = VH.dates(ctx, a); return '<li><span><span class="mono">' + esc(a.code) + '</span> ' + esc(a.name) + '<br><span class="small muted">' + (a.as ? U.pct(M.Costs.actPct(a, s.acts[a.id], S.db)) + ' - fine ' + U.fd(d.finish) : M.CPM.isMile(a) ? U.fd(d.finish !== null ? d.finish : d.start) : 'inizio ' + U.fd(d.start)) + '</span></span>' + chip + '</li>'; };
    return '<section class="mcd"><p class="ey">Fine prevista</p><div class="big">' + U.fd(s.finishDay) + '</div><p>' + (dBL !== null ? '<span class="' + UI.dayCls(dBL) + '">' + U.signed(dBL) + ' g</span> sulla baseline (' + U.fd(ctx.bls.finishDay) + ')' : 'nessuna baseline') + '</p><p class="small muted">Data date ' + U.fd(DD) + ' - programma <span class="mono">' + esc(p.code) + '</span></p></section>' +
      '<div class="mkg"><div class="mk"><p class="ey">SPI</p><b class="' + (e.SPI < 0.95 ? 'neg' : '') + '">' + U.num(e.SPI) + '</b><small>' + (e.SPI < 1 ? 'in ritardo' : 'in linea') + '</small></div><div class="mk"><p class="ey">CPI</p><b class="' + (e.CPI < 0.95 ? 'neg' : '') + '">' + U.num(e.CPI) + '</b><small>' + (e.CPI < 1 ? 'sopra budget' : 'nel budget') + '</small></div></div>' +
      '<section class="mcd"><p class="ey">In corso e prossime critiche</p><ul class="mli">' + act.map((a) => li(a, '<span class="chip info">In corso</span>')).join('') + next.map((a) => li(a, '<span class="chip bad">' + ((s.acts[a.id] || {}).tf < 0 ? 'TF ' + s.acts[a.id].tf : 'Critica') + '</span>')).join('') + '</ul></section>' +
      '<section class="mcd"><p class="ey">Stato del programma</p><ul class="mli"><li><span>Ultima schedulazione</span><b>' + U.fd(s.ranAt ? s.ranAt.slice(0, 10) : '') + '</b></li><li><span>Avvisi del log</span><span class="chip warn">' + (s.warnings || 0) + '</span></li><li><span>Percorsi critici</span><b>' + (s.paths || []).length + '</b></li><li><span>Issue aperti</span><span class="chip bad">' + (p.issues || []).filter((i) => i.status !== 'Chiuso').length + '</span></li><li><span>Prossimo cut-off</span><b>' + U.fd(p.nextCutoff) + '</b></li>' + (p.dirty ? '<li><span>Dati cambiati dopo l\'ultimo F9</span><span class="chip warn">Da ricalcolare</span></li>' : '') + '</ul></section>';
  }

  function programma(ctx) {
    const f = S.ui.mFilter || 'all'; const s = ctx.s;
    const acts = ctx.p.activities.filter((a) => a.type !== 'wbs').filter((a) => f === 'crit' ? (s.acts[a.id] || {}).crit : f === 'act' ? a.as && !a.af : true).sort((a, b) => { const da = VH.dates(ctx, a), db = VH.dates(ctx, b); return (da.start !== null ? da.start : da.finish) - (db.start !== null ? db.start : db.finish); });
    return '<div class="mseg" role="group" aria-label="Filtro">' + [['all', 'Tutte'], ['crit', 'Critiche'], ['act', 'In corso']].map(([k, l]) => '<button type="button" class="' + (f === k ? 'on' : '') + '" aria-pressed="' + (f === k) + '" data-a="mFilter" data-k="' + k + '">' + l + '</button>').join('') + '</div><ul class="mlist">' + acts.map((a) => {
      const r = s.acts[a.id] || {}; const d = VH.dates(ctx, a); const open = S.ui.mOpen === a.id;
      const col = r.crit ? VH.pathColor(r.path) : r.sub ? VH.SUBCOLOR : a.af ? '#2b6fd6' : '#2f9455';
      return '<li><button type="button" class="mrow" data-a="mOpen" data-id="' + esc(a.id) + '" aria-expanded="' + open + '"><i style="background:' + col + '"></i><span class="mt"><span class="mono">' + esc(a.code) + '</span> ' + esc(a.name) + '<br><span class="small muted">' + (d.start !== null ? U.fd(d.start) + (d.sA ? ' A' : '') : '') + (d.start !== null && d.finish !== null ? ' - ' : '') + (d.finish !== null ? U.fd(d.finish) + (d.fA ? ' A' : '') : '') + '</span></span><span class="mr">' + (a.af ? '<span class="chip ok">Fatta</span>' : a.as ? '<span class="chip info">' + U.num(M.Costs.actPct(a, r, S.db), 0) + '%</span>' : r.tf !== null && r.tf !== undefined ? '<span class="chip ' + (r.tf < 0 ? 'bad' : r.crit ? 'bad' : 'neutral') + '">TF ' + r.tf + '</span>' : '') + '</span></button>' + (open ? '<div class="mdet"><p>' + esc(r.why || '') + '</p><dl class="kv"><dt>Durata</dt><dd>' + (a.od || 0) + ' g' + (a.as && !a.af ? ', rimanente ' + (a.rd || 0) + ' g' : '') + '</dd><dt>Total float</dt><dd>' + (r.tf === null || r.tf === undefined ? '-' : r.tf + ' g') + '</dd><dt>Baseline</dt><dd>' + U.fd(VH.blDates(ctx, a).finish) + '</dd><dt>Tavole</dt><dd>' + (VH.fieldsAll().drawings.get(ctx, a) || '-') + '</dd></dl></div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function controllo(ctx) {
    const e = ctx.ev; M.VH.lastEV = e;
    const k = ['SPI', 'CPI', 'SV', 'CV', 'EAC', 'VAC', 'TCPI', 'BAC'];
    const rows = M.Costs.curves(ctx.p, ctx.s, ctx.bl, ctx.bls, S.db, e);
    const ddi = rows.findIndex((r) => r.key === U.monthKey(U.dnOf(ctx.p.dataDate)));
    const chart = UI.lineChart({ w: 360, h: 220, ml: 40, mr: 64, maxLabels: 5, labels: rows.map((r) => U.monthLabel(r.key, true)), yFmt: (v) => U.num(v / 1e6, 1) + 'M', series: [{ name: 'PV', color: '#b88a00', pts: rows.map((r, i) => [i, r.pv]), endFmt: () => '' }, { name: 'EV', color: '#2f9455', pts: rows.map((r, i) => (r.ev !== undefined ? [i, r.ev] : null)), label: false }, { name: 'AC', color: '#cf3a3a', pts: rows.map((r, i) => (r.ac !== undefined ? [i, r.ac] : null)), label: false }, { name: 'EAC', color: '#cf3a3a', dash: '3 3', pts: rows.map((r, i) => (r.fc !== undefined ? [i, r.fc] : null)), endFmt: () => '' }], vline: ddi, vlabel: '', marks: ddi >= 0 ? [{ x: ddi, y: e.EV, color: '#2f9455', label: 'EV', dy: 14 }, { x: ddi, y: e.AC, color: '#cf3a3a', label: 'AC' }] : [] });
    const fld = VH.fieldsAll();
    const vr = ctx.p.activities.map((a) => ({ a, v: fld.varFinish.get(ctx, a) })).filter((x) => x.v !== null && x.v < 0).sort((x, y) => x.v - y.v).slice(0, 5);
    return '<div class="mkg">' + k.map((x) => { const ev = M.Info.EVI[x]; const l = ev.light(e); return '<div class="mk ' + (l || '') + '"><p class="ey">' + x + ' ' + UI.i(x, true) + '</p><b class="' + (l === 'bad' ? 'neg' : '') + '">' + (['SPI', 'CPI', 'TCPI'].includes(x) ? U.num(e[x]) : U.keur(e[x])) + '</b><small>' + esc(ev.say(e)) + '</small></div>'; }).join('') + '</div><section class="mcd"><p class="ey">Curve cumulate</p>' + chart + UI.legend([['PV', '#b88a00'], ['EV', '#2f9455'], ['AC', '#cf3a3a']]) + '</section><section class="mcd"><p class="ey">Scostamenti sulla fine</p><ul class="mli">' + vr.map((x) => '<li><span><span class="mono">' + esc(x.a.code) + '</span> ' + esc(x.a.name) + '</span><b class="neg">' + U.signed(x.v) + ' g</b></li>').join('') + '</ul></section><section class="mcd"><p class="ey">Issue aperti</p><ul class="mli">' + (ctx.p.issues || []).filter((i) => i.status !== 'Chiuso').map((i) => '<li><span><span class="mono">' + esc(i.id) + '</span> ' + esc(i.title) + '</span><span class="chip ' + (i.prio === 'Alta' ? 'bad' : i.prio === 'Media' ? 'warn' : 'info') + '">' + esc(i.prio) + '</span></li>').join('') + '</ul></section>';
  }

  M.Views.mobile = {
    render() {
      const tab = S.ui.mTab || 'sintesi';
      const ctx = VH.ctx(S.confirmed());
      const projs = S.projects((p) => p.status === 'CURR');
      const body = { sintesi, programma, controllo }[tab](ctx);
      const T = [['sintesi', 'Sintesi', 'grid'], ['programma', 'Programma', 'bars'], ['controllo', 'Controllo', 'gauge']];
      return '<div class="ph"><header class="mhd"><div class="mhr"><span class="mbn">' + UI.logo(28) + 'Meridian</span><span class="mro">' + UI.ic('lock', 14) + 'Sola lettura</span></div><label class="mlab">Progetto<select class="mps" data-c="mProject">' + projs.map((p) => '<option value="' + p.id + '"' + (p.id === S.db.activeProject ? ' selected' : '') + '>' + esc(p.work + ' ' + (p.workName || '')) + '</option>').join('') + '</select></label></header><main class="mct">' + body + '<div class="mnt">' + UI.ic('monitor') + '<span>Per modificare il programma apri Meridian da tablet o computer.' + (S.ui.forcePhone ? ' <button type="button" class="lnk" data-a="exitPhone">Torna alla vista completa</button>' : '') + '</span></div></main><nav class="mtb" aria-label="Sezioni">' + T.map(([k, l, ic]) => '<button type="button" class="' + (k === tab ? 'on' : '') + '"' + (k === tab ? ' aria-current="page"' : '') + ' data-a="mTab" data-k="' + k + '">' + UI.ic(ic, 22) + l + '</button>').join('') + '</nav></div>';
    }
  };
  Object.assign(M.A, {
    mTab(el) { S.ui.mTab = el.getAttribute('data-k'); S.saveUi(); M.App.render(); window.scrollTo(0, 0); },
    mFilter(el) { S.ui.mFilter = el.getAttribute('data-k'); S.saveUi(); M.App.render(); },
    mOpen(el) { const id = el.getAttribute('data-id'); S.ui.mOpen = S.ui.mOpen === id ? null : id; S.saveUi(); M.App.render(); }
  });
  M.C.mProject = function (el) { if (S.preview) { UI.toast('C\'è un\'anteprima aperta su computer: viene mostrata la versione confermata.', 'info'); } S.db.activeProject = el.value; S.save(); M.App.render(); };
})(window.M = window.M || {});
