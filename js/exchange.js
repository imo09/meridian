/* Meridian - scambio dati con Primavera P6 (XER, XML) e MS Project (XML MSPDI) */
(function (M) {
  'use strict';
  const U = M.U, Cal = M.Cal;
  const HPD = 8;
  const xe = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const xerDate = (dn, end) => (dn === null || dn === undefined ? '' : U.isoOf(dn) + (end ? ' 17:00' : ' 08:00'));
  const isoT = (dn, end) => (dn === null || dn === undefined ? '' : U.isoOf(dn) + (end ? 'T17:00:00' : 'T08:00:00'));

  const TT = { task: 'TT_Task', rsrc: 'TT_Rsrc', start: 'TT_Mile', finish: 'TT_FinMile', loe: 'TT_LOE', wbs: 'TT_WBS' };
  const TT_R = Object.fromEntries(Object.entries(TT).map(([k, v]) => [v, k]));
  const CS = { SNET: 'CS_MSOA', SNLT: 'CS_MSOB', FNET: 'CS_MEOA', FNLT: 'CS_MEOB', SO: 'CS_MSO', FO: 'CS_MEO', MSO: 'CS_MANDSTART', MFO: 'CS_MANDFIN', ALAP: 'CS_ALAP' };
  const CS_R = Object.fromEntries(Object.entries(CS).map(([k, v]) => [v, k]));
  const DT = { FDU: 'DT_FixedDUR2', FDQ: 'DT_FixedDrtn', FR: 'DT_FixedRate', FQ: 'DT_FixedQty' };
  const DT_R = Object.fromEntries(Object.entries(DT).map(([k, v]) => [v, k]));
  const CP = { phys: 'CP_Phys', dur: 'CP_Drtn', units: 'CP_Units', qty: 'CP_Phys' };
  const CP_R = { CP_Phys: 'phys', CP_Drtn: 'dur', CP_Units: 'units' };
  const RT = { Labor: 'RT_Labor', Nonlabor: 'RT_Equip', Material: 'RT_Mat' };
  const RT_R = { RT_Labor: 'Labor', RT_Equip: 'Nonlabor', RT_Mat: 'Material' };

  function scheduleDates(p, a) {
    const r = p.sched && p.sched.acts ? p.sched.acts[a.id] : null;
    if (!r) return {};
    const fin = M.CPM.isMile(a) ? (a.type === 'start' ? r.es : r.ef - 1) : r.ef - 1;
    return { es: r.es, ef: fin, ls: r.ls, lf: M.CPM.isMile(a) && a.type === 'start' ? r.lf : r.lf - 1, tf: r.tf, ff: r.ff, crit: r.crit, rs: r.rs };
  }

  function clndrData(cal) {
    const days = [];
    const week = cal.week || [8, 8, 8, 8, 8, 0, 0];
    for (let d = 1; d <= 7; d++) {
      const h = week[(d + 5) % 7];
      if (!h) days.push('(0||' + d + '()())');
      else if (h >= 24) days.push('(0||' + d + '()((0||0(s|00:00|f|00:00)())))');
      else { const end = 13 + Math.max(0, h - 4); days.push('(0||' + d + '()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|' + String(end).padStart(2, '0') + ':00)())))'); }
    }
    const exc = [];
    const from = U.dnYmd(2025, 0, 1), to = U.dnYmd(2030, 11, 31);
    for (let d = from; d <= to; d++) { if ((week[U.weekday(d)] || 0) > 0 && !Cal.isWork(cal, d)) exc.push('(0||' + exc.length + '(d|' + (d + 25569) + ')())'); }
    return '(0||CalendarData()((0||DaysOfWeek()(' + days.join('') + '))(0||VIEW(ShowTotal|Y)())(0||Exceptions()(' + exc.join('') + '))))';
  }

  /* ---------- export XER ---------- */
  function toXer(p, db) {
    const notes = [];
    const lines = ['ERMHDR\t19.12\t' + U.isoOf(U.todayDn()) + '\tProject\tmeridian\tMeridian\tdbxDatabaseNoName\tProject Management\tEUR'];
    const T = (name, fields, rows) => { lines.push('%T\t' + name); lines.push('%F\t' + fields.join('\t')); rows.forEach((r) => lines.push('%R\t' + fields.map((f) => { const v = r[f]; return v === null || v === undefined ? '' : String(v).replace(/[\t\r\n]+/g, ' '); }).join('\t'))); };
    let nid = 1000;
    const idm = new Map(); const id = (k) => { if (!idm.has(k)) idm.set(k, ++nid); return idm.get(k); };
    const PID = id('proj:' + p.id);
    const usedCals = new Set([p.calId]); p.activities.forEach((a) => usedCals.add(a.calId || p.calId));
    (db.resources || []).forEach((r) => { if (r.calId) usedCals.add(r.calId); });
    const cals = db.calendars.filter((c) => usedCals.has(c.id));
    T('CALENDAR', ['clndr_id', 'default_flag', 'clndr_name', 'proj_id', 'base_clndr_id', 'last_chng_date', 'clndr_type', 'day_hr_cnt', 'week_hr_cnt', 'month_hr_cnt', 'year_hr_cnt', 'rsrc_private', 'clndr_data'],
      cals.map((c) => ({ clndr_id: id('cal:' + c.id), default_flag: c.id === p.calId ? 'Y' : 'N', clndr_name: c.name, proj_id: '', base_clndr_id: '', last_chng_date: xerDate(U.todayDn()), clndr_type: c.type === 'resource' ? 'CA_Rsrc' : c.type === 'project' ? 'CA_Project' : 'CA_Base', day_hr_cnt: c.hoursDay || HPD, week_hr_cnt: U.sum(c.week || []), month_hr_cnt: Math.round(U.sum(c.week || []) * 4.33), year_hr_cnt: U.sum(c.week || []) * 52, rsrc_private: 'N', clndr_data: clndrData(c) })));
    const S = p.sched || {};
    T('PROJECT', ['proj_id', 'proj_short_name', 'clndr_id', 'project_flag', 'name_sep_char', 'def_duration_type', 'def_complete_pct_type', 'def_task_type', 'critical_path_type', 'plan_start_date', 'plan_end_date', 'scd_end_date', 'last_recalc_date', 'next_data_date', 'def_rate_type', 'add_date'],
      [{ proj_id: PID, proj_short_name: p.code, clndr_id: id('cal:' + p.calId), project_flag: 'Y', name_sep_char: '.', def_duration_type: DT[p.defaults && p.defaults.durType] || 'DT_FixedDUR2', def_complete_pct_type: CP[p.defaults && p.defaults.pctType] || 'CP_Phys', def_task_type: TT[p.defaults && p.defaults.actType] || 'TT_Task', critical_path_type: M.Store && M.Store.S().criticalMode === 'TF' ? 'CT_TotFloat' : 'CT_DrivPath', plan_start_date: xerDate(U.dnOf(p.plannedStart)), plan_end_date: p.mustFinish ? xerDate(U.dnOf(p.mustFinish), true) : '', scd_end_date: S.finishDay ? xerDate(S.finishDay, true) : '', last_recalc_date: xerDate(U.dnOf(p.dataDate) + 1), next_data_date: xerDate(U.dnOf(p.dataDate) + 1), def_rate_type: 'COST_PER_QTY', add_date: xerDate(U.todayDn()) }]);
    const root = (p.wbs || []).find((w) => !w.parent);
    const wbsRows = (p.wbs || []).map((w, i) => ({ wbs_id: id('wbs:' + w.id), proj_id: PID, obs_id: '', seq_num: (i + 1) * 10, est_wt: 1, proj_node_flag: w === root ? 'Y' : 'N', sum_data_flag: 'Y', status_code: 'WS_Open', wbs_short_name: w === root ? p.code : w.code, wbs_name: w === root ? p.name : w.name, parent_wbs_id: w.parent ? id('wbs:' + w.parent) : '' }));
    T('PROJWBS', ['wbs_id', 'proj_id', 'obs_id', 'seq_num', 'est_wt', 'proj_node_flag', 'sum_data_flag', 'status_code', 'wbs_short_name', 'wbs_name', 'parent_wbs_id'], wbsRows);
    const ress = (db.resources || []).filter((r) => !r.group && p.activities.some((a) => (a.assign || []).some((x) => x.resId === r.id)));
    T('RSRC', ['rsrc_id', 'parent_rsrc_id', 'clndr_id', 'rsrc_short_name', 'rsrc_name', 'rsrc_type', 'def_qty_per_hr', 'active_flag', 'unit_id'], ress.map((r) => ({ rsrc_id: id('res:' + r.id), parent_rsrc_id: '', clndr_id: id('cal:' + (r.calId || p.calId)), rsrc_short_name: r.code, rsrc_name: r.name, rsrc_type: RT[r.type] || 'RT_Labor', def_qty_per_hr: r.type === 'Material' ? '' : U.round2((r.defUpd || 8) / HPD), active_flag: 'Y', unit_id: '' })));
    T('RSRCRATE', ['rsrc_rate_id', 'rsrc_id', 'max_qty_per_hr', 'cost_per_qty', 'start_date'], ress.map((r) => ({ rsrc_rate_id: id('rate:' + r.id), rsrc_id: id('res:' + r.id), max_qty_per_hr: U.round2((r.maxUpd || 8) / HPD), cost_per_qty: r.price, start_date: '1990-01-01 00:00' })));
    const taskRows = p.activities.map((a) => {
      const d = scheduleDates(p, a);
      const st = M.CPM.statusOf(a);
      const r = S.acts && S.acts[a.id];
      return {
        task_id: id('t:' + a.id), proj_id: PID, wbs_id: id('wbs:' + a.wbsId), clndr_id: id('cal:' + (a.calId || p.calId)), phys_complete_pct: a.af ? 100 : U.round2(Number(a.pct) || 0), complete_pct_type: CP[a.pctType] || 'CP_Phys', task_type: TT[a.type] || 'TT_Task', duration_type: DT[a.durType] || 'DT_FixedDUR2',
        status_code: st === 'done' ? 'TK_Complete' : st === 'active' ? 'TK_Active' : 'TK_NotStart', task_code: a.code, task_name: a.name,
        total_float_hr_cnt: r && r.tf !== null && r.tf !== undefined ? r.tf * HPD : '', free_float_hr_cnt: r && r.ff !== null && r.ff !== undefined ? r.ff * HPD : '',
        remain_drtn_hr_cnt: st === 'done' ? 0 : ((st === 'active' ? a.rd : a.od) || 0) * HPD, target_drtn_hr_cnt: (a.od || (r && r.odCalc) || 0) * HPD,
        cstr_type: a.cstr && a.cstr.t ? CS[a.cstr.t] : '', cstr_date: a.cstr && a.cstr.d ? xerDate(U.dnOf(a.cstr.d), a.cstr.t && a.cstr.t[0] === 'F') : '',
        act_start_date: a.as ? xerDate(U.dnOf(a.as)) : '', act_end_date: a.af ? xerDate(U.dnOf(a.af), true) : '',
        early_start_date: xerDate(d.rs !== undefined && d.rs !== null ? d.rs : d.es), early_end_date: xerDate(d.ef, true), late_start_date: xerDate(d.ls), late_end_date: xerDate(d.lf, true),
        target_start_date: xerDate(d.es), target_end_date: xerDate(d.ef, true), restart_date: st === 'done' ? '' : xerDate(d.rs !== undefined && d.rs !== null ? d.rs : d.es), reend_date: st === 'done' ? '' : xerDate(d.ef, true),
        driving_path_flag: r && r.crit ? 'Y' : 'N'
      };
    });
    T('TASK', ['task_id', 'proj_id', 'wbs_id', 'clndr_id', 'phys_complete_pct', 'complete_pct_type', 'task_type', 'duration_type', 'status_code', 'task_code', 'task_name', 'total_float_hr_cnt', 'free_float_hr_cnt', 'remain_drtn_hr_cnt', 'target_drtn_hr_cnt', 'cstr_type', 'cstr_date', 'act_start_date', 'act_end_date', 'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date', 'target_start_date', 'target_end_date', 'restart_date', 'reend_date', 'driving_path_flag'], taskRows);
    T('TASKPRED', ['task_pred_id', 'task_id', 'pred_task_id', 'proj_id', 'pred_proj_id', 'pred_type', 'lag_hr_cnt'], (p.rels || []).map((r) => ({ task_pred_id: id('rel:' + r.id), task_id: id('t:' + r.succ), pred_task_id: id('t:' + r.pred), proj_id: PID, pred_proj_id: PID, pred_type: 'PR_' + r.type, lag_hr_cnt: (r.lag || 0) * HPD })));
    const asg = [];
    p.activities.forEach((a) => (a.assign || []).forEach((x) => { const r = M.Store ? M.Store.res(x.resId) : (db.resources || []).find((y) => y.id === x.resId); if (!r) return; const pr = Number(x.price !== undefined ? x.price : r.price) || 0; asg.push({ taskrsrc_id: id('as:' + x.id), task_id: id('t:' + a.id), proj_id: PID, rsrc_id: id('res:' + r.id), target_qty: x.bud, act_reg_qty: x.act, remain_qty: x.rem, target_qty_per_hr: U.round2((x.upd || 0) / HPD), remain_qty_per_hr: U.round2((x.upd || 0) / HPD), cost_per_qty: pr, target_cost: U.round2(x.bud * pr), act_reg_cost: U.round2(x.act * pr), remain_cost: U.round2(x.rem * pr) }); }));
    T('TASKRSRC', ['taskrsrc_id', 'task_id', 'proj_id', 'rsrc_id', 'target_qty', 'act_reg_qty', 'remain_qty', 'target_qty_per_hr', 'remain_qty_per_hr', 'cost_per_qty', 'target_cost', 'act_reg_cost', 'remain_cost'], asg);
    const costs = [];
    p.activities.forEach((a) => (a.costs || []).forEach((l) => { const amt = M.Costs.lineAmount(l); costs.push({ cost_item_id: id('c:' + l.id), proj_id: PID, task_id: id('t:' + a.id), cost_name: (l.desc || '').slice(0, 120), vendor_name: l.company || '', qty_name: l.um || '', target_qty: l.qty, cost_per_qty: l.unit, target_cost: U.round2(amt), act_cost: U.round2(Number(l.actual) || 0), remain_cost: U.round2(Math.max(0, amt - (Number(l.qtyDone) || 0) * (Number(l.unit) || 0))), cost_load_type: l.dist === 'start' ? 'CL_Start' : l.dist === 'end' ? 'CL_End' : 'CL_Uniform', cost_descr: [l.mat, l.kind, l.cbs].filter(Boolean).join(' - ') }); }));
    T('PROJCOST', ['cost_item_id', 'proj_id', 'task_id', 'cost_name', 'vendor_name', 'qty_name', 'target_qty', 'cost_per_qty', 'target_cost', 'act_cost', 'remain_cost', 'cost_load_type', 'cost_descr'], costs);
    const types = (db.codeTypes || []);
    T('ACTVTYPE', ['actv_code_type_id', 'actv_short_len', 'seq_num', 'actv_code_type', 'proj_id', 'actv_code_type_scope'], types.map((t, i) => ({ actv_code_type_id: id('ct:' + t.id), actv_short_len: 20, seq_num: i + 1, actv_code_type: t.name, proj_id: t.scope === 'project' ? PID : '', actv_code_type_scope: t.scope === 'project' ? 'AS_Project' : 'AS_Global' })));
    const codes = []; types.forEach((t) => t.values.forEach((v, i) => codes.push({ actv_code_id: id('cv:' + t.id + ':' + v.code), parent_actv_code_id: '', actv_code_type_id: id('ct:' + t.id), actv_code_name: v.desc, short_name: v.code, seq_num: i + 1 })));
    T('ACTVCODE', ['actv_code_id', 'parent_actv_code_id', 'actv_code_type_id', 'actv_code_name', 'short_name', 'seq_num'], codes);
    const ta = []; p.activities.forEach((a) => Object.entries(a.codes || {}).forEach(([t, v]) => { if (v && idm.has('cv:' + t + ':' + v)) ta.push({ task_id: id('t:' + a.id), actv_code_type_id: id('ct:' + t), actv_code_id: id('cv:' + t + ':' + v), proj_id: PID }); }));
    T('TASKACTV', ['task_id', 'actv_code_type_id', 'actv_code_id', 'proj_id'], ta);
    lines.push('%E');
    notes.push('Calendari: esportati come settimana tipo 08:00-12:00 e 13:00-17:00 più le eccezioni 2025-2030; i dettagli orari non sono rappresentati.');
    notes.push('Righe di costo: esportate come Expenses (PROJCOST) con fornitore, unità, quantità e prezzo; tipo di materiale, natura e conto finiscono nella descrizione.');
    notes.push('Tavole, note, foto, approvazioni da campo, step e UDF non sono esportati nel formato XER di Meridian.');
    notes.push('Tipo % "Quantità" (Meridian) esportato come Physical con la percentuale calcolata.');
    notes.push('Gli ID interni sono numerici e generati all\'export: un nuovo import in P6 crea un progetto nuovo, non aggiorna quello esistente.');
    return { blob: new Blob([lines.join('\r\n')], { type: 'text/plain' }), name: p.code + '.xer', notes };
  }

  /* ---------- import XER ---------- */
  function parseXer(text) {
    const tables = {}; let cur = null, fields = null;
    text.split(/\r?\n/).forEach((ln) => {
      if (ln.startsWith('%T')) { cur = ln.split('\t')[1]; tables[cur] = []; fields = null; }
      else if (ln.startsWith('%F')) fields = ln.split('\t').slice(1);
      else if (ln.startsWith('%R') && cur && fields) { const v = ln.split('\t').slice(1); const o = {}; fields.forEach((f, i) => { o[f] = v[i] === undefined ? '' : v[i]; }); tables[cur].push(o); }
    });
    if (!tables.PROJECT || !tables.TASK) throw new Error('Il file non contiene le tabelle PROJECT e TASK: non sembra un XER valido.');
    return tables;
  }
  const xd = (s) => { if (!s) return null; const m = /^(\d{4}-\d{2}-\d{2})/.exec(s); return m ? m[1] : null; };

  function calFromXer(c) {
    const week = [0, 0, 0, 0, 0, 0, 0];
    const data = c.clndr_data || '';
    const i0 = data.indexOf('DaysOfWeek()(');
    const iv = data.indexOf('(0||VIEW'), ie = data.indexOf('Exceptions()(');
    const i1 = [iv, ie, data.length].filter((x) => x > i0).reduce((m, x) => Math.min(m, x), data.length);
    const block = i0 >= 0 ? data.slice(i0, i1) : '';
    for (let d = 1; d <= 7; d++) {
      const st = block.indexOf('(0||' + d + '()(');
      let h = 0;
      if (st >= 0) {
        let en = block.length;
        for (let k = d + 1; k <= 7; k++) { const x = block.indexOf('(0||' + k + '()(', st + 1); if (x > 0) { en = x; break; } }
        const seg = block.slice(st, en);
        (seg.match(/s\|(\d\d):(\d\d)\|f\|(\d\d):(\d\d)/g) || []).forEach((t) => { const x = /s\|(\d\d):(\d\d)\|f\|(\d\d):(\d\d)/.exec(t); const a = +x[1] + x[2] / 60; let b = +x[3] + x[4] / 60; if (b <= a) b += 24; h += b - a; });
      }
      week[(d + 5) % 7] = Math.round(h * 100) / 100;
    }
    if (!week.some((h) => h > 0)) { week[0] = week[1] = week[2] = week[3] = week[4] = Number(c.day_hr_cnt) || 8; }
    const hol = [];
    const exc = /Exceptions\(\)\((.*)$/.exec(data);
    if (exc) { const re = /\(0\|\|\d+\(d\|(\d+)\)\((.*?)\)\)/g; let m; while ((m = re.exec(exc[1]))) { if (!/s\|/.test(m[2])) hol.push(U.isoOf(Number(m[1]) - 25569)); } }
    return { name: c.clndr_name || 'Calendario importato', week, hoursDay: Number(c.day_hr_cnt) || 8, holidays: hol, recurring: [], workdays: [] };
  }

  /* trasforma un XER in un progetto Meridian (il primo progetto del file o quello scelto) */
  function xerToProject(tables, projIdx) {
    const P = tables.PROJECT[projIdx || 0];
    const pid = P.proj_id;
    const report = [];
    const cals = {};
    (tables.CALENDAR || []).forEach((c) => { cals[c.clndr_id] = Object.assign(calFromXer(c), { id: U.uid('cal'), xid: c.clndr_id, type: c.clndr_type === 'CA_Rsrc' ? 'resource' : c.clndr_type === 'CA_Project' ? 'project' : 'global' }); });
    const hpdOf = (cid) => (cals[cid] && cals[cid].hoursDay) || 8;
    const wbsRows = (tables.PROJWBS || []).filter((w) => w.proj_id === pid);
    const wbs = wbsRows.map((w) => ({ id: 'W' + w.wbs_id, code: w.proj_node_flag === 'Y' ? (P.proj_short_name || 'PRJ') : w.wbs_short_name, name: w.proj_node_flag === 'Y' ? (P.proj_short_name || '') : w.wbs_name, parent: w.parent_wbs_id && wbsRows.some((x) => x.wbs_id === w.parent_wbs_id) ? 'W' + w.parent_wbs_id : null, seq: Number(w.seq_num) || 0 }));
    if (!wbs.length) wbs.push({ id: 'W0', code: P.proj_short_name || 'PRJ', name: 'Progetto', parent: null });
    const rootW = wbs.find((w) => !w.parent) || wbs[0];
    const tasks = tables.TASK.filter((t) => t.proj_id === pid);
    const codeById = {};
    const acts = tasks.map((t) => {
      const hpd = hpdOf(t.clndr_id);
      const type = TT_R[t.task_type] || 'task';
      const a = { id: t.task_code || 'T' + t.task_id, code: t.task_code || 'T' + t.task_id, name: t.task_name || '', wbsId: wbs.some((w) => w.id === 'W' + t.wbs_id) ? 'W' + t.wbs_id : rootW.id, type, calId: cals[t.clndr_id] ? cals[t.clndr_id].id : undefined, od: Math.round((Number(t.target_drtn_hr_cnt) || 0) / hpd), pct: Number(t.phys_complete_pct) || 0, pctType: CP_R[t.complete_pct_type] || 'phys', durType: DT_R[t.duration_type] || 'FDU', assign: [], costs: [], steps: [], codes: {}, udf: {}, drawings: [], notes: [] };
      if (M.CPM.isMile(a)) a.od = 0;
      const as = xd(t.act_start_date), af = xd(t.act_end_date);
      if (as) a.as = as; if (af) a.af = af;
      if (as && !af) a.rd = Math.round((Number(t.remain_drtn_hr_cnt) || 0) / hpd);
      if (t.cstr_type && CS_R[t.cstr_type]) a.cstr = { t: CS_R[t.cstr_type], d: xd(t.cstr_date) || '' };
      codeById[t.task_id] = a.id;
      return a;
    });
    const seen = new Set(); acts.forEach((a) => { let c = a.id, n = 1; while (seen.has(c)) c = a.code + '_' + (++n); if (c !== a.id) { report.push('ID duplicato ' + a.code + ' rinominato in ' + c + '.'); a.id = c; a.code = c; } seen.add(c); });
    const rels = (tables.TASKPRED || []).filter((r) => codeById[r.task_id] && codeById[r.pred_task_id]).map((r) => ({ id: U.uid('r'), pred: codeById[r.pred_task_id], succ: codeById[r.task_id], type: (r.pred_type || 'PR_FS').replace('PR_', ''), lag: Math.round((Number(r.lag_hr_cnt) || 0) / 8) }));
    const ext = (tables.TASKPRED || []).filter((r) => codeById[r.task_id] && !codeById[r.pred_task_id]).length;
    if (ext) report.push(ext + ' legami verso altri progetti non importati.');
    const rsrc = {}; (tables.RSRC || []).forEach((r) => { rsrc[r.rsrc_id] = r; });
    const rates = {}; (tables.RSRCRATE || []).forEach((r) => { rates[r.rsrc_id] = r; });
    const resources = [];
    (tables.TASKRSRC || []).filter((x) => codeById[x.task_id]).forEach((x) => {
      const r = rsrc[x.rsrc_id]; if (!r) return;
      let res = resources.find((y) => y.xid === x.rsrc_id);
      if (!res) { res = { id: U.uid('r'), xid: x.rsrc_id, code: r.rsrc_short_name, name: r.rsrc_name, type: RT_R[r.rsrc_type] || 'Labor', unit: r.rsrc_type === 'RT_Mat' ? 'u' : 'h', price: Number((rates[x.rsrc_id] || {}).cost_per_qty) || Number(x.cost_per_qty) || 0, defUpd: (Number(r.def_qty_per_hr) || 1) * 8, maxUpd: (Number((rates[x.rsrc_id] || {}).max_qty_per_hr) || 1) * 8, calId: '' }; resources.push(res); }
      const a = acts.find((y) => y.id === codeById[x.task_id]);
      a.assign.push({ id: U.uid('as'), resId: res.id, upd: U.round2((Number(x.target_qty_per_hr) || 0) * 8), bud: Number(x.target_qty) || 0, act: (Number(x.act_reg_qty) || 0) + (Number(x.act_ot_qty) || 0), rem: Number(x.remain_qty) || 0, curve: 'uniform' });
    });
    (tables.PROJCOST || []).filter((c) => codeById[c.task_id]).forEach((c) => {
      const a = acts.find((y) => y.id === codeById[c.task_id]);
      const qty = Number(c.target_qty) || 1, unit = Number(c.cost_per_qty) || (Number(c.target_cost) || 0) / qty;
      a.costs.push({ id: U.uid('c'), company: c.vendor_name || '', desc: c.cost_name || '', mat: '', um: c.qty_name || 'a corpo', qty, unit: U.round2(unit), qtyDone: 0, actual: Number(c.act_cost) || 0, dist: c.cost_load_type === 'CL_Start' ? 'start' : c.cost_load_type === 'CL_End' ? 'end' : 'linear', kind: 'Spesa', cbs: '' });
    });
    const types = {}; (tables.ACTVTYPE || []).forEach((t) => { types[t.actv_code_type_id] = t; });
    const cvals = {}; (tables.ACTVCODE || []).forEach((v) => { cvals[v.actv_code_id] = v; });
    const codeTypes = {};
    (tables.TASKACTV || []).filter((x) => codeById[x.task_id]).forEach((x) => {
      const t = types[x.actv_code_type_id], v = cvals[x.actv_code_id]; if (!t || !v) return;
      const key = U.slug(t.actv_code_type).toUpperCase().slice(0, 12) || 'COD';
      if (!codeTypes[key]) codeTypes[key] = { id: key, name: t.actv_code_type, scope: 'project', values: [] };
      if (!codeTypes[key].values.some((y) => y.code === v.short_name)) codeTypes[key].values.push({ code: v.short_name, desc: v.actv_code_name });
      acts.find((y) => y.id === codeById[x.task_id]).codes[key] = v.short_name;
    });
    const unmapped = Object.keys(tables).filter((k) => !['PROJECT', 'CALENDAR', 'PROJWBS', 'TASK', 'TASKPRED', 'RSRC', 'RSRCRATE', 'TASKRSRC', 'PROJCOST', 'ACTVTYPE', 'ACTVCODE', 'TASKACTV'].includes(k) && tables[k].length);
    if (unmapped.length) report.push('Tabelle non importate: ' + unmapped.join(', ') + '.');
    const projCal = cals[P.clndr_id] || Object.values(cals)[0];
    return {
      project: { code: P.proj_short_name || 'IMPORT', name: P.proj_short_name || 'Progetto importato', plannedStart: xd(P.plan_start_date) || xd(P.last_recalc_date) || U.isoOf(U.todayDn()), mustFinish: xd(P.plan_end_date) || '', dataDate: (function () { const d = xd(P.last_recalc_date || P.next_data_date); return d ? U.isoOf(U.dnOf(d) - 1) : U.isoOf(U.todayDn()); })(), wbs, activities: acts, rels, calXid: projCal ? projCal.xid : null },
      calendars: Object.values(cals), resources, codeTypes: Object.values(codeTypes), report, counts: { attività: acts.length, legami: rels.length, wbs: wbs.length, assegnazioni: U.sum(acts, (a) => a.assign.length), costi: U.sum(acts, (a) => a.costs.length) }
    };
  }

  /* ---------- export XML di P6 (PMXML semplificato) ---------- */
  function toP6Xml(p, db) {
    const S = p.sched || {};
    const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V19.12/API/BusinessObjects">'];
    db.calendars.forEach((c, i) => { out.push('<Calendar><ObjectId>' + (9000 + i) + '</ObjectId><Name>' + xe(c.name) + '</Name><Type>Global</Type><HoursPerDay>' + (c.hoursDay || 8) + '</HoursPerDay><HoursPerWeek>' + U.sum(c.week || []) + '</HoursPerWeek></Calendar>'); });
    const calObj = (id) => 9000 + Math.max(0, db.calendars.findIndex((c) => c.id === id));
    out.push('<Project><ObjectId>1</ObjectId><Id>' + xe(p.code) + '</Id><Name>' + xe(p.name) + '</Name><PlannedStartDate>' + isoT(U.dnOf(p.plannedStart)) + '</PlannedStartDate>' + (p.mustFinish ? '<MustFinishByDate>' + isoT(U.dnOf(p.mustFinish), true) + '</MustFinishByDate>' : '') + '<DataDate>' + isoT(U.dnOf(p.dataDate) + 1) + '</DataDate><ActivityDefaultCalendarObjectId>' + calObj(p.calId) + '</ActivityDefaultCalendarObjectId>');
    const wid = new Map((p.wbs || []).map((w, i) => [w.id, 100 + i]));
    const root = (p.wbs || []).find((w) => !w.parent);
    (p.wbs || []).filter((w) => w !== root).forEach((w) => out.push('<WBS><ObjectId>' + wid.get(w.id) + '</ObjectId><Code>' + xe(w.code) + '</Code><Name>' + xe(w.name) + '</Name><ParentObjectId>' + (w.parent && w.parent !== root.id ? wid.get(w.parent) : '') + '</ParentObjectId><ProjectObjectId>1</ProjectObjectId></WBS>'));
    const aid = new Map(p.activities.map((a, i) => [a.id, 1000 + i]));
    const TYPE = { task: 'Task Dependent', rsrc: 'Resource Dependent', start: 'Start Milestone', finish: 'Finish Milestone', loe: 'Level of Effort', wbs: 'WBS Summary' };
    p.activities.forEach((a) => {
      const d = scheduleDates(p, a);
      out.push('<Activity><ObjectId>' + aid.get(a.id) + '</ObjectId><Id>' + xe(a.code) + '</Id><Name>' + xe(a.name) + '</Name><Type>' + TYPE[a.type] + '</Type><WBSObjectId>' + (a.wbsId === (root && root.id) ? '' : wid.get(a.wbsId) || '') + '</WBSObjectId><CalendarObjectId>' + calObj(a.calId || p.calId) + '</CalendarObjectId><PlannedDuration>' + (a.od || 0) * 8 + '</PlannedDuration><RemainingDuration>' + (a.af ? 0 : (a.as ? a.rd : a.od) || 0) * 8 + '</RemainingDuration><PhysicalPercentComplete>' + (a.af ? 100 : Number(a.pct) || 0) + '</PhysicalPercentComplete>' + (a.as ? '<ActualStartDate>' + isoT(U.dnOf(a.as)) + '</ActualStartDate>' : '') + (a.af ? '<ActualFinishDate>' + isoT(U.dnOf(a.af), true) + '</ActualFinishDate>' : '') + '<StartDate>' + isoT(a.as ? U.dnOf(a.as) : d.es) + '</StartDate><FinishDate>' + isoT(a.af ? U.dnOf(a.af) : d.ef, true) + '</FinishDate>' + (a.cstr && a.cstr.t ? '<PrimaryConstraintType>' + xe(M.CPM.CSTR[a.cstr.t]) + '</PrimaryConstraintType><PrimaryConstraintDate>' + isoT(U.dnOf(a.cstr.d)) + '</PrimaryConstraintDate>' : '') + '<ProjectObjectId>1</ProjectObjectId></Activity>');
    });
    const RT2 = { FS: 'Finish to Start', SS: 'Start to Start', FF: 'Finish to Finish', SF: 'Start to Finish' };
    (p.rels || []).forEach((r, i) => out.push('<Relationship><ObjectId>' + (5000 + i) + '</ObjectId><PredecessorActivityObjectId>' + aid.get(r.pred) + '</PredecessorActivityObjectId><SuccessorActivityObjectId>' + aid.get(r.succ) + '</SuccessorActivityObjectId><Type>' + RT2[r.type] + '</Type><Lag>' + (r.lag || 0) * 8 + '</Lag></Relationship>'));
    out.push('</Project></APIBusinessObjects>');
    void S;
    return { blob: new Blob([out.join('\n')], { type: 'application/xml' }), name: p.code + '_P6.xml', notes: ['XML di P6 semplificato: progetto, WBS, attività, legami e calendari (solo ore). Risorse, costi, codici e UDF non sono inclusi.', 'Le date sono quelle dell\'ultima schedulazione; P6 le ricalcola alla prima F9.'] };
  }

  /* ---------- MS Project XML (MSPDI) ---------- */
  const dur = (days) => 'PT' + Math.round((days || 0) * 8) + 'H0M0S';
  function toMspXml(p, db) {
    const S = p.sched || {};
    const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '<Project xmlns="http://schemas.microsoft.com/project">', '<Name>' + xe(p.code) + '</Name><Title>' + xe(p.name) + '</Title><ScheduleFromStart>1</ScheduleFromStart><StartDate>' + isoT(U.dnOf(p.plannedStart)) + '</StartDate>' + (S.finishDay ? '<FinishDate>' + isoT(S.finishDay, true) + '</FinishDate>' : '') + '<StatusDate>' + isoT(U.dnOf(p.dataDate), true) + '</StatusDate><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth><CalendarUID>1</CalendarUID><DurationFormat>7</DurationFormat>'];
    out.push('<Calendars>');
    db.calendars.forEach((c, i) => {
      out.push('<Calendar><UID>' + (i + 1) + '</UID><Name>' + xe(c.name) + '</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>');
      for (let d = 1; d <= 7; d++) { const h = (c.week || [])[(d + 5) % 7] || 0; out.push('<WeekDay><DayType>' + d + '</DayType><DayWorking>' + (h ? 1 : 0) + '</DayWorking>' + (h ? '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>' + String(13 + Math.max(0, Math.min(11, h - 4))).padStart(2, '0') + ':00:00</ToTime></WorkingTime></WorkingTimes>' : '') + '</WeekDay>'); }
      out.push('</WeekDays><Exceptions>');
      const from = U.dnYmd(2025, 0, 1), to = U.dnYmd(2030, 11, 31);
      for (let d = from; d <= to; d++) if (((c.week || [])[U.weekday(d)] || 0) > 0 && !Cal.isWork(c, d)) out.push('<Exception><EnteredByOccurrences>0</EnteredByOccurrences><TimePeriod><FromDate>' + U.isoOf(d) + 'T00:00:00</FromDate><ToDate>' + U.isoOf(d) + 'T23:59:00</ToDate></TimePeriod><Occurrences>1</Occurrences><Type>1</Type><DayWorking>0</DayWorking></Exception>');
      out.push('</Exceptions></Calendar>');
    });
    out.push('</Calendars><Tasks>');
    let uid = 0;
    const uidOf = new Map();
    const kids = new Map(); (p.wbs || []).forEach((w) => { const k = w.parent || '__'; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(w); });
    const actsBy = U.groupBy(p.activities, (a) => a.wbsId);
    const CT = { SNET: 4, SNLT: 5, FNET: 6, FNLT: 7, MSO: 2, MFO: 3, SO: 2, FO: 3, ALAP: 1 };
    const walk = (w, lvl) => {
      uid++; out.push('<Task><UID>' + uid + '</UID><ID>' + uid + '</ID><Name>' + xe(w.code + ' ' + w.name) + '</Name><WBS>' + xe(w.code) + '</WBS><OutlineLevel>' + lvl + '</OutlineLevel><Summary>1</Summary><Type>1</Type></Task>');
      (actsBy.get(w.id) || []).forEach((a) => {
        uid++; uidOf.set(a.id, uid);
        const d = scheduleDates(p, a);
        const od = a.type === 'loe' ? ((S.acts && S.acts[a.id] && S.acts[a.id].odCalc) || 0) : a.od || 0;
        const rem = a.af ? 0 : a.as ? a.rd || 0 : od;
        const milestone = M.CPM.isMile(a);
        const start = a.as ? U.dnOf(a.as) : d.es, finish = a.af ? U.dnOf(a.af) : d.ef;
        const preds = (p.rels || []).filter((r) => r.succ === a.id).map((r) => '<PredecessorLink><PredecessorUID>' + '{{' + r.pred + '}}' + '</PredecessorUID><Type>' + { FF: 0, FS: 1, SF: 2, SS: 3 }[r.type] + '</Type><LinkLag>' + (r.lag || 0) * 4800 + '</LinkLag><LagFormat>7</LagFormat></PredecessorLink>').join('');
        out.push('<Task><UID>' + uid + '</UID><ID>' + uid + '</ID><Name>' + xe(a.name) + '</Name><Text1>' + xe(a.code) + '</Text1><OutlineLevel>' + (lvl + 1) + '</OutlineLevel><Summary>0</Summary><Milestone>' + (milestone ? 1 : 0) + '</Milestone><Type>1</Type>' + (start !== undefined && start !== null ? '<Start>' + isoT(start) + '</Start>' : '') + (finish !== undefined && finish !== null ? '<Finish>' + isoT(milestone && a.type === 'start' ? start : finish, !(milestone && a.type === 'start')) + '</Finish>' : '') + '<Duration>' + dur(milestone ? 0 : od) + '</Duration><RemainingDuration>' + dur(milestone ? 0 : rem) + '</RemainingDuration><PercentComplete>' + Math.round(a.af ? 100 : M.Costs.actPct(a, S.acts && S.acts[a.id], db)) + '</PercentComplete>' + (a.as ? '<ActualStart>' + isoT(U.dnOf(a.as)) + '</ActualStart>' : '') + (a.af ? '<ActualFinish>' + isoT(U.dnOf(a.af), true) + '</ActualFinish>' : '') + '<ConstraintType>' + (a.cstr && a.cstr.t ? CT[a.cstr.t] : 0) + '</ConstraintType>' + (a.cstr && a.cstr.d ? '<ConstraintDate>' + isoT(U.dnOf(a.cstr.d)) + '</ConstraintDate>' : '') + '<CalendarUID>' + (Math.max(0, db.calendars.findIndex((c) => c.id === (a.calId || p.calId))) + 1) + '</CalendarUID>' + preds + '</Task>');
      });
      (kids.get(w.id) || []).forEach((c) => walk(c, lvl + 1));
    };
    (kids.get('__') || []).forEach((w) => walk(w, 1));
    out.push('</Tasks></Project>');
    const xml = out.join('\n').replace(/\{\{([^}]+)\}\}/g, (m, id) => String(uidOf.get(id) || 0));
    return { blob: new Blob([xml], { type: 'application/xml' }), name: p.code + '_MSProject.xml', notes: ['Formato XML di MS Project (MSPDI). Il formato .mpp è proprietario e non è supportato.', 'I nodi WBS diventano attività di riepilogo; l\'ID attività di Meridian va nel campo Testo1.', 'LOE e WBS Summary diventano attività normali con la durata calcolata; vincoli Start On e Finish On diventano Mandatory.', 'Risorse, costi, codici e baseline non sono inclusi.'] };
  }

  function parseMsp(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML non valido.');
    const g = (el, tag) => { const x = el.getElementsByTagName(tag)[0]; return x ? x.textContent : ''; };
    const projName = g(doc.documentElement, 'Name') || 'Progetto MSP';
    const tasks = Array.from(doc.getElementsByTagName('Task'));
    const wbs = [{ id: 'W0', code: projName.slice(0, 12), name: projName, parent: null }];
    const stack = [{ lvl: 0, id: 'W0' }];
    const acts = [], rels = [], uidMap = {}, report = [];
    const durDays = (s) => { const m = /PT(\d+(?:\.\d+)?)H(\d+)M/.exec(s || ''); return m ? Math.round((+m[1] + +m[2] / 60) / 8) : 0; };
    const CTR = { 1: 'ALAP', 2: 'MSO', 3: 'MFO', 4: 'SNET', 5: 'SNLT', 6: 'FNET', 7: 'FNLT' };
    tasks.forEach((t) => {
      const lvl = Number(g(t, 'OutlineLevel')) || 0; if (lvl === 0) return;
      const uid = g(t, 'UID');
      while (stack.length > 1 && stack[stack.length - 1].lvl >= lvl) stack.pop();
      if (g(t, 'Summary') === '1') { const id = 'W' + uid; wbs.push({ id, code: (g(t, 'WBS') || uid).slice(0, 20), name: g(t, 'Name'), parent: stack[stack.length - 1].id }); stack.push({ lvl, id }); return; }
      const code = g(t, 'Text1') || ('T' + (g(t, 'ID') || uid));
      const ms = g(t, 'Milestone') === '1';
      const a = { id: code, code, name: g(t, 'Name'), wbsId: stack[stack.length - 1].id, type: ms ? 'finish' : 'task', od: ms ? 0 : durDays(g(t, 'Duration')), pct: Number(g(t, 'PercentComplete')) || 0, pctType: 'dur', durType: 'FDU', assign: [], costs: [], steps: [], codes: {}, udf: {}, drawings: [], notes: [] };
      const as = (g(t, 'ActualStart') || '').slice(0, 10), af = (g(t, 'ActualFinish') || '').slice(0, 10);
      if (as) a.as = as; if (af) a.af = af; if (as && !af) a.rd = durDays(g(t, 'RemainingDuration'));
      const ct = CTR[g(t, 'ConstraintType')]; if (ct) a.cstr = { t: ct, d: (g(t, 'ConstraintDate') || '').slice(0, 10) };
      uidMap[uid] = a.id; acts.push(a);
      Array.from(t.getElementsByTagName('PredecessorLink')).forEach((l) => rels.push({ pu: g(l, 'PredecessorUID'), succ: a.id, type: ({ 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' })[g(l, 'Type')] || 'FS', lag: Math.round((Number(g(l, 'LinkLag')) || 0) / 4800) }));
    });
    const R = rels.filter((r) => uidMap[r.pu]).map((r) => ({ id: U.uid('r'), pred: uidMap[r.pu], succ: r.succ, type: r.type, lag: r.lag }));
    if (R.length < rels.length) report.push((rels.length - R.length) + ' legami verso attività di riepilogo o esterne non importati.');
    acts.forEach((a) => { if (a.type === 'finish' && !R.some((r) => r.succ === a.id)) a.type = 'start'; });
    const start = (g(doc.documentElement, 'StartDate') || '').slice(0, 10) || U.isoOf(U.todayDn());
    const status = (g(doc.documentElement, 'StatusDate') || '').slice(0, 10);
    return { project: { code: projName.slice(0, 20), name: projName, plannedStart: start, mustFinish: '', dataDate: status || U.isoOf(U.dnOf(start) - 1), wbs, activities: acts, rels: R }, calendars: [], resources: [], codeTypes: [], report, counts: { attività: acts.length, legami: R.length, wbs: wbs.length } };
  }

  M.Exchange = { toXer, parseXer, xerToProject, toP6Xml, toMspXml, parseMsp };
})(window.M = window.M || {});
