/* Meridian - stato dell'applicazione, persistenza locale, anteprima, versioni, permessi */
(function (M) {
  'use strict';
  const U = M.U;
  const KEY = 'meridian.db.v1', UIKEY = 'meridian.ui.v1', PVKEY = 'meridian.preview.v1', OUTBOX = 'meridian.outbox.v1';

  const ROLES = {
    admin: { name: 'Amministratore', caps: ['schedule', 'structure', 'cost', 'progress', 'approve', 'baseline', 'exchange', 'admin'] },
    planner: { name: 'Pianificatore', caps: ['schedule', 'structure', 'cost', 'progress', 'approve', 'baseline', 'exchange'] },
    controller: { name: 'Controllo costi', caps: ['cost', 'baseline', 'exchange'] },
    field: { name: 'Capocantiere (campo)', caps: ['progress'] },
    viewer: { name: 'Sola lettura', caps: [] }
  };

  const Store = {
    db: null, preview: null, undo: [], redo: [], listeners: [], conflict: null, phone: false,
    ui: { route: 'portafoglio', sel: null, layout: 'ly1', filter: 'all', group: 'wbs', search: '', ganttZoom: 'month', showBL: true, showLinks: false, showProgLine: false, view: 'gantt', detailTab: 'Generale', cols: null, collapsed: {}, trace: { on: false, near: 0, depth: 6, hide: false, toward: '' }, net: { scope: 'crit', depth: 3, zoom: 1, group: false, collapsed: {} }, struttTab: 'wbs', risSel: 'r_carp', costTab: 'sintesi', ctrlA: 'pA_bl', ctrlB: 'pA', ctrlWbs: '', advTab: 'inserimento', scambioTab: 'export', adminTab: 'utenti', sortCol: null, sortDir: 1, guideSeen: false },

    init() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { /* storage non disponibile */ }
      if (raw) { try { this.db = JSON.parse(raw); } catch (e) { this.db = null; } }
      if (!this.db || !this.db.projects) { this.db = M.Demo.build(); this.save(); }
      try { const u = JSON.parse(localStorage.getItem(UIKEY) || 'null'); if (u) this.ui = Object.assign(this.ui, u, { trace: Object.assign({}, this.ui.trace, u.trace || {}), net: Object.assign({}, this.ui.net, u.net || {}) }); } catch (e) { /* */ }
      try { const pv = JSON.parse(sessionStorage.getItem(PVKEY) || 'null'); if (pv && this.db.projects.some((p) => p.id === pv.projectId)) this.preview = pv; } catch (e) { /* */ }
      if (!this.db.projects.some((p) => p.id === this.db.activeProject)) this.db.activeProject = (this.db.projects.find((p) => p.status === 'CURR') || this.db.projects[0]).id;
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (ev) => {
          if (ev.key !== KEY || !ev.newValue) return;
          try {
            const fresh = JSON.parse(ev.newValue);
            if (this.preview) {
              const fp = fresh.projects.find((p) => p.id === this.preview.projectId);
              if (fp && fp.version !== this.preview.baseVersion) this.conflict = { version: fp.version, by: (fp.versions[fp.versions.length - 1] || {}).by, at: (fp.versions[fp.versions.length - 1] || {}).at };
            }
            this.db = fresh;
            this.emit('remote');
          } catch (e) { /* */ }
        });
      }
    },
    save() {
      try { this.db.meta.savedAt = U.nowStamp(); localStorage.setItem(KEY, JSON.stringify(this.db)); return true; }
      catch (e) { if (M.UI) M.UI.toast('Salvataggio locale non riuscito: spazio del browser esaurito o non disponibile. Esporta un backup da Amministrazione.', 'bad'); return false; }
    },
    saveUi() { try { localStorage.setItem(UIKEY, JSON.stringify(this.ui)); } catch (e) { /* */ } },
    on(f) { this.listeners.push(f); },
    emit(why) { this.listeners.forEach((f) => f(why)); },
    reset() { this.db = M.Demo.build(); this.preview = null; this.undo = []; try { sessionStorage.removeItem(PVKEY); } catch (e) { /* */ } this.save(); },

    /* accesso */
    S() { return this.db.settings; },
    user() { return this.db.users.find((u) => u.id === this.db.currentUser) || this.db.users[0]; },
    role() { return ROLES[this.user().role] || ROLES.viewer; },
    can(cap, p) {
      if (this.phone) return false;
      if (!this.role().caps.includes(cap)) return false;
      p = p || this.confirmed();
      if (p && p.status === 'BASE' && cap !== 'baseline' && cap !== 'admin') return false;
      return true;
    },
    obsAllows(p) {
      const u = this.user();
      if (u.role === 'admin') return true;
      if (!p.obsId) return true;
      let cur = this.db.obs.find((o) => o.id === p.obsId);
      while (cur) { if (cur.id === u.obs) return true; cur = this.db.obs.find((o) => o.id === cur.parent); }
      return false;
    },
    projects(filter) { return this.db.projects.filter((p) => this.obsAllows(p) && (!filter || filter(p))); },
    proj(id) { return this.db.projects.find((p) => p.id === id); },
    confirmed() { return this.proj(this.db.activeProject); },
    /* progetto di lavoro: la copia in anteprima se attiva */
    P() { const c = this.confirmed(); if (this.preview && this.preview.projectId === c.id) return this.preview.work; return c; },
    inPreview() { return !!(this.preview && this.preview.projectId === this.db.activeProject); },
    baseline(p, role) { p = p || this.P(); const id = p.baselines && p.baselines[role || 'project']; return id ? this.proj(id) : null; },
    cal(id) { return this.db.calendars.find((c) => c.id === id); },
    res(id) { return this.db.resources.find((r) => r.id === id); },
    schedOpt() { const s = this.S(); return { criticalMode: s.criticalMode, tfThreshold: Number(s.tfThreshold) || 0, subOn: !!s.subOn, subThreshold: Number(s.subThreshold) || 0, lagCal: s.lagCal, oos: s.oos }; },
    setActive(id) {
      if (this.preview && this.preview.projectId !== id) { this.emit('preview-block'); return false; }
      this.db.activeProject = id; this.save(); this.ui.sel = null; this.saveUi(); this.emit('project'); return true;
    },

    /* schedulazione */
    schedule(p) { p.sched = M.CPM.schedule(p, this.db, this.schedOpt()); if (p.sched.ok) { p.sched.ranBy = this.user().name; } return p.sched; },
    f9(note) {
      const p = this.confirmed();
      if (this.inPreview()) return this.confirmPreview(note);
      const prev = p.sched;
      const r = this.schedule(p);
      if (!r.ok) { this.save(); this.emit('sched'); return { ok: false, sched: r }; }
      p.dirty = false;
      p.version = (p.version || 0) + 1;
      p.versions = p.versions || [];
      p.versions.push({ n: p.version, at: U.nowStamp(), by: this.user().name, note: note || 'Schedulazione F9', finish: U.isoOf(r.finishDay), snap: M.Demo.snapOf(p) });
      if (p.versions.length > 60) p.versions.splice(1, p.versions.length - 60);
      this.save();
      this.emit('sched');
      return { ok: true, sched: r, prev };
    },

    /* modifiche: manuale (dato salvato, badge Da ricalcolare) o anteprima (ricalcolo immediato) */
    mutate(fn, o) {
      o = o || {};
      const cap = o.cap || 'schedule';
      const c = this.confirmed();
      if (!this.can(cap, c)) { if (M.UI) M.UI.toast('Il tuo ruolo non permette questa modifica.', 'warn'); return false; }
      const affects = o.affects !== false;
      const wantPreview = affects && (this.inPreview() || o.preview || this.S().recalcMode === 'preview');
      if (wantPreview) {
        if (!this.inPreview()) this.startPreview();
        const w = this.preview.work;
        fn(w);
        this.schedule(w);
        this.preview.changes = (this.preview.changes || 0) + 1;
        this.persistPreview();
        this.emit('change');
        return true;
      }
      this.undo.push(JSON.stringify(c)); if (this.undo.length > 40) this.undo.shift(); this.redo = [];
      fn(c);
      if (affects) c.dirty = true;
      this.save();
      this.emit('change');
      return true;
    },
    undoLast() {
      if (this.inPreview()) { this.cancelPreview(); return; }
      const s = this.undo.pop(); if (!s) { if (M.UI) M.UI.toast('Niente da annullare.', 'info'); return; }
      const c = this.confirmed(); this.redo.push(JSON.stringify(c));
      const p = JSON.parse(s); const i = this.db.projects.findIndex((x) => x.id === p.id); this.db.projects[i] = p;
      this.save(); this.emit('change'); if (M.UI) M.UI.toast('Modifica annullata.', 'info');
    },
    startPreview() {
      const c = this.confirmed();
      this.preview = { projectId: c.id, baseVersion: c.version || 0, startedAt: U.nowStamp(), work: U.clone(c), changes: 0 };
      this.conflict = null;
      this.persistPreview();
    },
    persistPreview() { try { sessionStorage.setItem(PVKEY, JSON.stringify(this.preview)); } catch (e) { /* */ } },
    cancelPreview() { this.preview = null; this.conflict = null; try { sessionStorage.removeItem(PVKEY); } catch (e) { /* */ } this.emit('preview-end'); },
    /* differenze tra anteprima e ultimo schedule confermato */
    previewDiff() {
      if (!this.inPreview()) return null;
      const c = this.confirmed(), w = this.preview.work;
      const a = c.sched && c.sched.acts ? c.sched : null, b = w.sched;
      if (!b || !b.ok) return { error: true, log: b ? b.log : [] };
      const pc = this.cal(w.calId) || M.CPM.DEFAULT_CAL;
      const moved = [];
      w.activities.forEach((x) => {
        const r1 = a && a.acts[x.id], r2 = b.acts[x.id];
        if (!r2) return;
        if (!r1) { moved.push({ act: x, ds: null, df: null, isNew: true }); return; }
        const ds = M.Cal.between(pc, r1.es, r2.es), df = M.Cal.between(pc, r1.ef, r2.ef);
        if (ds || df || !!r1.crit !== !!r2.crit) moved.push({ act: x, ds, df, critFrom: !!r1.crit, critTo: !!r2.crit, r1, r2 });
      });
      const removed = a ? Object.keys(a.acts).filter((id) => !b.acts[id]) : [];
      const dFinish = a ? M.Cal.between(pc, a.finish, b.finish) : 0;
      const cp = (s) => (s && s.paths ? s.paths.map((x) => x.members.join(',')).join('|') : '');
      return { moved, removed, dFinish, finishFrom: a ? a.finishDay : null, finishTo: b.finishDay, critChanged: cp(a) !== cp(b), pathsFrom: a ? a.paths.length : 0, pathsTo: b.paths.length, changes: this.preview.changes };
    },
    /* conferma: tutto o niente, con controllo dei conflitti */
    confirmPreview(note, force) {
      if (!this.inPreview()) return { ok: false };
      let fresh = null;
      try { fresh = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* */ }
      const fp = fresh && fresh.projects.find((p) => p.id === this.preview.projectId);
      if (!force && fp && (fp.version || 0) !== this.preview.baseVersion) {
        const last = (fp.versions || [])[fp.versions.length - 1] || {};
        this.conflict = { version: fp.version, by: last.by, at: last.at };
        return { ok: false, conflict: this.conflict };
      }
      if (fresh) this.db = fresh;
      const w = this.preview.work;
      if (!w.sched || !w.sched.ok) return { ok: false, error: true };
      w.dirty = false;
      w.version = Math.max(this.preview.baseVersion, fp ? fp.version || 0 : 0) + 1;
      w.versions = (fp ? fp.versions : w.versions) || [];
      w.versions.push({ n: w.version, at: U.nowStamp(), by: this.user().name, note: note || 'Conferma anteprima', finish: U.isoOf(w.sched.finishDay), snap: M.Demo.snapOf(w) });
      const i = this.db.projects.findIndex((p) => p.id === w.id);
      this.db.projects[i] = w;
      this.preview = null; this.conflict = null;
      try { sessionStorage.removeItem(PVKEY); } catch (e) { /* */ }
      this.undo = [];
      this.save();
      this.emit('preview-end');
      return { ok: true };
    },

    /* copie, baseline, eliminazione */
    copyProject(src, o) {
      const p = U.clone(src);
      p.id = U.uid('p');
      Object.assign(p, o || {});
      p.versions = []; p.version = 1; p.issues = p.issues || []; p.layouts = p.layouts || [];
      if (p.status !== 'CURR') { p.progress = []; p.proposals = []; }
      this.schedule(p);
      this.db.projects.push(p);
      this.save();
      return p;
    },
    epsNodeFor(work, kind) {
      const node = this.db.eps.find((e) => e.code === work && e.kind === 'node');
      if (!node) return null;
      const n = this.db.eps.find((e) => e.parent === node.id && e.kind === kind);
      return n ? n.id : node.id;
    },
    deleteProject(id) {
      const i = this.db.projects.findIndex((p) => p.id === id);
      if (i < 0) return;
      this.db.projects.splice(i, 1);
      this.db.projects.forEach((p) => { if (p.baselines) Object.keys(p.baselines).forEach((k) => { if (p.baselines[k] === id) p.baselines[k] = ''; }); });
      if (this.db.activeProject === id) this.db.activeProject = (this.db.projects.find((p) => p.status === 'CURR') || this.db.projects[0]).id;
      this.save();
    },

    /* coda offline degli inserimenti da campo */
    outbox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (e) { return []; } },
    setOutbox(list) { try { localStorage.setItem(OUTBOX, JSON.stringify(list)); } catch (e) { /* */ } },

    ROLES
  };

  M.Store = Store;
})(window.M = window.M || {});
