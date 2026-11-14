// 서비스 워커: 오프라인 앱 셸 + 알림/푸시 처리
const CACHE = 'office-826e7e5';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'core.js', 'agents.js', 'alarms.js', 'cloud.js', 'office.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/badge-72.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 같은 출처 파일: 네트워크 우선, 실패 시 캐시 (Google API 등 외부 요청은 건드리지 않음)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});

// 서버 푸시 (이정표 3에서 Supabase가 보냄): { title, body, tag, url }
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: '비서실', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '비서실', {
    body: d.body || '', tag: d.tag, icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => 'focus' in x); return c ? c.focus() : self.clients.openWindow(url);
  }));
});
