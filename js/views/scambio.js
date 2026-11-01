/* Meridian - Scambio dati: export con fedeltà, import guidato, incolla da Excel */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, esc = U.esc;

  /* ---------- tipi di tabella importabili ---------- */
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim();
  const KINDS = {
    activities: { label: 'Attività', key: 'code', fields: () => { const f = VH.fieldsAll(); const out = {}; Object.entries(f).forEach(([k, v]) => { if (v.set || v.setRels) out[k] = v.label; }); return out; } },
    rels: { label: 'Legami', key: 'succ', fields: () => ({ pred: 'Predecessore (ID)', succ: 'Successore (ID)', type: 'Tipo legame', lag: 'Lag (g)' }) },
    assign: { label: 'Assegnazioni', key: 'act', fields: () => ({ act: 'ID attività', res: 'Risorsa (codice o nome)', upd: 'Unità per giorno', bud: 'Budgeted', actual: 'Actual', rem: 'Remaining' }) },
    progress: { label: 'Avanzamento', key: 'code', fields: () => ({ code: 'ID attività', as: 'Inizio reale', af: 'Fine reale', pct: '% fisica', rd: 'Durata rimanente', actH: 'Actual (h)' }) },
    costs: { label: 'Righe di costo', key: 'act', fields: () => ({ act: 'ID attività', company: 'Impresa', desc: 'Descrizione', mat: 'Materiale', um: 'UM', qty: 'Quantità', unit: 'Costo unitario', qtyDone: 'Q.tà eseguita', actual: 'Consuntivo', dist: 'Distribuzione', kind: 'Natura', cbs: 'Conto' }) }
  };
  const SYN = { code: ['id', 'id attivita', 'activity id', 'codice', 'task code', 'id attivita'], name: ['nome', 'descrizione attivita', 'activity name', 'nome attivita', 'task name'], od: ['durata', 'dur', 'original duration', 'durata originale', 'dur orig'], rd: ['rimanente', 'remaining', 'durata rimanente', 'remaining duration', 'rim'], as: ['inizio reale', 'actual start', 'started'], af: ['fine reale', 'actual finish', 'finished'], pct: ['%', 'percentuale', '% fisica', 'physical %', 'physical % complete', '% completamento'], preds: ['predecessori', 'predecessors', 'legami'], wbs: ['wbs', 'codice wbs'], act: ['id attivita', 'attivita', 'activity id', 'id'], res: ['risorsa', 'resource'], pred: ['predecessore', 'pred', 'predecessor'], succ: ['successore', 'succ', 'successor'], type: ['tipo', 'tipo legame', 'relationship type'], lag: ['lag', 'ritardo'], qty: ['quantita', 'q ta'], unit: ['costo unitario', 'prezzo', 'prezzo unitario', 'costo unit'], company: ['impresa', 'fornitore', 'vendor'], desc: ['descrizione', 'descrizione lavoro'], mat: ['materiale', 'tipo materiale'], um: ['um', 'unita di misura', 'unita'], qtyDone: ['q ta eseguita', 'quantita eseguita', 'eseguito'], actual: ['consuntivo', 'actual', 'costo effettivo'], actH: ['actual h', 'ore effettive', 'actual'], upd: ['unita per giorno', 'units time', 'units/time'], bud: ['budgeted', 'budget'] };
  function autoMap(kind, headers) {
    const fields = KINDS[kind].fields();
    return headers.map((h) => {
      const n = norm(h);
      let best = '';
      Object.entries(fields).forEach(([k, label]) => { if (best) return; if (n === norm(label) || n === norm(k) || (SYN[k] || []).some((x) => norm(x) === n)) best = k; });
      if (!best) { const f = VH.fieldsAll(); Object.entries(f).forEach(([k, v]) => { if (!best && fields[k] && (n === norm(v.short || '') || n === norm(v.label))) best = k; }); }
      return best;
    });
  }

  /* applica una tabella al progetto; con dry=true lavora su una copia */
  function applyTable(p, kind, objs, o) {
    o = o || {};
    const rep = { ok: 0, created: 0, errors: [], skipped: [] };
    const ctx = { p, wbsMap: new Map((p.wbs || []).map((w) => [w.id, w])) };
    const byCode = () => new Map(p.activities.map((a) => [String(a.code).toLowerCase(), a]));
    let map = byCode();
    objs.forEach((row, ri) => {
      const errs = {};
      if (kind === 'activities') {
        const code = String(row.code || '').trim();
        if (!code) { rep.skipped.push({ row: ri, msg: 'ID attività mancante' }); return; }
        let a = map.get(code.toLowerCase());
        if (!a) { if (!o.addNew) { rep.skipped.push({ row: ri, msg: 'ID ' + code + ' inesistente (aggiunta di nuove righe disattivata)' }); return; } a = VH.newActivity(p, { code, name: row.name || code }); p.activities.push(a); map = byCode(); rep.created++; }
        const vals = Object.assign({}, row); delete vals.code;
        Object.assign(errs, VH.applyRow(p, a, vals, ctx));
      } else if (kind === 'rels') {
        const pr = map.get(String(row.pred || '').trim().toLowerCase()), su = map.get(String(row.succ || '').trim().toLowerCase());
        if (!pr) errs.pred = 'predecessore inesistente'; if (!su) errs.succ = 'successore inesistente';
        const type = String(row.type || 'FS').toUpperCase().trim(); if (!['FS', 'SS', 'FF', 'SF'].includes(type)) errs.type = 'tipo non valido';
        const lag = row.lag === undefined || row.lag === '' ? 0 : U.parseNum(row.lag); if (Number.isNaN(lag)) errs.lag = 'lag non valido';
        if (!Object.keys(errs).length) { const ex = p.rels.find((r) => r.pred === pr.id && r.succ === su.id); if (ex) { ex.type = type; ex.lag = lag; } else { p.rels.push({ id: U.uid('r'), pred: pr.id, succ: su.id, type, lag }); rep.created++; } }
      } else if (kind === 'assign') {
        const a = map.get(String(row.act || '').trim().toLowerCase()); if (!a) errs.act = 'attività inesistente';
        const r = S.db.resources.find((x) => !x.group && (norm(x.code) === norm(row.res) || norm(x.name) === norm(row.res))); if (!r) errs.res = 'risorsa inesistente';
        const num = (k) => { if (row[k] === undefined || row[k] === '') return undefined; const n = U.parseNum(row[k]); if (Number.isNaN(n)) { errs[k] = 'numero non valido'; return undefined; } return n; };
        const upd = num('upd'), bud = num('bud'), act = num('actual'), rem = num('rem');
        if (!Object.keys(errs).length) { a.assign = a.assign || []; let x = a.assign.find((y) => y.resId === r.id); if (!x) { x = { id: U.uid('as'), resId: r.id, upd: r.defUpd || 8, bud: 0, act: 0, rem: 0, curve: 'uniform' }; a.assign.push(x); rep.created++; } if (upd !== undefined) x.upd = upd; if (bud !== undefined) x.bud = bud; if (act !== undefined) x.act = act; x.rem = rem !== undefined ? rem : Math.max(0, x.bud - x.act); }
      } else if (kind === 'progress') {
        const a = map.get(String(row.code || '').trim().toLowerCase()); if (!a) { errs.code = 'attività inesistente'; }
        else {
          const DD = U.dnOf(p.dataDate);
          if (row.as !== undefined && row.as !== '') { const d = U.parseDate(row.as); if (d === null) errs.as = 'data non valida'; else if (d > DD) errs.as = 'oltre la data date ' + U.fd(DD); else a.as = U.isoOf(d); }
          if (row.af !== undefined && row.af !== '') { const d = U.parseDate(row.af); if (d === null) errs.af = 'data non valida'; else if (d > DD) errs.af = 'oltre la data date'; else if (a.as && d < U.dnOf(a.as)) errs.af = 'prima dell\'inizio'; else { a.af = U.isoOf(d); a.rd = 0; a.pct = 100; } }
          if (row.pct !== undefined && row.pct !== '') { const n = U.parseNum(row.pct); if (Number.isNaN(n) || n < 0 || n > 100) errs.pct = '% non valida'; else a.pct = n; }
          if (row.rd !== undefined && row.rd !== '') { const n = U.parseNum(row.rd); if (Number.isNaN(n) || n < 0) errs.rd = 'non valida'; else a.rd = n; }
          if (row.actH !== undefined && row.actH !== '') { const n = U.parseNum(row.actH); const lab = (a.assign || []).filter((x) => (S.res(x.resId) || {}).type === 'Labor'); if (Number.isNaN(n)) errs.actH = 'numero non valido'; else if (!lab.length) errs.actH = 'nessuna risorsa Labor'; else lab[0].act = n; }
        }
      } else if (kind === 'costs') {
        const a = map.get(String(row.act || '').trim().toLowerCase()); if (!a) errs.act = 'attività inesistente';
        const nums = {}; ['qty', 'unit', 'qtyDone', 'actual'].forEach((k) => { if (row[k] !== undefined && row[k] !== '') { const n = U.parseNum(row[k]); if (Number.isNaN(n)) errs[k] = 'numero non valido'; else nums[k] = n; } });
        if (!Object.keys(errs).length) {
          a.costs = a.costs || [];
          let l = a.costs.find((x) => norm(x.desc) === norm(row.desc) && (!row.company || norm(x.company) === norm(row.company)));
          if (!l) { l = { id: U.uid('c'), company: '', desc: row.desc || 'Riga importata', mat: '', um: 'a corpo', qty: 1, unit: 0, qtyDone: 0, actual: 0, dist: 'linear', kind: 'Materiale', cbs: '' }; a.costs.push(l); rep.created++; }
          ['company', 'desc', 'mat', 'um', 'kind', 'cbs'].forEach((k) => { if (row[k] !== undefined && row[k] !== '') l[k] = String(row[k]); });
          if (row.dist) { const k = Object.keys(M.Costs.DIST).find((x) => norm(M.Costs.DIST[x]) === norm(row.dist) || x === row.dist); if (k) l.dist = k; }
          Object.assign(l, nums);
        }
      }
      if (Object.keys(errs).length) rep.errors.push({ row: ri, cols: errs }); else rep.ok++;
    });
    return rep;
  }

  /* ---------- finestra di incolla / import tabellare ---------- */
  const Paste = {
    state: null,
    open(text, kind, rows) {
      Paste.state = { kind: kind || 'activities', text: text || '', rows: rows || null, addNew: true, map: null, hasHeader: true };
      Paste.render();
    },
    parse() {
      const st = Paste.state;
      const grid = st.rows || M.Zip.parseDelimited(st.text);
      if (!grid.length) return null;
      const headers = st.hasHeader ? grid[0].map((x) => String(x === undefined ? '' : x)) : grid[0].map((x, i) => 'Colonna ' + (i + 1));
      const data = st.hasHeader ? grid.slice(1) : grid;
      if (!st.map || st.map.length !== headers.length) st.map = autoMap(st.kind, headers);
      return { headers, data };
    },
    objs(parsed) { const st = Paste.state; return parsed.data.map((r) => { const o = {}; st.map.forEach((k, i) => { if (k) o[k] = r[i] === undefined || r[i] === null ? '' : typeof r[i] === 'number' && (k === 'as' || k === 'af') ? r[i] : String(r[i]).trim(); }); return o; }); },
    render() {
      const st = Paste.state;
      const parsed = st.text || st.rows ? Paste.parse() : null;
      let preview = '';
      if (parsed) {
        const objs = Paste.objs(parsed);
        const dry = U.clone(S.P());
        const rep = applyTable(dry, st.kind, objs, { addNew: st.addNew });
        st.rep = rep;
        const errRows = new Map(rep.errors.map((e) => [e.row, e.cols]));
        const skip = new Map(rep.skipped.map((e) => [e.row, e.msg]));
        const fields = KINDS[st.kind].fields();
        preview = '<div class="mapgrid"><table class="tb compact"><thead><tr>' + parsed.headers.map((h, i) => '<th><span class="small muted">' + esc(h) + '</span><br><select class="inp sm" data-c="pasteMap" data-i="' + i + '" aria-label="Campo per la colonna ' + esc(h) + '"><option value="">(ignora)</option>' + Object.entries(fields).map(([k, l]) => '<option value="' + k + '"' + (st.map[i] === k ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></th>').join('') + '</tr></thead><tbody>' + parsed.data.slice(0, 60).map((r, ri) => '<tr class="' + (skip.has(ri) ? 'skip' : '') + '"' + (skip.has(ri) ? ' title="' + esc(skip.get(ri)) + '"' : '') + '>' + parsed.headers.map((h, ci) => { const k = st.map[ci]; const e = errRows.get(ri) && k && errRows.get(ri)[k]; const v = r[ci]; return '<td class="' + (e ? 'cellerr' : '') + '"' + (e ? ' title="' + esc(e) + '"' : '') + '>' + esc(v === undefined ? '' : typeof v === 'number' && (k === 'as' || k === 'af') ? U.fd(U.parseDate(v)) : v) + (e ? ' <span class="errtag">' + esc(e) + '</span>' : '') + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>' + (parsed.data.length > 60 ? '<p class="help">Anteprima delle prime 60 righe su ' + parsed.data.length + '.</p>' : '') +
          '<div class="kpis sm"><div class="kpi"><p class="ey">Righe valide</p><div class="v">' + rep.ok + '</div></div><div class="kpi"><p class="ey">Nuove</p><div class="v">' + rep.created + '</div></div><div class="kpi"><p class="ey">Con errori</p><div class="v ' + (rep.errors.length ? 'neg' : '') + '">' + rep.errors.length + '</div></div><div class="kpi"><p class="ey">Scartate</p><div class="v">' + rep.skipped.length + '</div></div></div><p class="help">Simulazione a vuoto: nulla è ancora cambiato. Le righe con errori vengono importate senza le celle errate; le scartate non entrano.</p>';
      }
      const body = '<div class="grid3"><label class="fld">Cosa stai incollando' + UI.sel('pasteKind', Object.entries(KINDS).map(([k, v]) => [k, v.label]), st.kind) + '</label><label class="sw"><input type="checkbox" data-c="pasteHeader"' + (st.hasHeader ? ' checked' : '') + '> La prima riga contiene le intestazioni</label>' + (st.kind === 'activities' ? '<label class="sw"><input type="checkbox" data-c="pasteNew"' + (st.addNew ? ' checked' : '') + '> Aggiungi le attività con ID nuovo</label>' : '<span></span>') + '</div>' +
        (st.rows ? '<p class="help">' + st.rows.length + ' righe lette dal file.</p>' : '<label class="fld">Incolla qui le celle copiate da Excel (Ctrl+V)<textarea class="inp mono" rows="5" id="paste-ta" data-i="pasteText" placeholder="ID attività&#9;Nome attività&#9;Durata originale&#9;Predecessori&#10;A2010&#9;Getto solaio P1&#9;8&#9;A1030 SS+20">' + esc(st.text) + '</textarea></label>') + '<p class="help">Abbinamento per ID attività. I legami si scrivono come testo, per esempio "A1020 FS+2; A1015 SS". Le date accettano gg/mm/aa, gg/mm/aaaa o il formato data di Excel.</p>' + preview;
      const existing = UI.topModal();
      const html = { title: 'Incolla o importa da Excel', info: 'paste', xwide: true, body, foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="pasteApply"' + (parsed && st.rep && st.rep.ok ? '' : ' disabled') + '>Applica ' + (parsed && st.rep ? st.rep.ok + ' righe' : '') + '</button>' };
      if (existing && existing.classList.contains('modal-bg') && existing.querySelector('#paste-ta, .mapgrid') ) { existing.querySelector('.modal-b').innerHTML = body; existing.querySelector('.modal-f').innerHTML = html.foot; }
      else UI.modal(html);
    },
    apply() {
      const st = Paste.state; const parsed = Paste.parse(); if (!parsed) return;
      const objs = Paste.objs(parsed);
      const cap = st.kind === 'costs' ? 'cost' : st.kind === 'progress' ? 'progress' : 'schedule';
      let rep = null;
      const affects = st.kind !== 'costs';
      const ok = S.mutate((w) => { rep = applyTable(w, st.kind, objs, { addNew: st.addNew }); }, { cap, affects });
      UI.closeModal();
      if (!ok) return;
      Paste.report(rep, KINDS[st.kind].label);
    },
    report(rep, label) {
      const lines = rep.errors.map((e) => '<li>Riga ' + (e.row + 2) + ': ' + Object.entries(e.cols).map(([k, v]) => esc(k + ' ' + v)).join(', ') + '</li>').concat(rep.skipped.map((e) => '<li>Riga ' + (e.row + 2) + ' scartata: ' + esc(e.msg) + '</li>'));
      UI.modal({ title: 'Report import - ' + label, info: 'import', body: '<p><b>' + rep.ok + '</b> righe applicate, <b>' + rep.created + '</b> elementi nuovi, <b>' + rep.errors.length + '</b> righe con celle non importate, <b>' + rep.skipped.length + '</b> righe scartate.</p>' + (lines.length ? '<h3 class="h3">Cosa non è stato importato</h3><ul class="plain small">' + lines.join('') + '</ul>' : '') + '<p class="help">' + (S.inPreview() ? 'Le modifiche sono in anteprima: Annulla nella banda gialla le scarta tutte.' : 'Puoi annullare con Ctrl+Z. Lancia F9 per ricalcolare le date.') + '</p>', foot: (lines.length ? '<button type="button" class="btn" data-a="reportCsv">Scarica il report</button>' : '') + '<button type="button" class="btn" data-a="undoImport">Annulla import</button><button type="button" class="btn-p" data-a="closeModal">Chiudi</button>', after: () => { Paste._lastRep = rep; } });
    }
  };
  M.Paste = Paste;

  /* ---------- export della vista attività in Excel ---------- */
  M.Views.exportActivitiesView = function () {
    const ctx = VH.ctx(); const A = M.Views.attivita;
    const tr = A.traceInfo(ctx); const rows = A.buildRows(ctx, tr);
    const cks = A.cols().filter((k) => k !== 'level' || tr);
    const fields = VH.fieldsAll(); fields.level = { label: 'Livello', get: (c, a) => (tr && tr.levels.has(a.id) ? tr.levels.get(a.id) : '') };
    const out = [cks.map((k) => ({ v: fields[k].label, s: 1 }))];
    rows.forEach((r) => {
      if (r.g) { out.push(cks.map((k, i) => (i === 0 ? { v: '  '.repeat(r.lvl) + r.label + ' (' + r.members.length + ')', s: 3 } : { v: '', s: 3 }))); return; }
      out.push(cks.map((k) => { const v = VH.cellValueForExcel(fields[k], ctx, r.a); return k === 'name' && r.lvl ? '  '.repeat(r.lvl) + v : v; }));
    });
    const l = A.layout();
    const info = [[{ v: 'Meridian - export della vista', s: 1 }, ''], ['Progetto', ctx.p.code], ['Data date', { v: U.dnOf(ctx.p.dataDate), t: 'd' }], ['Layout', l.name], ['Filtro', S.ui.filter], ['Raggruppamento', S.ui.group], ['Esportato il', U.fts(U.nowStamp())], ['Ritorno', 'Modifica i campi e reimporta da Scambio dati: abbinamento per ID attività.']];
    U.download(U.slug(ctx.p.code) + '_' + U.slug(l.name) + '.xlsx', M.Zip.xlsx([{ name: 'Vista', rows: out, freeze: 1, autoFilter: true, cols: cks.map((k) => Math.max(8, Math.round((fields[k].w || 80) / 7))) }, { name: 'Info', rows: info, cols: [18, 60] }]));
    UI.toast('Vista esportata con colonne, filtro e raggruppamento correnti.', 'ok');
  };

  function fidelity(res) {
    UI.modal({ title: 'Export completato: cosa non è rappresentabile', info: 'export', body: '<p>File <b class="mono">' + esc(res.name) + '</b> scaricato.</p><ul class="plain">' + res.notes.map((n) => '<li>' + UI.ic('alert', 14) + ' ' + esc(n) + '</li>').join('') + '</ul>' });
  }

  function fullTemplate() {
    const ctx = VH.ctx(); const p = ctx.p; const f = VH.fieldsAll();
    const actCols = ['code', 'name', 'wbs', 'type', 'od', 'rd', 'start', 'finish', 'as', 'af', 'pct', 'cstr', 'cal', 'preds', 'tf', 'drawings'].concat(Object.keys(f).filter((k) => k.startsWith('code_') || k.startsWith('udf_')));
    const sheet1 = [actCols.map((k) => ({ v: f[k].label, s: 1 }))].concat(p.activities.map((a) => actCols.map((k) => VH.cellValueForExcel(f[k], ctx, a))));
    const rels = [['Predecessore (ID)', 'Successore (ID)', 'Tipo legame', 'Lag (g)'].map((v) => ({ v, s: 1 }))].concat(p.rels.map((r) => [(ctx.byId.get(r.pred) || {}).code, (ctx.byId.get(r.succ) || {}).code, r.type, r.lag || 0]));
    const asg = [['ID attività', 'Risorsa (codice o nome)', 'Unità per giorno', 'Budgeted', 'Actual', 'Remaining'].map((v) => ({ v, s: 1 }))];
    p.activities.forEach((a) => (a.assign || []).forEach((x) => asg.push([a.code, (S.res(x.resId) || {}).code, x.upd, x.bud, x.act || 0, x.rem || 0])));
    const costs = [['ID attività', 'Impresa', 'Descrizione', 'Materiale', 'UM', 'Quantità', 'Costo unitario', 'Q.tà eseguita', 'Consuntivo', 'Distribuzione', 'Natura', 'Conto'].map((v) => ({ v, s: 1 }))];
    p.activities.forEach((a) => (a.costs || []).forEach((l) => costs.push([a.code, l.company, l.desc, l.mat, l.um, Number(l.qty) || 0, Number(l.unit) || 0, Number(l.qtyDone) || 0, Number(l.actual) || 0, M.Costs.DIST[l.dist] || l.dist, l.kind, l.cbs])));
    const prog = [['ID attività', 'Inizio reale', 'Fine reale', '% fisica', 'Durata rimanente', 'Actual (h)'].map((v) => ({ v, s: 1 }))].concat(p.activities.filter((a) => !a.af && a.type !== 'wbs').map((a) => [a.code, a.as ? { v: U.dnOf(a.as), t: 'd' } : '', '', Number(a.pct) || 0, a.as ? a.rd || 0 : '', U.sum((a.assign || []).filter((x) => (S.res(x.resId) || {}).type === 'Labor'), (x) => x.act || 0)]));
    U.download('Modello_' + U.slug(p.code) + '.xlsx', M.Zip.xlsx([{ name: 'Attività', rows: sheet1, freeze: 1, autoFilter: true, cols: actCols.map((k) => Math.max(8, Math.round((f[k].w || 80) / 7))) }, { name: 'Legami', rows: rels, freeze: 1, cols: [16, 16, 12, 8] }, { name: 'Assegnazioni', rows: asg, freeze: 1, cols: [14, 22, 14, 12, 12, 12] }, { name: 'Righe di costo', rows: costs, freeze: 1, cols: [12, 26, 36, 18, 8, 10, 12, 12, 12, 12, 12, 10] }, { name: 'Avanzamento', rows: prog, freeze: 1, cols: [14, 13, 13, 10, 14, 12] }]));
    UI.toast('Modello completo scaricato: 5 fogli reimportabili uno per volta.', 'ok');
  }

  /* ---------- import di file ---------- */
  async function importFile(file) {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.xer')) { const text = await U.readFile(file, true); const t = M.Exchange.parseXer(text); return projectImport(M.Exchange.xerToProject(t, 0), 'XER', t.PROJECT.length); }
      if (name.endsWith('.xml')) { const text = await U.readFile(file, true); if (/APIBusinessObjects/.test(text.slice(0, 600))) { UI.toast('L\'import dell\'XML di P6 non è ancora supportato: usa il formato XER.', 'warn'); return; } return projectImport(M.Exchange.parseMsp(text), 'XML di MS Project', 1); }
      if (name.endsWith('.xlsx')) {
        const sheets = await M.Zip.readXlsx(await U.readFile(file));
        const pick = sheets.length > 1 ? sheets : null;
        if (pick) { UI.modal({ title: 'Quale foglio importare?', body: '<div class="list">' + sheets.map((s, i) => '<button type="button" class="li" data-a="sheetPick" data-i="' + i + '">' + esc(s.name) + ' <small>' + s.rows.length + ' righe</small></button>').join('') + '</div>', after: () => { M.Views.scambio._sheets = sheets; } }); return; }
        const kind = guessKind(sheets[0].name, sheets[0].rows[0]); return Paste.open('', kind, sheets[0].rows.map((r) => r.map((c) => (c === undefined ? '' : c))));
      }
      const text = await U.readFile(file, true); return Paste.open(text, 'activities');
    } catch (e) { console.error(e); UI.toast('Import non riuscito: ' + e.message, 'bad'); }
  }
  function guessKind(name, header) {
    const n = norm(name); const h = (header || []).map(norm).join(' ');
    if (n.includes('legam') || (h.includes('predecessore') && h.includes('successore'))) return 'rels';
    if (n.includes('assegn')) return 'assign';
    if (n.includes('costo') || h.includes('costo unitario')) return 'costs';
    if (n.includes('avanz')) return 'progress';
    return 'activities';
  }
  function projectImport(res, fmt, nProj) {
    const P = res.project;
    UI.modal({ title: 'Import ' + fmt + ': ' + P.code, info: 'import', wide: true, body: '<p>' + (nProj > 1 ? 'Il file contiene ' + nProj + ' progetti: viene importato il primo. ' : '') + 'Simulazione a vuoto completata.</p><dl class="kv">' + Object.entries(res.counts).map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>').join('') + '<dt>Data date</dt><dd>' + U.fd(P.dataDate) + '</dd><dt>Inizio</dt><dd>' + U.fd(P.plannedStart) + '</dd></dl>' + (res.report.length ? '<h3 class="h3">Cosa non viene importato</h3><ul class="plain small">' + res.report.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>' : '') + '<fieldset class="fs"><legend>Destinazione</legend><label class="ck"><input type="radio" name="imp-m" value="new" checked> Nuovo progetto nel nodo CURR di un lavoro</label><label class="ck"><input type="radio" name="imp-m" value="merge"> Unisci per ID attività nel progetto aperto (' + esc(S.P().code) + ')</label></fieldset><label class="fld">Lavoro (EPS)' + UI.sel('noop', S.db.eps.filter((e) => e.kind === 'node' && e.parent).map((e) => [e.code, e.code + ' ' + e.name]), S.P().work, 'id="imp-w"') + '</label>', foot: '<button type="button" class="btn" data-a="closeModal">Annulla</button><button type="button" class="btn-p" data-a="importDo">Importa</button>', after: () => { M.Views.scambio._imp = res; } });
  }

  M.Views.scambio = {
    title: 'Scambio dati',
    render() {
      const p = S.P(); const t = S.ui.scambioTab || 'export';
      const can = S.can('exchange');
      const exp = '<div class="row">' + UI.card('Excel e CSV', '<ul class="actions"><li><span><b>Vista attività corrente</b>: colonne, filtri e raggruppamenti come a schermo</span><button type="button" class="btn sm" data-a="exportView">Excel</button></li><li><span><b>Modello completo</b>: attività, legami, assegnazioni, righe di costo, avanzamento (reimportabile)</span><button type="button" class="btn sm" data-a="exportTemplate">Excel</button></li><li><span><b>Attività in CSV</b> (separatore punto e virgola)</span><button type="button" class="btn sm" data-a="exportCsv">CSV</button></li><li><span><b>Righe di costo</b></span><button type="button" class="btn sm" data-a="costExport">Excel</button></li></ul>', { info: 'export', style: 'flex:1 1 420px' }) +
        UI.card('Primavera P6 e MS Project', '<ul class="actions"><li><span><b>XER</b> di Primavera P6: progetto, calendari, WBS, attività, legami, risorse, assegnazioni, expenses, codici</span><button type="button" class="btn sm" data-a="exportXer">XER</button></li><li><span><b>XML di P6</b> (PMXML semplificato)</span><button type="button" class="btn sm" data-a="exportP6xml">XML</button></li><li><span><b>XML di MS Project</b> (MSPDI). Il formato .mpp è proprietario e non è supportato.</span><button type="button" class="btn sm" data-a="exportMsp">XML</button></li></ul><p class="help">Ogni export segnala cosa non è rappresentabile. Nessuna promessa di round trip perfetto con XER.</p>', { info: 'export', style: 'flex:1 1 420px' }) +
        UI.card('PDF e immagini', '<ul class="actions"><li><span><b>PDF della vista</b>: stampa del Gantt o di qualsiasi pagina con il layout di stampa</span><button type="button" class="btn sm" data-a="printView">PDF</button></li><li><span><b>Immagine del Gantt</b> (PNG)</span><button type="button" class="btn sm" data-a="ganttPng">PNG</button></li><li><span><b>Immagine del reticolo</b>: dal Reticolo, pulsante Immagine</span><a class="btn sm" href="#/attivita" data-a="goNet">Apri</a></li></ul>', { style: 'flex:1 1 320px' }) + '</div>';
      const imp = UI.card('Import guidato', '<div class="drop" id="drop"><p>' + UI.ic('up', 28) + '</p><p><b>Trascina qui un file</b> oppure scegli</p><input type="file" id="imp-file" accept=".xer,.xml,.xlsx,.csv,.txt" aria-label="Scegli il file da importare"' + (can ? '' : ' disabled') + '><p class="help">XER di Primavera P6, XML di MS Project, Excel (.xlsx) e CSV. Mappatura delle colonne, anteprima, errori per cella, simulazione a vuoto, unione per ID attività o nuovo progetto, report finale di ciò che non è stato importato.</p></div><div class="acts"><button type="button" class="btn" data-a="pasteOpen"' + (can ? '' : ' disabled') + '>' + UI.ic('paste') + 'Incolla da Excel</button>' + UI.i('paste') + '</div>', { info: 'import' }) +
        UI.card('Ritorno da Excel', '<p>Esporta una vista o il modello, modifica i campi in Excel e reimporta: Meridian abbina le righe per ID attività e aggiorna solo i campi presenti. I campi calcolati (date Early e Late, float) vengono ignorati, come in P6.</p><p class="help">Per eliminare attività usa Meridian: l\'import aggiorna o aggiunge, non cancella.</p>');
      return '<div class="head"><div><p class="ey">' + esc(p.code) + '</p><h1>Scambio dati</h1><p class="sub">Import, export e copia-incolla con Excel, Primavera P6 e MS Project.</p></div></div><div class="tabs" role="tablist">' + [['export', 'Export'], ['import', 'Import e incolla']].map(([k, l]) => '<button type="button" class="tab' + (k === t ? ' on' : '') + '" role="tab" aria-selected="' + (k === t) + '" data-a="scTab" data-t="' + k + '">' + l + '</button>').join('') + '</div>' + (t === 'export' ? exp : imp);
    },
    after() {
      const f = document.getElementById('imp-file'); if (f) f.addEventListener('change', () => { if (f.files[0]) importFile(f.files[0]); });
      const d = document.getElementById('drop'); if (d) { d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('over'); }); d.addEventListener('dragleave', () => d.classList.remove('over')); d.addEventListener('drop', (e) => { e.preventDefault(); d.classList.remove('over'); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); }); }
    },
    paste(text) { if (S.can('exchange')) Paste.open(text, 'activities'); },
    applyTable
  };

  Object.assign(M.A, {
    scTab(el) { S.ui.scambioTab = el.getAttribute('data-t'); S.saveUi(); M.App.render(); },
    pasteApply() { Paste.apply(); },
    undoImport() { UI.closeModal(); S.undoLast(); },
    reportCsv() { const r = Paste._lastRep; if (!r) return; const rows = [['Riga', 'Esito', 'Dettaglio']].concat(r.errors.map((e) => [e.row + 2, 'celle non importate', Object.entries(e.cols).map(([k, v]) => k + ': ' + v).join('; ')])).concat(r.skipped.map((e) => [e.row + 2, 'scartata', e.msg])); U.download('Report_import.csv', M.Zip.toCsv(rows)); },
    exportTemplate() { fullTemplate(); },
    exportCsv() { const ctx = VH.ctx(); const f = VH.fieldsAll(); const ks = ['code', 'name', 'wbs', 'od', 'rd', 'start', 'finish', 'as', 'af', 'pct', 'tf', 'preds']; const rows = [ks.map((k) => f[k].label)].concat(ctx.p.activities.map((a) => ks.map((k) => VH.cellValueForExcel(f[k], ctx, a)))); U.download(U.slug(ctx.p.code) + '_attivita.csv', M.Zip.toCsv(rows), 'text/csv'); },
    exportXer() { const r = M.Exchange.toXer(S.P(), S.db); U.download(r.name, r.blob); fidelity(r); },
    exportP6xml() { const r = M.Exchange.toP6Xml(S.P(), S.db); U.download(r.name, r.blob); fidelity(r); },
    exportMsp() { const r = M.Exchange.toMspXml(S.P(), S.db); U.download(r.name, r.blob); fidelity(r); },
    printView() { S.ui.view = 'gantt'; S.saveUi(); M.App.go('attivita'); setTimeout(() => window.print(), 400); },
    ganttPng() { const g = M.Views.attivita.ganttSvg(); const div = document.createElement('div'); div.innerHTML = g.svg; const svg = div.firstChild; const W = Number(svg.getAttribute('width')), H = Number(svg.getAttribute('height')); M.Views.svgToPng(svg, W, H, 'Gantt_' + U.slug(S.P().code) + '.png'); },
    goNet() { S.ui.view = 'net'; S.saveUi(); },
    sheetPick(el) { const s = M.Views.scambio._sheets[Number(el.getAttribute('data-i'))]; UI.closeModal(); Paste.open('', guessKind(s.name, s.rows[0]), s.rows.map((r) => r.map((c) => (c === undefined ? '' : c)))); },
    importDo() {
      const res = M.Views.scambio._imp; if (!res) return;
      const mode = (U.$('input[name="imp-m"]:checked') || {}).value; const work = U.$('#imp-w').value;
      UI.closeModal();
      const calMap = {};
      res.calendars.forEach((c) => { const ex = S.db.calendars.find((x) => x.name === c.name && JSON.stringify(x.week) === JSON.stringify(c.week)); if (ex) calMap[c.id] = ex.id; else { S.db.calendars.push({ id: c.id, name: c.name, type: c.type, week: c.week, hoursDay: c.hoursDay, holidays: c.holidays, recurring: c.recurring, workdays: [] }); calMap[c.id] = c.id; } });
      const resMap = {};
      res.resources.forEach((r) => { const ex = S.db.resources.find((x) => !x.group && (x.code === r.code || x.name === r.name)); if (ex) resMap[r.id] = ex.id; else { S.db.resources.push({ id: r.id, code: r.code, name: r.name, type: r.type, parent: r.type === 'Labor' ? 'g_lab' : r.type === 'Nonlabor' ? 'g_nl' : 'g_mat', unit: r.unit, price: r.price, defUpd: r.defUpd, maxUpd: r.maxUpd, calId: 'cal5' }); resMap[r.id] = r.id; } });
      res.codeTypes.forEach((t) => { const ex = S.db.codeTypes.find((x) => x.id === t.id); if (!ex) S.db.codeTypes.push(t); else t.values.forEach((v) => { if (!ex.values.some((y) => y.code === v.code)) ex.values.push(v); }); });
      res.project.activities.forEach((a) => { if (a.calId) a.calId = calMap[a.calId] || a.calId; (a.assign || []).forEach((x) => { x.resId = resMap[x.resId] || x.resId; }); });
      const pcal = res.project.calXid ? (res.calendars.find((c) => c.xid === res.project.calXid) || {}).id : null;
      if (mode === 'merge') {
        let rep = { ok: 0, created: 0, errors: [], skipped: [] };
        S.mutate((w) => {
          const by = new Map(w.activities.map((a) => [a.code, a]));
          const idMap = {};
          res.project.activities.forEach((ia) => { const a = by.get(ia.code); if (a) { ['name', 'od', 'rd', 'as', 'af', 'pct', 'cstr', 'type'].forEach((k) => { if (ia[k] !== undefined) a[k] = ia[k]; }); idMap[ia.id] = a.id; rep.ok++; } else { const n = Object.assign({}, ia, { id: U.uid('a'), wbsId: (w.wbs.find((x) => !x.parent) || {}).id }); w.activities.push(n); idMap[ia.id] = n.id; rep.created++; } });
          res.project.rels.forEach((r) => { const pr = idMap[r.pred], su = idMap[r.succ]; if (!pr || !su) return; if (!w.rels.some((x) => x.pred === pr && x.succ === su)) w.rels.push({ id: U.uid('r'), pred: pr, succ: su, type: r.type, lag: r.lag }); });
        });
        Paste.report(rep, 'unione per ID');
        return;
      }
      const node = S.db.eps.find((e) => e.code === work);
      const id = U.uid('p');
      const P = Object.assign({ id, work, workName: node ? node.name : work, epsId: S.epsNodeFor(work, 'CURR'), status: 'CURR', obsId: node ? node.obs : '', calId: pcal || S.P().calId, rateType: 'Price/Unit', defaults: { durType: 'FDU', pctType: 'phys', actType: 'task' }, drawings: [], baselines: {}, versions: [], version: 1, dirty: false, progress: [], proposals: [], issues: [], risks: [], thresholds: [], changes: [], periodHistory: [], layouts: S.P().layouts ? U.clone(S.P().layouts) : [], notes: [], cycleStep: 1, contractValue: 0, nextCutoff: '' }, res.project);
      delete P.calXid;
      if (S.db.projects.some((x) => x.code === P.code)) P.code = P.code + '_import';
      S.schedule(P); S.db.projects.push(P); S.save(); S.setActive(id);
      UI.toast('Progetto ' + P.code + ' importato: ' + P.activities.length + ' attività, ' + P.rels.length + ' legami.' + (P.sched.ok ? ' Fine calcolata ' + U.fd(P.sched.finishDay) + '.' : ' Il calcolo segnala errori: apri il log.'), P.sched.ok ? 'ok' : 'warn');
      M.App.go('attivita');
    }
  });
  Object.assign(M.C, {
    pasteKind(el) { Paste.state.kind = el.value; Paste.state.map = null; Paste.render(); },
    pasteHeader(el) { Paste.state.hasHeader = el.checked; Paste.state.map = null; Paste.render(); },
    pasteNew(el) { Paste.state.addNew = el.checked; Paste.render(); },
    pasteMap(el) { Paste.state.map[Number(el.getAttribute('data-i'))] = el.value; Paste.render(); }
  });
  M.I.pasteText = function (el) { Paste.state.text = el.value; Paste.state.map = null; const pos = el.selectionStart; Paste.render(); const t = document.getElementById('paste-ta'); if (t) { t.focus(); try { t.setSelectionRange(pos, pos); } catch (e) { /* */ } } };
})(window.M = window.M || {});
