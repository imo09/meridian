/* Meridian - 02 Struttura: EPS e OBS, progetto e WBS, calendari, risorse, codici e UDF, curve e conti, financial periods, tavole */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;
  const TABS = [['eps', 'EPS e OBS'], ['wbs', 'Progetto e WBS'], ['cal', 'Calendari'], ['res', 'Risorse e ruoli'], ['codes', 'Codici e UDF'], ['curves', 'Curve e conti'], ['fp', 'Financial periods'], ['draw', 'Registro tavole']];
  const can = () => S.can('structure');
  const dis = () => (can() ? '' : ' disabled');
  const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

  function tabEps() {
    const tree = (list, parent, lvl, render) => list.filter((x) => (x.parent || null) === parent).map((x) => render(x, lvl) + tree(list, x.id, lvl + 1, render)).join('');
    const eps = tree(S.db.eps, null, 0, (e, l) => '<div class="tr l' + l + '">' + (e.kind === 'node' ? '<b class="mono">' + esc(e.code) + '</b> ' + esc(e.name) : '<span class="node n' + e.kind + '">' + e.kind + '</span> ' + S.db.projects.filter((p) => p.epsId === e.id).map((p) => '<span class="mono small">' + esc(p.code) + '</span>').join(', ')) + (e.obs ? ' <span class="muted small">resp. ' + esc((S.db.obs.find((o) => o.id === e.obs) || {}).name || '') + '</span>' : '') + '</div>');
    const obs = tree(S.db.obs, null, 0, (o, l) => '<div class="tr l' + l + '"><input class="inp sm" value="' + esc(o.name) + '" data-c="obsName" data-id="' + o.id + '"' + dis() + ' aria-label="Nome OBS"> <span class="muted small">' + S.db.users.filter((u) => u.obs === o.id).map((u) => esc(u.name)).join(', ') + '</span>' + (can() ? '<button type="button" class="ibx" data-a="obsAdd" data-id="' + o.id + '" aria-label="Aggiungi figlio">' + UI.ic('plus', 15) + '</button>' + (o.parent ? '<button type="button" class="ibx" data-a="obsDel" data-id="' + o.id + '" aria-label="Elimina">' + UI.ic('trash', 15) + '</button>' : '') : '') + '</div>');
    return '<div class="row">' + UI.card('EPS', '<div class="tree">' + eps + '</div><div class="acts"><button type="button" class="btn sm" data-a="newEps">Nuovo nodo EPS</button></div>', { info: 'eps', style: 'flex:1 1 380px' }) + UI.card('OBS e responsabili', '<div class="tree">' + obs + '</div><p class="help">I permessi degli utenti seguono il ramo OBS: un utente vede i progetti del proprio nodo e dei figli.</p>', { info: 'obs', style: 'flex:1 1 380px' }) + '</div>';
  }

  function tabWbs() {
    const ctx = VH.ctx(); const p = ctx.p;
    const canS = S.can('schedule');
    const d2 = canS ? '' : ' disabled';
    const kids = new Map(); (p.wbs || []).forEach((w) => { const k = w.parent || '__'; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(w); });
    const rows = [];
    const walk = (w, l) => {
      const set = M.Costs.wbsFilter(p, w.id);
      const acts = p.activities.filter(set);
      const ds = acts.map((a) => VH.dates(ctx, a));
      const st = ds.map((d) => (d.start !== null ? d.start : d.finish)).filter((x) => x !== null), fi = ds.map((d) => (d.finish !== null ? d.finish : d.start)).filter((x) => x !== null);
      const bud = U.sum(acts, (a) => (ctx.ev.per[a.id] || {}).bud || 0);
      rows.push('<tr class="' + (w.id === S.ui.wbsSel ? 'sel' : '') + '"><td style="padding-left:' + (8 + l * 18) + 'px"><button type="button" class="lnk" data-a="wbsPick" data-id="' + w.id + '"><span class="mono">' + esc(VH.wbsPath(ctx, w.id)) + '</span></button> <input class="inp sm" value="' + esc(w.name) + '" data-c="wbsName" data-id="' + w.id + '"' + d2 + ' aria-label="Nome WBS"></td><td><input class="inp xs mono" value="' + esc(w.code) + '" data-c="wbsCode" data-id="' + w.id + '"' + d2 + ' aria-label="Codice WBS"></td><td class="n">' + acts.length + '</td><td>' + (st.length ? U.fd(Math.min.apply(null, st)) : '') + '</td><td>' + (fi.length ? U.fd(Math.max.apply(null, fi)) : '') + '</td><td class="n">' + U.keur(bud) + '</td></tr>');
      (kids.get(w.id) || []).forEach((c) => walk(c, l + 1));
    };
    (kids.get('__') || []).forEach((w) => walk(w, 0));
    const def = p.defaults || {};
    const projForm = '<dl class="kv wide"><dt>Project ID</dt><dd><input class="inp mono" value="' + esc(p.code) + '" data-c="projF" data-k="code"' + d2 + '></dd><dt>Nome</dt><dd><input class="inp" value="' + esc(p.name) + '" data-c="projF" data-k="name"' + d2 + '></dd><dt>Nodo EPS</dt><dd>' + UI.chip(p.status, p.status === 'CURR' ? 'ok' : 'info') + ' sotto ' + esc(p.work || '') + '</dd><dt>Responsabile (OBS)</dt><dd>' + UI.sel('projF', S.db.obs.map((o) => [o.id, o.name]), p.obsId, 'data-k="obsId"' + d2) + '</dd><dt>Planned start</dt><dd><input class="inp" type="date" value="' + esc(p.plannedStart) + '" data-c="projF" data-k="plannedStart"' + d2 + '></dd><dt>Must finish by ' + UI.i('mustFinish') + '</dt><dd><input class="inp" type="date" value="' + esc(p.mustFinish || '') + '" data-c="projF" data-k="mustFinish"' + d2 + '></dd><dt>Data date</dt><dd>' + U.fd(p.dataDate) + ' <span class="muted small">(si cambia nel ciclo di aggiornamento)</span></dd><dt>Calendario</dt><dd>' + UI.sel('projF', S.db.calendars.map((c) => [c.id, c.name]), p.calId, 'data-k="calId"' + d2) + '</dd><dt>Rate type</dt><dd>' + esc(p.rateType || 'Price/Unit') + '</dd><dt>Financial periods</dt><dd>' + esc(p.periodsCal || 'Mensile') + '</dd><dt>Valore contrattuale</dt><dd><input class="inp" type="number" step="0.01" value="' + (p.contractValue || 0) + '" data-c="projF" data-k="contractValue"' + (S.can('cost') ? '' : ' disabled') + '> €</dd><dt>Prossimo cut-off</dt><dd><input class="inp" type="date" value="' + esc(p.nextCutoff || '') + '" data-c="projF" data-k="nextCutoff"' + d2 + '></dd></dl>' +
      '<h3 class="h3">Default per le nuove attività ' + UI.i('projDefaults') + '</h3><div class="grid2"><label class="fld adv">Tipo di durata' + UI.sel('projDef', [['FDU', 'Fixed Duration and Units/Time'], ['FDQ', 'Fixed Duration and Units'], ['FR', 'Fixed Units/Time'], ['FQ', 'Fixed Units']], def.durType || 'FDU', 'data-k="durType"' + d2) + '</label><label class="fld">Tipo di % completamento' + UI.sel('projDef', [['phys', 'Physical'], ['dur', 'Duration'], ['units', 'Units'], ['qty', 'Quantità']], def.pctType || 'phys', 'data-k="pctType"' + d2) + '</label><label class="fld">Tipo di attività' + UI.sel('projDef', Object.entries(M.CPM.TYPES), def.actType || 'task', 'data-k="actType"' + d2) + '</label></div>';
    return '<div class="row">' + UI.card('Progetto', projForm, { style: 'flex:1 1 360px' }) + UI.card('WBS', UI.table(['Codice e nome', 'Codice', { t: 'Attività', n: 1 }, 'Inizio', 'Fine', { t: 'Budget', n: 1 }], rows) + '<p class="help">Seleziona un nodo per spostarlo. Il codice completo è la catena dei padri; un nodo WBS non ha durata propria e prende le date dalle attività che contiene.</p>', { info: 'wbs', style: 'flex:2 1 520px', tools: canS ? '<button type="button" class="btn sm" data-a="wbsAdd">+ Nodo</button><button type="button" class="btn sm" data-a="wbsMove" data-d="out" aria-label="Sposta a sinistra">←</button><button type="button" class="btn sm" data-a="wbsMove" data-d="in" aria-label="Sposta a destra">→</button><button type="button" class="btn sm" data-a="wbsMove" data-d="up" aria-label="Sposta su">↑</button><button type="button" class="btn sm" data-a="wbsMove" data-d="down" aria-label="Sposta giù">↓</button><button type="button" class="btn sm" data-a="wbsDel" aria-label="Elimina nodo">' + UI.ic('trash', 15) + '</button>' : '' }) + '</div>';
  }

  function tabCal() {
    const cal = S.cal(S.ui.calSel) || S.db.calendars[0];
    S.ui.calSel = cal.id;
    const mk = S.ui.calMonth || U.monthKey(U.dnOf(S.P().dataDate) + 30);
    const s0 = U.monthStart(mk), e0 = U.lastOfMonth(s0);
    const cells = [];
    for (let i = 0; i < U.weekday(s0); i++) cells.push('<div class="cd e"></div>');
    const iso = (d) => U.isoOf(d);
    for (let d = s0; d <= e0; d++) {
      const wk = (cal.week || [])[U.weekday(d)] > 0;
      const rec = (cal.recurring || []).includes(iso(d).slice(5));
      const hol = !M.Cal.isWork(cal, d) && wk;
      const extra = M.Cal.isWork(cal, d) && !wk;
      cells.push('<button type="button" class="cd' + (!wk ? ' we' : '') + (hol ? ' ho' : '') + (extra ? ' xw' : '') + '" data-a="calDay" data-d="' + iso(d) + '"' + (can() ? '' : ' disabled') + ' title="' + U.fdl(d) + (hol ? (rec ? ' festività ricorrente' : ' non lavorativo') : extra ? ' lavorativo straordinario' : '') + '">' + U.ymd(d)[2] + '</button>');
    }
    const hpw = U.sum(cal.week || []);
    const yearWork = M.Cal.workDaysIn(cal, U.dnYmd(Math.floor(mk / 12), 0, 1), U.dnYmd(Math.floor(mk / 12), 11, 31));
    return '<div class="row">' + UI.card('Calendari', '<div class="list">' + S.db.calendars.map((c) => '<button type="button" class="li' + (c.id === cal.id ? ' on' : '') + '" data-a="calPick" data-id="' + c.id + '">' + esc(c.name) + ' <small>' + esc(c.type) + '</small></button>').join('') + '</div><div class="acts">' + (can() ? '<button type="button" class="btn sm" data-a="calNew">Nuovo da questo</button>' : '') + '</div>', { info: 'calendar', style: 'flex:1 1 220px' }) +
      UI.card(cal.name, '<div class="grid2"><label class="fld">Nome<input class="inp" value="' + esc(cal.name) + '" data-c="calF" data-k="name"' + dis() + '></label><label class="fld">Tipo' + UI.sel('calF', [['global', 'Global'], ['project', 'Project'], ['resource', 'Resource']], cal.type, 'data-k="type"' + dis()) + '</label></div><p class="ey">Settimana lavorativa (ore)</p><div class="ww">' + DAYS.map((d, i) => '<label><span>' + d + '</span><input class="inp xs" type="number" min="0" max="24" value="' + ((cal.week || [])[i] || 0) + '" data-c="calWeek" data-i="' + i + '"' + dis() + ' aria-label="Ore ' + d + '"></label>').join('') + '</div>' +
        '<label class="sw"><input type="checkbox" data-c="calRec"' + ((cal.recurring || []).length ? ' checked' : '') + dis() + '> Festività nazionali italiane ricorrenti (1/1, 6/1, 25/4, 1/5, 2/6, 15/8, 1/11, 8/12, 25 e 26/12)</label>' +
        '<div class="calnav"><button type="button" class="btn sm" data-a="calMonth" data-d="-1" aria-label="Mese precedente">' + UI.ic('chevL', 16) + '</button><b>' + U.MONTHS_L[mk % 12] + ' ' + Math.floor(mk / 12) + '</b><button type="button" class="btn sm" data-a="calMonth" data-d="1" aria-label="Mese successivo">' + UI.ic('chevR', 16) + '</button><span class="muted small">Clic su un giorno: lavorativo / non lavorativo</span></div><div class="cal">' + DAYS.map((d) => '<div class="hd">' + d + '</div>').join('') + cells.join('') + '</div>' +
        UI.legend([['Festivo o non lavorativo', '#fbe3e3'], ['Fine settimana', '#e2e6eb'], ['Lavorativo straordinario', '#dff0e5']]) +
        '<h3 class="h3">Giorni non lavorativi specifici</h3><div class="tags">' + (cal.holidays || []).map((h, i) => '<span class="tag">' + esc(h.includes('..') ? U.fd(h.split('..')[0]) + ' - ' + U.fd(h.split('..')[1]) : U.fd(h)) + (can() ? '<button type="button" class="ibx" data-a="calHolDel" data-i="' + i + '" aria-label="Rimuovi">' + UI.ic('x', 12) + '</button>' : '') + '</span>').join('') + '</div>' + (can() ? '<div class="acts"><input class="inp sm" type="date" id="hol-a" aria-label="Dal"><input class="inp sm" type="date" id="hol-b" aria-label="Al (facoltativo)"><button type="button" class="btn sm" data-a="calHolAdd">Aggiungi periodo non lavorativo</button></div>' : ''), { style: 'flex:2 1 460px' }) +
      UI.card('Conversioni', '<dl class="kv"><dt>Ore al giorno</dt><dd>' + U.num(cal.hoursDay || 8, 2) + '</dd><dt>Ore a settimana</dt><dd>' + U.num(hpw, 2) + '</dd><dt>Ore all\'anno (52 sett.)</dt><dd>' + U.num(hpw * 52, 2) + '</dd><dt>Giorni lavorativi ' + Math.floor(mk / 12) + '</dt><dd>' + yearWork + '</dd><dt>Giorni lavorativi nel mese</dt><dd>' + M.Cal.workDaysIn(cal, s0, e0) + '</dd></dl>' + (cal.note ? '<p>' + UI.chip(cal.note, 'info') + '</p>' : '') + '<p class="help">Le festività e la chiusura estiva nel calendario Global vengono ereditate da tutti i progetti.</p>', { style: 'flex:1 1 240px' }) + '</div>';
  }

  function tabRes() {
    const rows = S.db.resources.map((r, i) => r.group ? '<tr class="grp"><td colspan="10"><b>' + esc(r.name) + '</b></td></tr>' : '<tr><td><input class="inp xs mono" value="' + esc(r.code) + '" data-c="resF" data-i="' + i + '" data-k="code"' + dis() + '></td><td><input class="inp sm" value="' + esc(r.name) + '" data-c="resF" data-i="' + i + '" data-k="name"' + dis() + '></td><td>' + UI.sel('resF', ['Labor', 'Nonlabor', 'Material'], r.type, 'data-i="' + i + '" data-k="type"' + dis()) + '</td><td><input class="inp xs" value="' + esc(r.unit || 'h') + '" data-c="resF" data-i="' + i + '" data-k="unit"' + dis() + '></td><td class="n"><input class="inp xs" type="number" step="0.01" value="' + (r.price || 0) + '" data-c="resF" data-i="' + i + '" data-k="price"' + dis() + '></td><td class="n"><input class="inp xs" type="number" step="0.01" value="' + (r.defUpd || 0) + '" data-c="resF" data-i="' + i + '" data-k="defUpd"' + dis() + '></td><td class="n"><input class="inp xs" type="number" step="0.01" value="' + (r.maxUpd || 0) + '" data-c="resF" data-i="' + i + '" data-k="maxUpd"' + dis() + '></td><td>' + UI.sel('resF', S.db.calendars.map((c) => [c.id, c.name]), r.calId, 'data-i="' + i + '" data-k="calId"' + dis()) + '</td><td><input class="inp sm" value="' + esc(r.company || '') + '" data-c="resF" data-i="' + i + '" data-k="company"' + dis() + ' placeholder="interna"></td><td>' + (can() ? '<button type="button" class="ibx" data-a="resDel" data-i="' + i + '" aria-label="Elimina risorsa">' + UI.ic('trash', 15) + '</button>' : '') + '</td></tr>');
    return '<div class="row">' + UI.card('Risorse (RBS)', UI.table(['Codice', 'Nome', 'Tipo', 'UM', { t: 'Prezzo €/UM', n: 1 }, { t: 'Default/g', n: 1 }, { t: 'Max/g', n: 1 }, 'Calendario', 'Impresa', ''], rows, { cls: 'compact' }) + (can() ? '<div class="acts"><button type="button" class="btn sm" data-a="resAdd">+ Risorsa</button></div>' : ''), { info: 'resources', style: 'flex:3 1 700px' }) + UI.card('Ruoli', '<ul class="plain">' + (S.db.roles || []).map((r) => '<li>' + esc(r.name) + '</li>').join('') + '</ul><p class="help">I ruoli servono quando non si sa ancora quali persone saranno assegnate.</p>', { style: 'flex:1 1 220px' }) + '</div>';
  }

  function tabCodes() {
    const ct = (S.db.codeTypes || []).map((t, ti) => '<div class="pblk wide"><p class="ey">' + esc(t.id) + ' - ' + esc(t.name) + ' <span class="muted">(' + esc(t.scope) + ')</span></p><div class="tags">' + t.values.map((v, vi) => '<span class="tag"><b class="mono">' + esc(v.code) + '</b> ' + esc(v.desc) + (can() ? '<button type="button" class="ibx" data-a="codeValDel" data-t="' + ti + '" data-i="' + vi + '" aria-label="Rimuovi">' + UI.ic('x', 12) + '</button>' : '') + '</span>').join('') + '</div>' + (can() ? '<div class="acts"><input class="inp xs mono" id="cv-c-' + ti + '" placeholder="Codice"><input class="inp sm" id="cv-d-' + ti + '" placeholder="Descrizione"><button type="button" class="btn sm" data-a="codeValAdd" data-t="' + ti + '">Aggiungi valore</button></div>' : '') + '</div>').join('');
    const udf = UI.table(['Nome', 'Tipo', 'Unità', ''], (S.db.udfTypes || []).map((u, i) => '<tr><td><input class="inp sm" value="' + esc(u.name) + '" data-c="udfF" data-i="' + i + '" data-k="name"' + dis() + '></td><td>' + UI.sel('udfF', [['text', 'Testo'], ['number', 'Numero'], ['date', 'Data'], ['cost', 'Costo'], ['indicator', 'Semaforo']], u.type, 'data-i="' + i + '" data-k="type"' + dis()) + '</td><td><input class="inp xs" value="' + esc(u.unit || '') + '" data-c="udfF" data-i="' + i + '" data-k="unit"' + dis() + '></td><td>' + (can() ? '<button type="button" class="ibx" data-a="udfDel" data-i="' + i + '" aria-label="Elimina">' + UI.ic('trash', 15) + '</button>' : '') + '</td></tr>'));
    return '<div class="row">' + UI.card('Codici attività', ct + (can() ? '<div class="acts"><button type="button" class="btn sm" data-a="codeTypeAdd">+ Tipo di codice</button></div>' : ''), { info: 'codes', style: 'flex:2 1 520px' }) + UI.card('Campi personalizzati (UDF)', udf + (can() ? '<div class="acts"><button type="button" class="btn sm" data-a="udfAdd">+ UDF</button></div>' : '') + '<p class="help">Ogni codice e UDF diventa una colonna disponibile nelle viste ed esportabile in Excel.</p>', { info: 'udf', style: 'flex:1 1 360px' }) + '</div>';
  }

  function tabCurves() {
    const all = Object.entries(M.Costs.CURVES).map(([id, c]) => ({ id, name: c.name, w: c.w, std: true })).concat((S.db.curves || []).map((c) => Object.assign({ std: false }, c)));
    const spark = (w) => { const mx = Math.max.apply(null, w); return '<svg class="spark" viewBox="0 0 100 30" aria-hidden="true">' + w.map((v, i) => '<rect x="' + (i * 10 + 1) + '" y="' + (30 - (v / mx) * 28) + '" width="8" height="' + ((v / mx) * 28) + '" fill="#1c5a8a"/>').join('') + '</svg>'; };
    const curves = UI.table(['Curva', 'Profilo (10 tratti, %)', ''], all.map((c) => '<tr><td>' + esc(c.name) + (c.std ? ' <span class="muted small">standard</span>' : '') + '</td><td>' + (c.std ? c.w.join(' - ') : c.w.map((v, i) => '<input class="inp xxs" type="number" value="' + v + '" data-c="curveW" data-id="' + c.id + '" data-i="' + i + '"' + dis() + ' aria-label="Tratto ' + (i + 1) + '">').join('')) + '</td><td>' + spark(c.w) + '</td></tr>'));
    const cbs = UI.table(['Codice', 'Nome', ''], (S.db.costAccounts || []).map((c, i) => '<tr><td><input class="inp xs mono" value="' + esc(c.code) + '" data-c="cbsF" data-i="' + i + '" data-k="code"' + dis() + '></td><td><input class="inp" value="' + esc(c.name) + '" data-c="cbsF" data-i="' + i + '" data-k="name"' + dis() + '></td><td>' + (can() ? '<button type="button" class="ibx" data-a="cbsDel" data-i="' + i + '" aria-label="Elimina">' + UI.ic('trash', 15) + '</button>' : '') + '</td></tr>'));
    return '<div class="row">' + UI.card('Curve di distribuzione', curves + (can() ? '<div class="acts"><button type="button" class="btn sm" data-a="curveAdd">+ Curva personalizzata</button></div>' : ''), { info: 'curves', style: 'flex:1 1 480px' }) + UI.card('Conti di costo (CBS)', cbs + (can() ? '<div class="acts"><button type="button" class="btn sm" data-a="cbsAdd">+ Conto</button></div>' : ''), { info: 'cbs', style: 'flex:1 1 380px' }) + '</div>';
  }

  function tabFp() {
    const DD = U.dnOf(S.P().dataDate);
    const rows = (S.db.periods || []).map((f) => '<tr class="' + (U.dnOf(f.start) <= DD && U.dnOf(f.end) >= DD ? 'sel' : '') + '"><td>' + esc(f.name) + '</td><td>' + U.fd(f.start) + '</td><td>' + U.fd(f.end) + '</td><td>' + (f.stored ? UI.chip('Storicizzato', 'ok') : U.dnOf(f.end) <= DD ? UI.chip('Da storicizzare', 'warn') : UI.chip('Aperto', 'neutral')) + '</td></tr>');
    return UI.card('Financial periods (mensili)', UI.table(['Periodo', 'Inizio', 'Fine', 'Stato'], rows) + (can() ? '<div class="acts"><label class="lbl">Crea periodi mensili fino a <input class="inp sm" type="month" id="fp-to"></label><button type="button" class="btn sm" data-a="fpBatch">Batch create</button></div>' : '') + '<p class="help">I periodi sono globali e non si modificano dopo l\'uso: un mese già storicizzato non si divide più in settimane.</p>', { info: 'fperiods' });
  }

  function tabDraw() {
    const ctx = VH.ctx(); const p = ctx.p;
    const lastF9 = ctx.s.ranAt ? ctx.s.ranAt.slice(0, 10) : '';
    const canS = S.can('schedule');
    const rows = (p.drawings || []).map((d, i) => {
      const acts = p.activities.filter((a) => (a.drawings || []).includes(d.id));
      const chg = (d.changedAt || d.date) > lastF9;
      return '<tr><td><input class="inp xs mono" value="' + esc(d.code) + '" data-c="drawF" data-i="' + i + '" data-k="code"' + (canS ? '' : ' disabled') + '></td><td><input class="inp" value="' + esc(d.title) + '" data-c="drawF" data-i="' + i + '" data-k="title"' + (canS ? '' : ' disabled') + '></td><td class="mono">' + esc(d.rev) + '</td><td>' + U.fd(d.date) + '</td><td><input class="inp sm" value="' + esc(d.link || '') + '" placeholder="https://..." data-c="drawF" data-i="' + i + '" data-k="link"' + (canS ? '' : ' disabled') + '></td><td>' + acts.map((a) => '<button type="button" class="lnk mono" data-a="selAct" data-id="' + esc(a.id) + '" data-r="attivita">' + esc(a.code) + '</button>').join(' ') + (chg && acts.length ? ' ' + UI.chip('da rivedere', 'warn') : '') + '</td><td class="small muted">' + (d.history || []).map((h) => h.rev + ' ' + U.fd(h.date)).join(', ') + '</td><td>' + (canS ? '<button type="button" class="btn sm" data-a="drawRev" data-i="' + i + '">Nuova revisione</button><button type="button" class="ibx" data-a="drawDel" data-i="' + i + '" aria-label="Elimina tavola">' + UI.ic('trash', 15) + '</button>' : '') + '</td></tr>';
    });
    return UI.card('Registro tavole - ' + p.code, UI.table(['Codice', 'Titolo', 'Rev.', 'Data', 'Link al file', 'Attività collegate', 'Storico', ''], rows, { empty: 'Nessuna tavola', cls: 'compact' }) + (canS ? '<div class="acts"><button type="button" class="btn sm" data-a="drawAdd">+ Tavola</button></div>' : '') + '<p class="help">Quando una tavola cambia revisione dopo l\'ultimo F9, le attività collegate sono segnalate "da rivedere" e si filtrano in Attività con il filtro "Con tavole revisionate". Ricerca inversa: filtro Tavola nel Gantt.</p>', { info: 'drawings' });
  }

  M.Views.struttura = {
    title: 'Struttura',
    render() {
      const t = S.ui.struttTab || 'wbs';
      const body = { eps: tabEps, wbs: tabWbs, cal: tabCal, res: tabRes, codes: tabCodes, curves: tabCurves, fp: tabFp, draw: tabDraw }[t]();
      const p = S.P();
      return '<div class="head"><div><p class="ey">Enterprise › ' + esc(p.work || '') + ' › ' + esc(p.status) + '</p><h1>Struttura del progetto</h1><p class="sub">Si imposta nell\'ordine di P6: EPS e OBS, anagrafiche comuni, poi progetto e WBS.</p></div><div class="acts"><a class="btn" href="#/scambio">Importa XER o XML</a><a class="btn-p" href="#/attivita">Vai alle attività</a></div></div>' +
        '<div class="tabs" role="tablist" aria-label="Sezioni della struttura">' + TABS.map(([k, l]) => '<button type="button" class="tab' + (k === t ? ' on' : '') + '" role="tab" aria-selected="' + (k === t) + '" data-a="struttTab" data-t="' + k + '">' + l + '</button>').join('') + '</div>' + body;
    }
  };

  const sv = () => { S.save(); M.App.render(true); };
  const guard = () => { if (!can()) { UI.toast('Il tuo ruolo non permette di modificare la struttura.', 'warn'); return false; } return true; };
  const touchCal = (id) => { M.Cal.invalidate(id); S.db.projects.forEach((p) => { if (p.status === 'CURR') p.dirty = true; }); };
  Object.assign(M.A, {
    struttTab(el) { S.ui.struttTab = el.getAttribute('data-t'); S.saveUi(); M.App.render(); },
    obsAdd(el) { if (!guard()) return; S.db.obs.push({ id: U.uid('o'), name: 'Nuovo nodo', parent: el.getAttribute('data-id') }); sv(); },
    obsDel(el) { if (!guard()) return; const id = el.getAttribute('data-id'); if (S.db.obs.some((o) => o.parent === id) || S.db.users.some((u) => u.obs === id)) { UI.toast('Il nodo ha figli o utenti: spostali prima.', 'warn'); return; } S.db.obs = S.db.obs.filter((o) => o.id !== id); sv(); },
    wbsPick(el) { S.ui.wbsSel = el.getAttribute('data-id'); S.saveUi(); M.App.render(true); },
    wbsAdd() { const sel = S.ui.wbsSel; S.mutate((w) => { const root = w.wbs.find((x) => !x.parent); const parent = sel && w.wbs.some((x) => x.id === sel) ? sel : root.id; const id = U.uid('W'); w.wbs.push({ id, code: 'NEW' + (w.wbs.length + 1), name: 'Nuovo nodo', parent }); S.ui.wbsSel = id; }, { affects: false }); },
    wbsDel() { const id = S.ui.wbsSel; const p = S.P(); const w0 = p.wbs.find((x) => x.id === id); if (!w0 || !w0.parent) { UI.toast('Seleziona un nodo (non la radice).', 'warn'); return; } if (p.activities.some((a) => a.wbsId === id) || p.wbs.some((x) => x.parent === id)) { UI.toast('Il nodo contiene attività o sottonodi: spostali prima.', 'warn'); return; } S.mutate((w) => { w.wbs = w.wbs.filter((x) => x.id !== id); }, { affects: false }); },
    wbsMove(el) {
      const d = el.getAttribute('data-d'); const id = S.ui.wbsSel; if (!id) { UI.toast('Seleziona prima un nodo WBS.', 'info'); return; }
      S.mutate((w) => {
        const n = w.wbs.find((x) => x.id === id); if (!n || !n.parent) return;
        const sib = w.wbs.filter((x) => x.parent === n.parent);
        const i = sib.indexOf(n);
        if (d === 'in' && i > 0) n.parent = sib[i - 1].id;
        else if (d === 'out') { const par = w.wbs.find((x) => x.id === n.parent); if (par && par.parent) n.parent = par.parent; }
        else if (d === 'up' || d === 'down') { const j = d === 'up' ? i - 1 : i + 1; if (j < 0 || j >= sib.length) return; const a = w.wbs.indexOf(n), b = w.wbs.indexOf(sib[j]); w.wbs[a] = sib[j]; w.wbs[b] = n; }
      }, { affects: false });
    },
    calPick(el) { S.ui.calSel = el.getAttribute('data-id'); S.saveUi(); M.App.render(true); },
    calMonth(el) { const mk = S.ui.calMonth || U.monthKey(U.dnOf(S.P().dataDate) + 30); S.ui.calMonth = mk + Number(el.getAttribute('data-d')); S.saveUi(); M.App.render(true); },
    calNew() { if (!guard()) return; const c = U.clone(S.cal(S.ui.calSel)); c.id = U.uid('cal'); c.name = c.name + ' (copia)'; S.db.calendars.push(c); S.ui.calSel = c.id; sv(); },
    calDay(el) {
      if (!guard()) return;
      const cal = S.cal(S.ui.calSel); const iso = el.getAttribute('data-d'); const d = U.dnOf(iso);
      const wk = (cal.week || [])[U.weekday(d)] > 0;
      cal.holidays = cal.holidays || []; cal.workdays = cal.workdays || [];
      if (wk) { if (M.Cal.isWork(cal, d)) cal.holidays.push(iso); else { cal.holidays = cal.holidays.filter((h) => h !== iso); if (M.Cal.isWork(cal, d) === false && (cal.recurring || []).includes(iso.slice(5))) { cal.workdays.push(iso); } } }
      else { if (cal.workdays.includes(iso)) cal.workdays = cal.workdays.filter((x) => x !== iso); else cal.workdays.push(iso); }
      touchCal(cal.id); sv();
    },
    calHolAdd() { if (!guard()) return; const a = U.$('#hol-a').value, b = U.$('#hol-b').value; if (!a) return; const cal = S.cal(S.ui.calSel); cal.holidays = cal.holidays || []; cal.holidays.push(b && b > a ? a + '..' + b : a); touchCal(cal.id); sv(); },
    calHolDel(el) { if (!guard()) return; const cal = S.cal(S.ui.calSel); cal.holidays.splice(Number(el.getAttribute('data-i')), 1); touchCal(cal.id); sv(); },
    resAdd() { if (!guard()) return; S.db.resources.push({ id: U.uid('r'), code: 'NEW', name: 'Nuova risorsa', type: 'Labor', parent: 'g_lab', unit: 'h', price: 0, defUpd: 8, maxUpd: 8, calId: 'cal5' }); sv(); },
    resDel(el) { if (!guard()) return; const r = S.db.resources[Number(el.getAttribute('data-i'))]; if (S.db.projects.some((p) => p.activities.some((a) => (a.assign || []).some((x) => x.resId === r.id)))) { UI.toast('La risorsa è assegnata ad attività: rimuovi prima le assegnazioni.', 'warn'); return; } S.db.resources.splice(Number(el.getAttribute('data-i')), 1); sv(); },
    codeValAdd(el) { if (!guard()) return; const ti = el.getAttribute('data-t'); const c = U.$('#cv-c-' + ti).value.trim(), d = U.$('#cv-d-' + ti).value.trim(); if (!c) return; const t = S.db.codeTypes[ti]; if (t.values.some((v) => v.code === c)) { UI.toast('Valore già presente.', 'warn'); return; } t.values.push({ code: c, desc: d || c }); sv(); },
    codeValDel(el) { if (!guard()) return; S.db.codeTypes[el.getAttribute('data-t')].values.splice(Number(el.getAttribute('data-i')), 1); sv(); },
    codeTypeAdd() { if (!guard()) return; UI.prompt('Nuovo tipo di codice', 'Nome (es. Disciplina)', '', (n) => { if (!n) return; S.db.codeTypes.push({ id: U.slug(n).toUpperCase().slice(0, 8) || U.uid('CT'), name: n, scope: 'global', values: [] }); sv(); }); },
    udfAdd() { if (!guard()) return; S.db.udfTypes.push({ id: U.uid('u'), name: 'Nuovo campo', type: 'text' }); sv(); },
    udfDel(el) { if (!guard()) return; S.db.udfTypes.splice(Number(el.getAttribute('data-i')), 1); sv(); },
    curveAdd() { if (!guard()) return; S.db.curves = S.db.curves || []; S.db.curves.push({ id: U.uid('cv'), name: 'Curva personalizzata ' + (S.db.curves.length + 1), w: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] }); sv(); },
    cbsAdd() { if (!guard()) return; const n = (S.db.costAccounts || []).length + 1; S.db.costAccounts.push({ id: 'CBS-' + String(n).padStart(2, '0') + U.uid('').slice(-3), code: 'CBS-' + String(n).padStart(2, '0'), name: 'Nuovo conto' }); sv(); },
    cbsDel(el) { if (!guard()) return; S.db.costAccounts.splice(Number(el.getAttribute('data-i')), 1); sv(); },
    fpBatch() { if (!guard()) return; const to = U.$('#fp-to').value; if (!to) return; const end = U.monthKey(U.dnOf(to + '-01')); const last = S.db.periods.length ? U.monthKey(U.dnOf(S.db.periods[S.db.periods.length - 1].start)) : U.monthKey(U.todayDn()) - 1; for (let k = last + 1; k <= end; k++) { const s = U.monthStart(k); S.db.periods.push({ id: 'fp' + k, name: U.MONTHS_L[k % 12] + ' ' + Math.floor(k / 12), start: U.isoOf(s), end: U.isoOf(U.lastOfMonth(s)), stored: false }); } sv(); },
    drawAdd() { S.mutate((w) => { w.drawings = w.drawings || []; w.drawings.push({ id: U.uid('T'), code: 'NEW-' + (w.drawings.length + 1), title: 'Nuova tavola', rev: 'A', date: U.isoOf(U.todayDn()), link: '', history: [{ rev: 'A', date: U.isoOf(U.todayDn()) }] }); }, { affects: false }); },
    drawDel(el) { const i = Number(el.getAttribute('data-i')); S.mutate((w) => { const d = w.drawings[i]; w.drawings.splice(i, 1); w.activities.forEach((a) => { a.drawings = (a.drawings || []).filter((x) => x !== d.id); }); }, { affects: false }); },
    drawRev(el) {
      const i = Number(el.getAttribute('data-i')); const d = S.P().drawings[i];
      const next = d.rev.length === 1 && /[A-Y]/i.test(d.rev) ? String.fromCharCode(d.rev.toUpperCase().charCodeAt(0) + 1) : d.rev + '.1';
      UI.prompt('Nuova revisione di ' + d.code, 'Revisione', next, (rev) => {
        if (!rev) return;
        const today = U.isoOf(U.todayDn());
        S.mutate((w) => { const x = w.drawings[i]; x.rev = rev; x.date = today; x.changedAt = U.nowStamp().slice(0, 10) + 'T'; x.history = (x.history || []).concat([{ rev, date: today }]); }, { affects: false });
        const n = S.P().activities.filter((a) => (a.drawings || []).includes(d.id)).length;
        UI.toast('Revisione ' + rev + ' registrata: ' + n + ' attività collegate da rivedere.', 'warn');
      });
    }
  });
  Object.assign(M.C, {
    obsName(el) { if (!guard()) return; const o = S.db.obs.find((x) => x.id === el.getAttribute('data-id')); if (o) o.name = el.value; S.save(); },
    wbsName(el) { const id = el.getAttribute('data-id'); S.mutate((w) => { const n = w.wbs.find((x) => x.id === id); if (n) n.name = el.value; }, { affects: false }); },
    wbsCode(el) { const id = el.getAttribute('data-id'); S.mutate((w) => { const n = w.wbs.find((x) => x.id === id); if (n) n.code = el.value.trim(); }, { affects: false }); },
    projF(el) { const k = el.getAttribute('data-k'); const affects = ['plannedStart', 'mustFinish', 'calId'].includes(k); S.mutate((w) => { w[k] = k === 'contractValue' ? Number(el.value) || 0 : el.value; }, { affects, cap: k === 'contractValue' ? 'cost' : 'schedule' }); },
    projDef(el) { const k = el.getAttribute('data-k'); S.mutate((w) => { w.defaults = w.defaults || {}; w.defaults[k] = el.value; }, { affects: false }); },
    calF(el) { if (!guard()) return; const c = S.cal(S.ui.calSel); c[el.getAttribute('data-k')] = el.value; S.save(); M.App.render(true); },
    calWeek(el) { if (!guard()) return; const c = S.cal(S.ui.calSel); c.week = (c.week || [0, 0, 0, 0, 0, 0, 0]).slice(); c.week[Number(el.getAttribute('data-i'))] = U.clamp(Number(el.value) || 0, 0, 24); c.hoursDay = c.week.find((h) => h > 0) || 8; touchCal(c.id); sv(); },
    calRec(el) { if (!guard()) return; const c = S.cal(S.ui.calSel); c.recurring = el.checked ? M.Cal.italianRecurring.slice() : []; touchCal(c.id); sv(); },
    resF(el) { if (!guard()) return; const r = S.db.resources[Number(el.getAttribute('data-i'))]; const k = el.getAttribute('data-k'); r[k] = ['price', 'defUpd', 'maxUpd'].includes(k) ? Number(el.value) || 0 : el.value; S.save(); M.App.render(true); },
    udfF(el) { if (!guard()) return; const u = S.db.udfTypes[Number(el.getAttribute('data-i'))]; u[el.getAttribute('data-k')] = el.value; S.save(); },
    curveW(el) { if (!guard()) return; const c = S.db.curves.find((x) => x.id === el.getAttribute('data-id')); c.w[Number(el.getAttribute('data-i'))] = Math.max(0, Number(el.value) || 0); sv(); },
    cbsF(el) { if (!guard()) return; const c = S.db.costAccounts[Number(el.getAttribute('data-i'))]; c[el.getAttribute('data-k')] = el.value; S.save(); },
    drawF(el) { const i = Number(el.getAttribute('data-i')), k = el.getAttribute('data-k'); S.mutate((w) => { w.drawings[i][k] = el.value; }, { affects: false }); }
  });
})(window.M = window.M || {});
