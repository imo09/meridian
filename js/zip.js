/* Meridian - ZIP (scrittura e lettura), XLSX e CSV senza librerie esterne */
(function (M) {
  'use strict';
  const U = M.U;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const CRC = (function () { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  /* ZIP con metodo "store": semplice e leggibile da Excel e da qualsiasi decompressore */
  function zip(files) {
    const parts = [], central = [];
    let off = 0;
    const now = new Date();
    const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    const csize = central.reduce((s, x) => s + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  }

  async function inflate(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Il browser non supporta la decompressione dei file .xlsx: usa CSV o incolla da Excel.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buf) {
    const b = new Uint8Array(buf); const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = b.length - 22;
    while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Il file non è un archivio ZIP/XLSX valido.');
    const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
    const out = {};
    for (let i = 0; i < n; i++) {
      const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      const lnl = v.getUint16(lo + 26, true), lxl = v.getUint16(lo + 28, true);
      const start = lo + 30 + lnl + lxl;
      const raw = b.subarray(start, start + csize);
      out[name] = { method, raw };
      p += 46 + nl + xl + cl;
    }
    return {
      names: Object.keys(out),
      async text(name) { const f = out[name]; if (!f) return null; const d = f.method === 8 ? await inflate(f.raw) : f.raw; return dec.decode(d); }
    };
  }

  /* ---------- XLSX ---------- */
  const xesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  function colName(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  const STYLE = { head: 1, date: 2, group: 3, num: 4, int: 5, groupNum: 6, note: 7 };

  function sheetXml(sh) {
    const rows = sh.rows.map((row, ri) => {
      const cells = row.map((c, ci) => {
        if (c === null || c === undefined || c === '') return '';
        const ref = colName(ci) + (ri + 1);
        let o = typeof c === 'object' && !(c instanceof Date) ? c : { v: c };
        let s = o.s !== undefined ? ' s="' + o.s + '"' : '';
        if (o.t === 'd') { const serial = o.v + 25569; return '<c r="' + ref + '" s="' + (o.s || STYLE.date) + '"><v>' + serial + '</v></c>'; }
        if (typeof o.v === 'number' && Number.isFinite(o.v)) { if (!s && o.t !== 'raw') s = ' s="' + (Number.isInteger(o.v) ? STYLE.int : STYLE.num) + '"'; return '<c r="' + ref + '"' + s + '><v>' + o.v + '</v></c>'; }
        return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xesc(o.v) + '</t></is></c>';
      }).join('');
      return '<row r="' + (ri + 1) + '">' + cells + '</row>';
    }).join('');
    const cols = sh.cols ? '<cols>' + sh.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (w || 12) + '" customWidth="1"/>').join('') + '</cols>' : '';
    const freeze = sh.freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
    const af = sh.autoFilter && sh.rows.length ? '<autoFilter ref="A' + sh.freeze + ':' + colName((sh.rows[sh.freeze - 1] || []).length - 1) + sh.rows.length + '"/>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + freeze + cols + '<sheetData>' + rows + '</sheetData>' + af + '</worksheet>';
  }

  function xlsx(sheets) {
    const files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + xesc(String(s.name).slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, ' ')) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F2A40"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4EDF6"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="2" fillId="3" borderId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }));
    return zip(files);
  }

  async function readXlsx(buf) {
    const z = await unzip(buf);
    const parse = (t) => new DOMParser().parseFromString(t, 'application/xml');
    const wb = parse(await z.text('xl/workbook.xml'));
    const rels = parse((await z.text('xl/_rels/workbook.xml.rels')) || '<x/>');
    const relMap = {};
    Array.from(rels.getElementsByTagName('Relationship')).forEach((r) => { relMap[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const ssT = await z.text('xl/sharedStrings.xml');
    const ss = ssT ? Array.from(parse(ssT).getElementsByTagName('si')).map((si) => Array.from(si.getElementsByTagName('t')).map((t) => t.textContent).join('')) : [];
    const sheets = [];
    for (const s of Array.from(wb.getElementsByTagName('sheet'))) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let target = relMap[rid] || 'worksheets/sheet1.xml';
      target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
      const x = await z.text('xl/' + target);
      if (!x) continue;
      const doc = parse(x);
      const rows = [];
      Array.from(doc.getElementsByTagName('row')).forEach((r) => {
        const ri = Number(r.getAttribute('r')) - 1;
        const row = [];
        Array.from(r.getElementsByTagName('c')).forEach((c) => {
          const ref = c.getAttribute('r') || '';
          const col = ref.replace(/\d+/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          const t = c.getAttribute('t');
          let v = '';
          if (t === 's') v = ss[Number((c.getElementsByTagName('v')[0] || {}).textContent)] || '';
          else if (t === 'inlineStr') v = Array.from(c.getElementsByTagName('t')).map((n) => n.textContent).join('');
          else if (t === 'b') v = (c.getElementsByTagName('v')[0] || {}).textContent === '1';
          else { const vv = c.getElementsByTagName('v')[0]; v = vv ? (t === 'str' ? vv.textContent : Number(vv.textContent)) : ''; }
          row[col] = v;
        });
        rows[ri] = row;
      });
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
      sheets.push({ name: s.getAttribute('name'), rows });
    }
    return sheets;
  }

  /* ---------- CSV / testo tabellare ---------- */
  function parseDelimited(text, sep) {
    text = String(text || '').replace(/^﻿/, '');
    if (!sep) {
      const first = text.split(/\r?\n/)[0] || '';
      sep = (first.match(/\t/g) || []).length ? '\t' : (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    }
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"' && cur === '') { q = true; continue; }
      if (ch === sep) { row.push(cur); cur = ''; continue; }
      if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  }
  function toCsv(rows, sep) {
    sep = sep || ';';
    return '﻿' + rows.map((r) => r.map((c) => { let v = c && typeof c === 'object' ? (c.t === 'd' ? U.fdl(c.v) : c.v) : c; if (v === null || v === undefined) v = ''; if (typeof v === 'number') v = String(v).replace('.', ','); v = String(v); return /[";\n\r,]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(sep)).join('\r\n');
  }

  M.Zip = { zip, unzip, crc32, xlsx, readXlsx, parseDelimited, toCsv, STYLE };
})(window.M = window.M || {});
