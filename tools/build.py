#!/usr/bin/env python3
"""Meridian - build: genera sw.js con l'elenco dei file e lo zip della versione portable.
Uso: python3 tools/build.py (dalla radice del repository)."""
import hashlib, os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE = ['index.html', 'manifest.webmanifest', 'css', 'js', 'img', 'fonts', 'guida']

def files():
    out = []
    for item in INCLUDE:
        p = os.path.join(ROOT, item)
        if os.path.isfile(p):
            out.append(item)
        else:
            for d, _, fs in os.walk(p):
                for f in sorted(fs):
                    out.append(os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/'))
    return sorted(out)

def main():
    fl = files()
    h = hashlib.sha256()
    for f in fl:
        with open(os.path.join(ROOT, f), 'rb') as fh:
            h.update(f.encode()); h.update(fh.read())
    ver = h.hexdigest()[:10]
    sw = """/* Meridian - service worker generato da tools/build.py: cache dell'app per l'uso offline */
const VERSION = 'meridian-%s';
const ASSETS = %s;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((a) => './' + a))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => { if (resp.ok) { const c = resp.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); } return resp; })));
});
""" % (ver, '[\n  ' + ',\n  '.join("'%s'" % f for f in ['index.html'] + [f for f in fl if f != 'index.html']) + '\n]')
    with open(os.path.join(ROOT, 'sw.js'), 'w') as fh:
        fh.write(sw)
    os.makedirs(os.path.join(ROOT, 'download'), exist_ok=True)
    zp = os.path.join(ROOT, 'download', 'meridian-portable.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in fl + ['sw.js', 'README.md', 'LEGGIMI-portable.txt']:
            fp = os.path.join(ROOT, f)
            if os.path.exists(fp):
                z.write(fp, 'meridian/' + f)
    print('versione', ver, '-', len(fl), 'file -', zp, os.path.getsize(zp), 'byte')

if __name__ == '__main__':
    main()
