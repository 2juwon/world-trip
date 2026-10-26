/* 한판 세계여행 서비스 워커 — 앱 설치 + 한 번 연 게임은 인터넷이 잠깐 끊겨도 열리게
 * 늘 새 버전을 먼저 받아 오고(네트워크 먼저), 안 되면 저장해 둔 걸 보여 줌. 온라인 서버(workers.dev)는 건드리지 않음 */
const CACHE = 'world-trip-v1';
const CORE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('world-trip-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((m) => m || (req.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
