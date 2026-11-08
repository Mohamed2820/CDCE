/* CDCE service worker — تشغيل من غير نت + تخزين مؤقت (v2)
   - الصفحة: نت أولاً (عشان دايماً أحدث نسخة)، ولو مفيش نت بتتفتح آخر نسخة محفوظة.
   - المكتبات والخطوط والصور: بتتحفظ تلقائي وتتحدّث في الخلفية.
   - داتا Supabase (الـ API والـ realtime): مش بنلمسها خالص. */
const VER = 'cdce-v2';
const SHELL_CACHE = VER + '-shell', RT_CACHE = VER + '-rt', IMG_CACHE = VER + '-img';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

const OFFLINE_HTML = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CDCE</title><body style="font-family:system-ui,sans-serif;background:#0a0e1d;color:#eceffd;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div style="padding:24px"><div style="font-size:56px">📡</div><h2>مفيش اتصال بالإنترنت</h2><p style="opacity:.7;line-height:1.8">افتح التطبيق مرة واحدة وإنت متصل عشان يتحفظ، وبعدها هيشتغل من غير نت.</p><button onclick="location.reload()" style="padding:12px 22px;border-radius:14px;border:0;background:#7d8cff;color:#fff;font-size:16px">🔁 حاول تاني</button></div></body></html>';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VER)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function navFetch(req) {
  const c = await caches.open(SHELL_CACHE);
  try {
    const res = await withTimeout(fetch(req), 4500);
    if (res && res.ok && res.type === 'basic') c.put('index.html', res.clone());
    return res;
  } catch (_) {
    return (await c.match('index.html')) || (await c.match('./')) ||
      new Response(OFFLINE_HTML, { headers: { 'content-type': 'text/html;charset=utf-8' } });
  }
}

// نسخة محفوظة فوراً + تحديث في الخلفية. الطلبات الخارجية بنعيدها بـ cors عشان نتفادى حجم الـ opaque الكبير.
async function swr(e, cacheName, max) {
  const req = e.request, url = new URL(req.url), cross = url.origin !== location.origin;
  const c = await caches.open(cacheName);
  const key = cross ? req.url : req;
  const hit = await c.match(key);
  const refresh = (async () => {
    try {
      let res;
      if (cross) { try { res = await fetch(req.url, { mode: 'cors', credentials: 'omit' }); } catch (_) { res = await fetch(req); } }
      else res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) { await c.put(key, res.clone()); if (max) await trim(c, max); }
      return res;
    } catch (_) { return null; }
  })();
  e.waitUntil(refresh);
  if (hit) return hit;
  return (await refresh) || new Response('', { status: 504 });
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  const isStorage = u.pathname.startsWith('/storage/v1/object/public/');
  if (u.hostname.endsWith('.supabase.co') && !isStorage) return;           // الـ API والـ realtime والـ functions
  if (r.mode === 'navigate') { e.respondWith(navFetch(r)); return; }
  if (r.destination === 'image' || isStorage) { e.respondWith(swr(e, IMG_CACHE, 150)); return; }
  if (u.origin === location.origin) { e.respondWith(swr(e, SHELL_CACHE, 0)); return; }
  if (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(swr(e, RT_CACHE, 0)); return; }
});
