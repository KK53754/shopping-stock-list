// キャッシュ名（バージョンを変えると古いキャッシュが削除される）
const CACHE = 'app-v10';

// インストール時にプリキャッシュするファイル一覧
const BASE = '/shopping-stock-list';
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.webmanifest',
  BASE + '/icons/icon-192v2.png',
  BASE + '/icons/icon-512v2.png',
];

// インストール: 全ファイルをキャッシュし、即座に有効化
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除し、すぐに制御を開始
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// フェッチ: 同一オリジンGETのみキャッシュファースト / オフライン時は /index.html にフォールバック
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') {
            return caches.match(BASE + '/index.html');
          }
        });
    })
  );
});

// 通知クリック時: アプリを前面に表示
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/shopping-stock-list') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/shopping-stock-list/');
    })
  );
});
