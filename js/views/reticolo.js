/* Meridian - reticolo (network diagram) con zoom semantico, minimappa, raggruppamento WBS */
(function (M) {
  'use strict';
  const U = M.U, UI = M.UI, S = M.Store, VH = M.VH, CPM = M.CPM, esc = U.esc;
  const BW = 176, BH = 74, GX = 64, GY = 18, LANE_H = 26;
  let state = null;

  function nodeSet(ctx, tr) {
    const net = S.ui.net, p = ctx.p;
    const ids = new Set();
    if (tr) { tr.levels.forEach((v, id) => ids.add(id)); return ids; }
    if (net.scope === 'all') { p.activities.forEach((a) => ids.add(a.id)); return ids; }
    if (net.scope === 'sel' && S.ui.sel) {
      const depth = Number(net.depth) || 3;
      ids.add(S.ui.sel);
      let front = [S.ui.sel];
      for (let d = 0; d < depth; d++) {
        const nx = [];
        front.forEach((id) => p.rels.forEach((r) => { if (r.succ === id && !ids.has(r.pred)) { ids.add(r.pred); nx.push(r.pred); } if (r.pred === id && !ids.has(r.succ)) { ids.add(r.succ); nx.push(r.succ); } }));
        front = nx;
      }
      return ids;
    }
    p.activities.forEach((a) => { const r = ctx.s.acts[a.id]; if (r && (r.crit || (net.scope === 'critsub' && r.sub))) ids.add(a.id); });
    if (S.ui.sel) ids.add(S.ui.sel);
    return ids;
  }

  function layout(ctx, ids) {
    const p = ctx.p;
    const rels = p.rels.filter((r) => ids.has(r.pred) && ids.has(r.succ));
    const preds = new Map(); ids.forEach((id) => preds.set(id, []));
    rels.forEach((r) => preds.get(r.succ).push(r.pred));
    const lvl = new Map();
    const visiting = new Set();
    const L = (id) => { if (lvl.has(id)) return lvl.get(id); if (visiting.has(id)) return 0; visiting.add(id); const v = preds.get(id).length ? Math.max.apply(null, preds.get(id).map(L)) + 1 : 0; visiting.delete(id); lvl.set(id, v); return v; };
    ids.forEach(L);
    const top = (a) => { let w = ctx.wbsMap.get(a.wbsId); let last = w; while (w && w.parent && ctx.wbsMap.get(w.parent) && ctx.wbsMap.get(w.parent).parent) { w = ctx.wbsMap.get(w.parent); last = w; } return last ? last.id : '__'; };
    const group = S.ui.net.group;
    const lanes = [];
    const pos = new Map();
    const order = (a, b) => { const ra = ctx.s.acts[a.id] || {}, rb = ctx.s.acts[b.id] || {}; return (ra.es || 0) - (rb.es || 0) || (a.code < b.code ? -1 : 1); };
    if (group) {
      const byLane = U.groupBy([...ids].map((id) => ctx.byId.get(id)), top);
      const wOrder = (p.wbs || []).map((w) => w.id);
      const keys = [...byLane.keys()].sort((a, b) => wOrder.indexOf(a) - wOrder.indexOf(b));
      let y = 10;
      keys.forEach((k) => {
        const acts = byLane.get(k); const w = ctx.wbsMap.get(k);
        const collapsed = !!S.ui.net.collapsed[k];
        const lane = { id: k, label: w ? VH.wbsPath(ctx, w.id) + ' ' + w.name : 'Senza WBS', y, count: acts.length, collapsed };
        y += LANE_H;
        if (collapsed) {
          const minL = Math.min.apply(null, acts.map((a) => lvl.get(a.id)));
          lane.box = { x: 20 + minL * (BW + GX), y, members: acts };
          acts.forEach((a) => pos.set(a.id, { x: lane.box.x, y, hidden: true, lane: k }));
          y += BH + GY;
        } else {
          const perL = new Map();
          acts.sort(order).forEach((a) => { const l = lvl.get(a.id); const n = perL.get(l) || 0; perL.set(l, n + 1); pos.set(a.id, { x: 20 + l * (BW + GX), y: y + n * (BH + GY) }); });
          const rowsN = Math.max.apply(null, [...perL.values()]);
          y += rowsN * (BH + GY);
        }
        lane.h = y - lane.y; lanes.push(lane); y += 8;
      });
    } else {
      const perL = new Map();
      [...ids].map((id) => ctx.byId.get(id)).sort((a, b) => { const ca = (ctx.s.acts[a.id] || {}).path || 99, cb = (ctx.s.acts[b.id] || {}).path || 99; return ca - cb || order(a, b); }).forEach((a) => { const l = lvl.get(a.id); const n = perL.get(l) || 0; perL.set(l, n + 1); pos.set(a.id, { x: 20 + l * (BW + GX), y: 10 + n * (BH + GY) }); });
    }
    let W = 0, H = 0; pos.forEach((v) => { W = Math.max(W, v.x + BW + 20); H = Math.max(H, v.y + BH + 20); });
    lanes.forEach((l) => { H = Math.max(H, l.y + l.h + 10); });
    return { pos, rels, lanes, W: Math.max(W, 400), H: Math.max(H, 200) };
  }

  function boxSvg(ctx, a, x, y, tr, zoomed) {
    const r = ctx.s.acts[a.id] || {};
    const d = VH.dates(ctx, a);
    const lv = tr && tr.levels.has(a.id) ? tr.levels.get(a.id) : null;
    const tcol = lv === null ? null : lv < 0 ? S.S().traceColors.back : lv > 0 ? S.S().traceColors.fwd : '#1c5a8a';
    const col = tcol || (r.crit ? VH.pathColor(r.path) : r.sub ? VH.SUBCOLOR : a.af ? '#2b6fd6' : '#8a97a8');
    const sel = a.id === S.ui.sel;
    const fill = a.af ? '#eef4fd' : r.crit ? '#fdf1f1' : '#ffffff';
    let g = '<g class="nb" data-a="netSel" data-id="' + esc(a.id) + '" transform="translate(' + x + ',' + y + ')"><rect width="' + BW + '" height="' + BH + '" rx="6" fill="' + fill + '" stroke="' + col + '" stroke-width="' + (r.crit || tcol ? 2.5 : 1.2) + '"/>' + (sel ? '<rect x="-4" y="-4" width="' + (BW + 8) + '" height="' + (BH + 8) + '" rx="8" fill="none" stroke="#1c5a8a" stroke-width="2" stroke-dasharray="4 3"/>' : '');
    if (zoomed) {
      g += '<text x="' + BW / 2 + '" y="' + (BH / 2 + 9) + '" class="nid big" text-anchor="middle">' + esc(a.code) + '</text>';
    } else {
      const nm = a.name.length > 26 ? a.name.slice(0, 25) + '…' : a.name;
      g += '<rect width="' + BW + '" height="20" rx="6" fill="' + col + '"/><rect y="14" width="' + BW + '" height="6" fill="' + col + '"/><text x="8" y="14" class="nid">' + esc(a.code) + '</text><text x="' + (BW - 8) + '" y="14" class="nfl" text-anchor="end">' + (r.tf === null || r.tf === undefined ? (a.af ? 'conclusa' : '') : 'TF ' + r.tf) + '</text>' +
        '<text x="8" y="37" class="nnm">' + esc(nm) + '</text>' +
        '<text x="8" y="54" class="nsm">' + (CPM.isMile(a) ? 'milestone' : 'Dur. ' + (a.type === 'loe' ? (r.odCalc || 0) : a.od || 0) + ' g') + '</text><text x="' + (BW - 8) + '" y="54" class="nsm" text-anchor="end">' + (r.driverType ? esc(r.driverType) : '') + '</text>' +
        '<text x="8" y="68" class="nsm">' + (d.start !== null ? U.fd(d.start) + (d.sA ? ' A' : '') : '') + '</text><text x="' + (BW - 8) + '" y="68" class="nsm" text-anchor="end">' + (d.finish !== null ? U.fd(d.finish) + (d.fA ? ' A' : '') : '') + '</text>';
    }
    return g + '<title>' + esc(a.code + ' ' + a.name + (r.why ? '\n' + r.why : '')) + '</title></g>';
  }

  M.Views.reticolo = {
    render(ctx, tr) {
      const ids = nodeSet(ctx, tr);
      const L = layout(ctx, ids);
      const z = S.ui.net.zoom || 1;
      const zoomed = z < 0.6;
      let g = '';
      L.lanes.forEach((l) => { g += '<g class="lane"><rect x="4" y="' + l.y + '" width="' + (L.W - 8) + '" height="' + (l.h) + '" class="laneb"/><g data-a="netLane" data-id="' + esc(l.id) + '" class="lanet"><rect x="8" y="' + (l.y + 3) + '" width="18" height="18" rx="3" class="lanebtn"/><text x="17" y="' + (l.y + 16) + '" text-anchor="middle" class="lanetx">' + (l.collapsed ? '+' : '-') + '</text><text x="32" y="' + (l.y + 17) + '" class="lanel">' + esc(l.label) + ' (' + l.count + ')</text></g></g>'; });
      const P = (id) => { const v = L.pos.get(id); return v; };
      L.rels.forEach((r) => {
        const a = P(r.pred), b = P(r.succ); if (!a || !b) return;
        if (a.hidden && b.hidden && a.lane === b.lane) return;
        const rr = ctx.s.rels && ctx.s.rels[r.id];
        const fromStart = r.type === 'SS' || r.type === 'SF', toFinish = r.type === 'FF' || r.type === 'SF';
        const x1 = a.x + (fromStart ? 0 : BW), y1 = a.y + BH / 2, x2 = b.x + (toFinish ? BW : 0), y2 = b.y + BH / 2;
        let d;
        if (!fromStart && !toFinish) { const mx = x2 > x1 ? x1 + (x2 - x1) / 2 : x1 + 14; d = 'M' + x1 + ' ' + y1 + 'H' + mx + 'V' + y2 + 'H' + x2; }
        else if (fromStart && !toFinish) { const mx = Math.min(x1, x2) - 14; d = 'M' + x1 + ' ' + y1 + 'H' + mx + 'V' + y2 + 'H' + x2; }
        else if (!fromStart && toFinish) { const mx = Math.max(x1, x2) + 14; d = 'M' + x1 + ' ' + y1 + 'H' + mx + 'V' + y2 + 'H' + x2; }
        else { d = 'M' + x1 + ' ' + y1 + 'H' + (x1 - 14) + 'V' + y2 + 'H' + x2; }
        const sc = ctx.s.acts[r.succ] || {}, pc = ctx.s.acts[r.pred] || {};
        const critEdge = rr && rr.driving && sc.crit && pc.crit;
        const lv = tr && tr.levels.has(r.pred) && tr.levels.has(r.succ) && tr.via.get(r.succ) === r ? true : tr && tr.levels.has(r.pred) && tr.levels.has(r.succ) && tr.via.get(r.pred) === r;
        const col = lv ? (tr.levels.get(r.succ) <= 0 ? S.S().traceColors.back : S.S().traceColors.fwd) : critEdge ? VH.pathColor(sc.path) : rr && rr.driving ? '#3d4856' : '#a7b2bf';
        g += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (critEdge || lv ? 2.2 : 1.3) + '"' + (rr && rr.driving ? '' : ' stroke-dasharray="5 4"') + ' marker-end="url(#na)"/>';
        if (r.type !== 'FS' || r.lag) { const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2 - 4; g += '<text x="' + lx + '" y="' + ly + '" class="nlag" text-anchor="middle">' + esc(CPM.lagText(r)) + '</text>'; }
      });
      L.lanes.filter((l) => l.collapsed && l.box).forEach((l) => {
        const ms = l.box.members; const ds = ms.map((a) => VH.dates(ctx, a));
        const st = Math.min.apply(null, ds.map((d) => (d.start !== null ? d.start : d.finish)).filter((x) => x !== null)), fi = Math.max.apply(null, ds.map((d) => (d.finish !== null ? d.finish : d.start)).filter((x) => x !== null));
        const crit = ms.some((a) => (ctx.s.acts[a.id] || {}).crit);
        g += '<g class="nb" data-a="netLane" data-id="' + esc(l.id) + '" transform="translate(' + l.box.x + ',' + l.box.y + ')"><rect width="' + BW + '" height="' + BH + '" rx="6" fill="#f3f5f8" stroke="' + (crit ? '#cf3a3a' : '#5d6877') + '" stroke-width="2" stroke-dasharray="6 3"/><text x="8" y="18" class="nid dark">' + esc(l.label.split(' ')[0]) + '</text><text x="8" y="38" class="nnm">' + ms.length + ' attività (compresso)</text><text x="8" y="58" class="nsm">' + U.fd(st) + ' - ' + U.fd(fi) + '</text></g>';
      });
      L.pos.forEach((v, id) => { if (!v.hidden) g += boxSvg(ctx, ctx.byId.get(id), v.x, v.y, tr, zoomed); });
      state = { W: L.W, H: L.H, pos: L.pos };
      const vbW = L.W / z, vbH = L.H / z;
      const net = S.ui.net;
      const tools = '<div class="nettool"><label class="lbl">Mostra <select class="inp sm" data-c="netScope"' + (tr ? ' disabled' : '') + '><option value="crit"' + (net.scope === 'crit' ? ' selected' : '') + '>Percorso critico</option><option value="critsub"' + (net.scope === 'critsub' ? ' selected' : '') + '>Critiche e sub-critiche</option><option value="sel"' + (net.scope === 'sel' ? ' selected' : '') + '>Catena della selezione</option><option value="all"' + (net.scope === 'all' ? ' selected' : '') + '>Tutte</option></select></label>' + (net.scope === 'sel' && !tr ? '<label class="lbl">entro <input class="inp xs" type="number" min="1" max="20" value="' + net.depth + '" data-c="netDepth"> livelli</label>' : '') + (tr ? '<span class="chip tbk">Traccia attiva</span>' : '') + '<label class="sw"><input type="checkbox" data-c="netGroup"' + (net.group ? ' checked' : '') + '> Raggruppa per WBS</label><span class="sp"></span><span class="muted small">' + ids.size + ' attività - rotella per lo zoom, trascina per spostarti</span><div class="seg"><button type="button" class="btn sm" data-a="netZoom" data-z="0.8" aria-label="Riduci">-</button><button type="button" class="btn sm" data-a="netZoom" data-z="fit">Adatta</button><button type="button" class="btn sm" data-a="netZoom" data-z="1.25" aria-label="Ingrandisci">+</button></div><button type="button" class="btn sm" data-a="netPng">' + UI.ic('image', 16) + 'Immagine</button></div>';
      return tools + '<div class="netw" id="netw"><svg id="netsvg" class="net" viewBox="0 0 ' + vbW + ' ' + vbH + '" preserveAspectRatio="xMinYMin meet" style="width:100%;height:100%" role="img" aria-label="Reticolo delle attività"><defs><marker id="na" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#5d6877"/></marker></defs><g id="netg">' + g + '</g></svg><div class="minimap" id="minimap" aria-hidden="true"><svg viewBox="0 0 ' + L.W + ' ' + L.H + '" preserveAspectRatio="xMinYMin meet">' + [...L.pos.entries()].filter(([, v]) => !v.hidden).map(([id, v]) => { const r = ctx.s.acts[id] || {}; return '<rect x="' + v.x + '" y="' + v.y + '" width="' + BW + '" height="' + BH + '" fill="' + (r.crit ? VH.pathColor(r.path) : '#9fb2c5') + '"/>'; }).join('') + '<rect id="mmv" x="0" y="0" width="' + vbW + '" height="' + vbH + '" class="mmv"/></svg></div></div>';
    },
    after() {
      const svg = document.getElementById('netsvg'); if (!svg || !state) return;
      const vb = svg.viewBox.baseVal;
      const view = S.ui.net.view || { x: 0, y: 0 };
      vb.x = view.x || 0; vb.y = view.y || 0;
      const mmv = document.getElementById('mmv');
      const sync = () => { if (mmv) { mmv.setAttribute('x', vb.x); mmv.setAttribute('y', vb.y); mmv.setAttribute('width', vb.width); mmv.setAttribute('height', vb.height); } S.ui.net.view = { x: vb.x, y: vb.y }; };
      sync();
      svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
        const r = svg.getBoundingClientRect();
        const mx = vb.x + ((e.clientX - r.left) / r.width) * vb.width, my = vb.y + ((e.clientY - r.top) / r.height) * vb.height;
        const nw = U.clamp(vb.width * f, 200, state.W * 3), nh = vb.height * (nw / vb.width);
        vb.x = mx - (mx - vb.x) * (nw / vb.width); vb.y = my - (my - vb.y) * (nh / vb.height); vb.width = nw; vb.height = nh;
        const z = state.W / nw; const was = (S.ui.net.zoom || 1) < 0.6, now = z < 0.6;
        S.ui.net.zoom = z; sync(); S.saveUi();
        if (was !== now) M.App.render(true);
      }, { passive: false });
      let drag = null;
      svg.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-a]')) return; drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }; svg.setPointerCapture(e.pointerId); svg.classList.add('drag'); });
      svg.addEventListener('pointermove', (e) => { if (!drag) return; const r = svg.getBoundingClientRect(); vb.x = drag.vx - ((e.clientX - drag.x) / r.width) * vb.width; vb.y = drag.vy - ((e.clientY - drag.y) / r.height) * vb.height; sync(); });
      svg.addEventListener('pointerup', () => { drag = null; svg.classList.remove('drag'); S.saveUi(); });
      const mm = document.getElementById('minimap');
      if (mm) mm.addEventListener('click', (e) => { const r = mm.getBoundingClientRect(); const s = Math.min(r.width / state.W, r.height / state.H); vb.x = (e.clientX - r.left) / s - vb.width / 2; vb.y = (e.clientY - r.top) / s - vb.height / 2; sync(); S.saveUi(); });
      if (S.ui.sel && state.pos.has(S.ui.sel) && M.Views.reticolo._center) { M.Views.reticolo._center = false; const v = state.pos.get(S.ui.sel); vb.x = v.x - vb.width / 2 + BW / 2; vb.y = v.y - vb.height / 2 + BH / 2; sync(); }
    }
  };

  Object.assign(M.A, {
    netSel(el) { S.ui.sel = el.getAttribute('data-id'); S.saveUi(); M.App.render(true); },
    netLane(el) { const k = el.getAttribute('data-id'); S.ui.net.collapsed[k] = !S.ui.net.collapsed[k]; S.saveUi(); M.App.render(true); },
    netZoom(el) {
      const z = el.getAttribute('data-z');
      if (z === 'fit') { S.ui.net.zoom = 1; S.ui.net.view = { x: 0, y: 0 }; }
      else { S.ui.net.zoom = U.clamp((S.ui.net.zoom || 1) * Number(z), 0.2, 3); }
      S.saveUi(); M.App.render(true);
    },
    netPng() {
      const svg = document.getElementById('netsvg'); if (!svg || !state) return;
      const clone = svg.cloneNode(true);
      clone.setAttribute('viewBox', '0 0 ' + state.W + ' ' + state.H); clone.setAttribute('width', state.W); clone.setAttribute('height', state.H); clone.removeAttribute('style');
      M.Views.svgToPng(clone, state.W, state.H, 'Reticolo_' + U.slug(S.P().code) + '.png');
    }
  });
  Object.assign(M.C, {
    netScope(el) { S.ui.net.scope = el.value; S.ui.net.view = { x: 0, y: 0 }; S.saveUi(); M.App.render(true); },
    netDepth(el) { S.ui.net.depth = Number(el.value) || 3; S.saveUi(); M.App.render(true); },
    netGroup(el) { S.ui.net.group = el.checked; S.saveUi(); M.App.render(true); }
  });

  /* esporta un SVG come immagine PNG, con gli stili essenziali incorporati */
  M.Views.svgToPng = function (svgEl, W, H, name) {
    const css = '.nid{font:600 12px "IBM Plex Mono",monospace;fill:#fff}.nid.dark{fill:#18212c}.nid.big{font-size:30px;fill:#18212c}.nfl{font:600 11px "Source Sans 3",sans-serif;fill:#fff}.nnm{font:600 12px "Source Sans 3",sans-serif;fill:#18212c}.nsm{font:400 11px "Source Sans 3",sans-serif;fill:#3d4856}.nlag{font:600 10px "IBM Plex Mono",monospace;fill:#3d4856}.laneb{fill:#f6f8fb;stroke:#d6dce4}.lanel{font:600 12px "Barlow Condensed",sans-serif;fill:#3d4856}.lanebtn{fill:#fff;stroke:#c5ced9}.lanetx{font:700 12px sans-serif;fill:#3d4856}text{font-family:"Source Sans 3",sans-serif}.gh{fill:#f3f5f8}.ght{font:600 12px "Barlow Condensed",sans-serif;fill:#3d4856}.ghs{font:400 10px "Source Sans 3",sans-serif;fill:#566170}.gml,.gwl{stroke:#e8ecf1}.gyl{stroke:#c5ced9}.ggrp{fill:#f3f5f8}.gsum{fill:#2a3340}.gbl{fill:#e0ad00}.gtx{font:400 10px "IBM Plex Mono",monospace;fill:#3d4856}.gdd{stroke:#1c5a8a;stroke-dasharray:5 4;stroke-width:1.5}.gddt{font:600 10px sans-serif;fill:#1c5a8a}.glk{fill:none;stroke:#8a97a8}.glk.drv{stroke:#3d4856}.gprog{fill:none;stroke:#d23c3c;stroke-width:1.8}.gsel{fill:#e4edf6}.nwd{fill:#f6f7f9}.op{opacity:.22}';
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style'); st.textContent = css; svgEl.insertBefore(st, svgEl.firstChild);
    const xml = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    const scale = Math.min(2, 8000 / Math.max(W, H));
    img.onload = () => { const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.scale(scale, scale); x.drawImage(img, 0, 0); c.toBlob((b) => U.download(name, b)); };
    img.onerror = () => UI.toast('Esportazione immagine non riuscita in questo browser.', 'bad');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  };
})(window.M = window.M || {});
