/* Meridian - guscio dell'applicazione: navigazione, barra superiore, banda anteprima, eventi globali */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, esc = U.esc;
  M.Views = M.Views || {};
  M.A = M.A || {};
  M.C = M.C || {};
  M.I = M.I || {};

  const NAV = [
    ['Enterprise', [['portafoglio', 'Portafoglio', 'grid'], ['struttura', 'Struttura', 'tree']]],
    ['Progetto aperto', [['attivita', 'Attività e Gantt', 'bars'], ['schedula', 'Schedulazione', 'clock'], ['risorse', 'Risorse', 'users'], ['costi', 'Costi', 'euro']]],
    ['Controllo', [['avanzamento', 'Avanzamento', 'refresh'], ['controllo', 'Baseline ed EV', 'gauge']]],
    ['Altro', [['scambio', 'Scambio dati', 'exchange'], ['admin', 'Amministrazione', 'cog'], ['catalogo', 'Catalogo info', 'info']]]
  ];

  const App = {
    route() { const h = (location.hash || '').replace(/^#\/?/, '').split('/')[0]; return h || S.ui.route || 'portafoglio'; },
    go(r) { if (location.hash !== '#/' + r) location.hash = '#/' + r; else App.render(); },
    isPhone() { return S.ui.forcePhone || (window.matchMedia && window.matchMedia('(max-width: 640px)').matches); },

    render(keepScroll) {
      UI.closePop();
      const phone = App.isPhone();
      S.phone = phone;
      const root = document.getElementById('app');
      const r = App.route();
      S.ui.route = r; S.saveUi();
      document.body.classList.toggle('expert', !!S.S().expert);
      document.body.classList.toggle('guide-off', !S.S().guideMode);
      if (phone) { root.innerHTML = M.Views.mobile.render(); if (M.Views.mobile.after) M.Views.mobile.after(); return; }
      const v = M.Views[r] || M.Views.portafoglio;
      const scr = keepScroll ? App.saveScroll() : null;
      let main;
      try { main = v.render(); } catch (e) { console.error(e); main = '<div class="card"><h2>Errore nella vista</h2><p>' + esc(e.message) + '</p><pre class="mono small">' + esc(e.stack || '') + '</pre></div>'; }
      root.innerHTML = '<div class="app">' + App.top() + App.band() + '<div class="body">' + App.rail(r) + '<main class="main" id="main" tabindex="-1">' + main + '</main></div></div>';
      document.title = (v.title ? v.title + ' - ' : '') + 'Meridian';
      const topEl = root.querySelector('.top'); if (topEl) document.documentElement.style.setProperty('--toph', topEl.offsetHeight + 'px');
      if (v.after) { try { v.after(); } catch (e) { console.error(e); } }
      if (scr) App.restoreScroll(scr);
    },
    saveScroll() { const o = { win: window.scrollY }; U.$$('[data-keep]').forEach((el) => { o[el.getAttribute('data-keep')] = [el.scrollLeft, el.scrollTop]; }); return o; },
    restoreScroll(o) { window.scrollTo(0, o.win); U.$$('[data-keep]').forEach((el) => { const v = o[el.getAttribute('data-keep')]; if (v) { el.scrollLeft = v[0]; el.scrollTop = v[1]; } }); },

    top() {
      const c = S.confirmed(), p = S.P();
      const bl = S.baseline(p);
      const projs = S.projects();
      const groups = [['CURR', 'Programmi correnti'], ['BKG', 'Copie e scenari (BKG)'], ['BASE', 'Baseline (BASE)']];
      const sel = '<select class="psel" data-c="project" aria-label="Progetto aperto">' + groups.map(([k, l]) => { const list = projs.filter((x) => x.status === k); return list.length ? '<optgroup label="' + l + '">' + list.map((x) => '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.code) + '</option>').join('') + '</optgroup>' : ''; }).join('') + '</select>';
      let status = '';
      if (S.inPreview()) status = '<span class="chip warn big">Anteprima non confermata</span>';
      else if (c.dirty) status = '<button type="button" class="chip warn big btnchip" data-a="f9">Da ricalcolare</button>' + UI.i('dirty');
      if (c.status === 'BASE') status += '<span class="chip info big">Baseline: sola lettura</span>';
      const u = S.user();
      return '<header class="top"><a class="brand" href="#/portafoglio" aria-label="Meridian, torna al portafoglio">' + UI.logo(34) + '<span class="bt"><b>Meridian</b><small>by nautargo</small></span></a>' +
        '<label class="pill">Progetto aperto ' + sel + '</label>' +
        '<span class="pill">Data date <span class="mono">' + U.fd(p.dataDate) + '</span>' + UI.i('dataDate') + '</span>' +
        '<span class="pill hide-sm">Baseline <span class="mono">' + esc(bl ? bl.code : 'nessuna') + '</span></span>' +
        status + '<span class="sp"></span>' +
        (S.S().recalcMode === 'preview' ? '<span class="pill hide-sm">Ricalcolo: anteprima</span>' : '') +
        '<button type="button" class="btn-w" data-a="f9" title="Schedula (F9)">' + UI.ic('clock') + (S.inPreview() ? 'Conferma' : 'Schedula') + ' <kbd>F9</kbd></button>' + UI.i('f9') +
        '<button type="button" class="ib" data-a="userMenu" aria-label="Utente: ' + esc(u.name) + ', ' + esc(S.role().name) + '" title="' + esc(u.name + ' - ' + S.role().name) + '"><span class="ini">' + esc(u.name.slice(0, 1).toUpperCase()) + '</span></button></header>';
    },

    band() {
      if (!S.inPreview()) return '';
      const d = S.previewDiff();
      let txt;
      if (!d || d.error) txt = '<b>Anteprima non confermata</b>: il calcolo segnala errori (vedi log).';
      else txt = '<b>Anteprima non confermata</b> - ' + d.moved.length + ' attività spostate, fine ' + (d.dFinish ? '<b class="' + (d.dFinish > 0 ? 'neg' : 'pos') + '">' + U.signed(d.dFinish) + ' g</b>' : 'invariata') + ' (' + U.fd(d.finishTo) + ')' + (d.critChanged ? ', <b>percorso critico cambiato</b>' : '') + '.';
      const conflict = S.conflict ? '<span class="chip bad">Conflitto: versione ' + S.conflict.version + ' confermata da ' + esc(S.conflict.by || 'altro utente') + '</span>' + UI.i('conflict') : '';
      return '<div class="band" role="status">' + UI.ic('alert') + '<span>' + txt + '</span>' + conflict + UI.i('preview') + '<span class="sp"></span><button type="button" class="btn sm" data-a="previewDetails">Vedi cosa cambia</button><button type="button" class="btn sm" data-a="previewCancel">Annulla</button><button type="button" class="btn-p sm" data-a="previewConfirm">Conferma tutto</button></div>';
    },

    rail(r) {
      const c = S.confirmed();
      const pendingField = (c.progress || []).filter((x) => x.status === 'Inviato').length + (c.proposals || []).filter((x) => x.status === 'Inviata').length;
      return '<nav class="rail" aria-label="Moduli"><div class="nav">' + NAV.map(([lab, items]) => '<div class="lab">' + lab + '</div>' + items.map(([id, name, ic]) => '<a href="#/' + id + '" class="' + (r === id ? 'on' : '') + '"' + (r === id ? ' aria-current="page"' : '') + '>' + UI.ic(ic) + '<span>' + name + '</span>' + (id === 'avanzamento' && pendingField ? '<em class="cnt">' + pendingField + '</em>' : '') + '</a>').join('')).join('') +
        '<a href="guida/index.html" target="_blank" rel="noopener">' + UI.ic('book') + '<span>Guida P6</span></a></div>' +
        '<div class="railf"><div class="rl"><label class="sw"><input type="checkbox" data-c="guideMode"' + (S.S().guideMode ? ' checked' : '') + '> Modalità guida</label>' + UI.i('guideMode', true) + '</div>' +
        '<div class="rl"><label class="sw"><input type="checkbox" data-c="expert"' + (S.S().expert ? ' checked' : '') + '> Esperto</label>' + UI.i('expert', true) + '</div>' +
        '<button type="button" class="lnk" data-a="phonePreview">' + UI.ic('phone', 16) + ' Vista telefono</button><span class="ver">Meridian 1.0 - dati nel browser</span></div></nav>';
    }
  };
  M.App = App;

  /* ---------- azioni globali ---------- */
  Object.assign(M.A, {
    info(el) { if (UI.popOpenFor(el)) UI.closePop(); else UI.popInfo(el); },
    closePop() { UI.closePop(); },
    closeModal() { UI.closeModal(); },
    f9() {
      if (S.inPreview()) return M.A.previewConfirm();
      const c = S.confirmed();
      if (!S.can('schedule', c)) { UI.toast('Il tuo ruolo non permette di schedulare.', 'warn'); return; }
      const before = c.sched && c.sched.finishDay;
      const r = S.f9();
      if (!r.ok) { UI.toast('Schedulazione non riuscita: ' + r.sched.errors + ' errori (loop). Apri il log.', 'bad'); App.go('schedula'); return; }
      const d = before ? M.Cal.between(S.cal(c.calId) || M.CPM.DEFAULT_CAL, before + 1, r.sched.finish) : 0;
      UI.toast('Schedulato: fine ' + U.fd(r.sched.finishDay) + (d ? ' (' + U.signed(d) + ' g)' : '') + ', ' + r.sched.errors + ' errori, ' + r.sched.warnings + ' avvisi, ' + r.sched.paths.length + ' percorsi critici.', 'ok');
    },
    previewCancel() { UI.confirm('Annullare l\'anteprima?', 'Tutte le modifiche fatte in anteprima verranno scartate e torni allo schedule confermato.', 'Annulla anteprima', () => { S.cancelPreview(); UI.toast('Anteprima annullata: ripristinato lo schedule confermato.', 'info'); }, true); },
    previewConfirm() {
      const d = S.previewDiff();
      if (!d || d.error) { UI.toast('L\'anteprima contiene errori di calcolo: correggili o annulla.', 'bad'); return; }
      UI.modal({ title: 'Conferma l\'anteprima', info: 'versions', body: M.Views.previewSummary(d) + '<label class="fld">Nota della versione<input class="inp" id="pv-note" placeholder="Es. accorciata A1020 con seconda squadra"></label><p class="help">La conferma è tutto o niente e crea la versione ' + ((S.confirmed().version || 0) + 1) + ' con autore, data e nota.</p>', foot: '<button type="button" class="btn" data-a="closeModal">Torna all\'anteprima</button><button type="button" class="btn-p" data-a="previewDoConfirm">Conferma tutto</button>' });
    },
    previewDoConfirm(el, ev, force) {
      const noteEl = document.getElementById('pv-note');
      const note = noteEl ? noteEl.value : '';
      const r = S.confirmPreview(note, force === true);
      if (r.conflict) {
        UI.closeModal();
        UI.modal({ title: 'Conflitto con un altro utente', info: 'conflict', body: '<p>Mentre lavoravi in anteprima, <b>' + esc(r.conflict.by || 'un altro utente') + '</b> ha confermato la versione <b>' + r.conflict.version + '</b> di questo progetto' + (r.conflict.at ? ' (' + U.fts(r.conflict.at) + ')' : '') + '.</p><p>(a) Sovrascrivi: la tua anteprima diventa la versione successiva e le loro modifiche si perdono. (b) Annulla l\'anteprima e riparti dalla versione nuova.</p>', foot: '<button type="button" class="btn" data-a="previewCancelNow">(b) Annulla e ricarica</button><button type="button" class="btn-d" data-a="previewForce">(a) Sovrascrivi</button>' });
        return;
      }
      if (!r.ok) { UI.toast('Conferma non riuscita.', 'bad'); return; }
      UI.closeModal();
      UI.toast('Anteprima confermata: creata la versione ' + S.confirmed().version + '.', 'ok');
    },
    previewForce() { UI.closeModal(); M.A.previewDoConfirm(null, null, true); },
    previewCancelNow() { UI.closeModal(); S.cancelPreview(); },
    previewDetails() { const d = S.previewDiff(); UI.modal({ title: 'Cosa cambia rispetto allo schedule confermato', wide: true, info: 'preview', body: M.Views.previewSummary(d, true) }); },
    userMenu(el) {
      const u = S.user();
      const html = '<b class="pt">Utente attivo</b><p class="small">I permessi dipendono dal ruolo e dal ramo OBS. Cambia utente per provare i ruoli.</p>' + S.db.users.map((x) => '<button type="button" class="menuit' + (x.id === u.id ? ' on' : '') + '" data-a="switchUser" data-id="' + x.id + '">' + esc(x.name) + ' <small>' + esc((S.ROLES[x.role] || {}).name || x.role) + '</small></button>').join('') + '<hr><a class="menuit" href="#/admin">Amministrazione e preferenze</a>';
      UI.popover(el, html);
    },
    switchUser(el) {
      if (S.inPreview()) { UI.toast('Conferma o annulla l\'anteprima prima di cambiare utente.', 'warn'); return; }
      S.db.currentUser = el.getAttribute('data-id'); S.save(); UI.closePop();
      if (!S.obsAllows(S.confirmed())) { const first = S.projects((p) => p.status === 'CURR')[0]; if (first) S.db.activeProject = first.id; }
      UI.toast('Ora sei ' + S.user().name + ' (' + S.role().name + ').', 'info');
      App.render();
    },
    phonePreview() { S.ui.forcePhone = true; S.saveUi(); App.render(); },
    exitPhone() { S.ui.forcePhone = false; S.saveUi(); App.render(); },
    go(el) { App.go(el.getAttribute('data-r')); },
    selAct(el) { S.ui.sel = el.getAttribute('data-id'); S.saveUi(); if (el.getAttribute('data-r')) App.go(el.getAttribute('data-r')); else App.render(true); }
  });
  Object.assign(M.C, {
    project(el) { if (!S.setActive(el.value)) { el.value = S.confirmed().id; } },
    guideMode(el) { S.db.settings.guideMode = el.checked; S.save(); App.render(true); },
    expert(el) { S.db.settings.expert = el.checked; S.save(); App.render(true); }
  });

  /* riepilogo dell'anteprima (usato da banda e conferma) */
  M.Views.previewSummary = function (d, full) {
    if (!d) return '<p>Nessuna anteprima aperta.</p>';
    const rows = d.moved.slice(0, full ? 500 : 12).map((m) => '<tr><td class="mono">' + esc(m.act.code) + '</td><td>' + esc(m.act.name) + '</td><td class="n ' + UI.dayCls(-(m.ds || 0)) + '">' + (m.isNew ? 'nuova' : U.signed(m.ds || 0) + ' g') + '</td><td class="n ' + UI.dayCls(-(m.df || 0)) + '">' + (m.isNew ? '' : U.signed(m.df || 0) + ' g') + '</td><td>' + (m.isNew ? '' : m.critFrom === m.critTo ? (m.critTo ? 'critica' : '') : m.critTo ? '<b class="neg">diventa critica</b>' : '<b class="pos">non più critica</b>') + '</td></tr>');
    return '<div class="kpis"><div class="kpi"><p class="ey">Fine progetto</p><div class="v ' + UI.dayCls(-d.dFinish) + '">' + U.fd(d.finishTo) + '</div><p>' + (d.dFinish ? U.signed(d.dFinish) + ' g rispetto a ' + U.fd(d.finishFrom) : 'invariata') + '</p></div><div class="kpi"><p class="ey">Attività spostate</p><div class="v">' + d.moved.length + '</div><p>' + d.changes + ' modifiche in anteprima</p></div><div class="kpi"><p class="ey">Percorsi critici</p><div class="v">' + d.pathsTo + '</div><p>' + (d.critChanged ? 'cambiato (prima ' + d.pathsFrom + ')' : 'invariato') + '</p></div></div>' +
      UI.table(['ID', 'Attività', { t: 'Delta inizio', n: 1 }, { t: 'Delta fine', n: 1 }, 'Criticità'], rows, { empty: 'Nessuna attività spostata' }) + (!full && d.moved.length > 12 ? '<p class="help">Altre ' + (d.moved.length - 12) + ' attività: usa "Vedi cosa cambia".</p>' : '');
  };

  /* ---------- eventi globali ---------- */
  function dispatch(map, name, el, ev) {
    const f = map[name];
    if (!f) { console.warn('azione mancante', name); return; }
    try { f(el, ev); } catch (e) { console.error(e); UI.toast('Errore: ' + e.message, 'bad'); }
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-a]');
    if (el && !el.disabled) {
      if (el.tagName === 'A' && !el.getAttribute('href')) ev.preventDefault();
      if (el.tagName === 'TR' && ev.target.closest('input, select, button, a, textarea, label')) return;
      dispatch(M.A, el.getAttribute('data-a'), el, ev);
      return;
    }
    if (!ev.target.closest('.pop') && !ev.target.closest('[data-a="info"]')) UI.closePop();
  });
  document.addEventListener('change', (ev) => { const el = ev.target.closest('[data-c]'); if (el) dispatch(M.C, el.getAttribute('data-c'), el, ev); });
  const inputDeb = U.debounce((el, ev) => dispatch(M.I, el.getAttribute('data-i'), el, ev), 220);
  document.addEventListener('input', (ev) => { const el = ev.target.closest('[data-i]'); if (el) inputDeb(el, ev); });
  document.addEventListener('keydown', (ev) => {
    const inField = /INPUT|TEXTAREA|SELECT/.test((ev.target.tagName || '')) || ev.target.isContentEditable;
    if (ev.key === 'F9') { ev.preventDefault(); if (!App.isPhone()) M.A.f9(); return; }
    if (ev.key === 'Escape') { if (document.querySelector('.pop')) { UI.closePop(); return; } if (UI.modalOpen()) { UI.closeModal(); return; } }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !inField && !UI.modalOpen()) { ev.preventDefault(); S.undoLast(); App.render(true); }
    const v = M.Views[App.route()];
    if (v && v.key && !inField && !UI.modalOpen()) v.key(ev);
  });
  document.addEventListener('paste', (ev) => {
    const inField = /INPUT|TEXTAREA|SELECT/.test((ev.target.tagName || ''));
    if (inField || UI.modalOpen()) return;
    const v = M.Views[App.route()];
    if (v && v.paste) { const t = ev.clipboardData && ev.clipboardData.getData('text/plain'); if (t) { ev.preventDefault(); v.paste(t); } }
  });
  window.addEventListener('hashchange', () => App.render());
  window.addEventListener('beforeunload', (ev) => { if (S.inPreview()) { ev.preventDefault(); ev.returnValue = 'Anteprima non confermata'; return 'Anteprima non confermata'; } });
  let lastPhone = null;
  window.addEventListener('resize', U.debounce(() => { const ph = App.isPhone(); if (ph !== lastPhone) { lastPhone = ph; App.render(); } }, 200));
  window.addEventListener('online', () => { if (M.Views.avanzamento && M.Views.avanzamento.syncOutbox) M.Views.avanzamento.syncOutbox(true); });

  S.on((why) => {
    if (why === 'preview-block') { UI.modal({ title: 'Anteprima aperta', info: 'preview', body: '<p>Hai un\'anteprima non confermata su <b>' + esc(S.confirmed().code) + '</b>. Confermala o annullala prima di cambiare progetto.</p>', foot: '<button type="button" class="btn" data-a="closeModal">Resta qui</button><button type="button" class="btn" data-a="previewCancel">Annulla anteprima</button><button type="button" class="btn-p" data-a="previewConfirm">Conferma</button>' }); App.render(true); return; }
    if (why === 'remote') { if (!UI.modalOpen()) App.render(true); if (S.conflict) UI.toast('Un altro utente ha confermato una nuova versione di questo progetto.', 'warn'); return; }
    App.render(true);
  });

  /* avvio */
  window.addEventListener('DOMContentLoaded', () => {
    S.init();
    lastPhone = App.isPhone();
    if (!location.hash) location.hash = '#/' + (S.ui.route || 'portafoglio');
    App.render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})(window.M = window.M || {});
