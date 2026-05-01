// ============================================================
// Service Worker — sw.js
// ============================================================

// ★ HTML更新時は必ずバージョンを上げること
const CACHE_VERSION = 'app-v13';
const BASE = '/shopping-stock-list';

// 自サイトの静的リソース（プリキャッシュ対象）
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.webmanifest',
  BASE + '/icons/icon-192v2.png',
  BASE + '/icons/icon-512v2.png',
];

// CDN リソース（オフライン用にキャッシュ）
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/react-dom@18.2.0/client',
  'https://esm.sh/lucide-react@0.344.0?external=react,react-dom',
];

// 動的キャッシュの上限
const DYNAMIC_CACHE_LIMIT = 50;

// ============================================================
// ユーティリティ
// ============================================================
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await Promise.all(keys.slice(0, keys.length - maxItems).map(k => cache.delete(k)));
  }
}

// ============================================================
// install: プリキャッシュ（1ファイル失敗でもSW登録は壊さない）
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // 自サイトリソース: 個別にキャッシュし、失敗しても続行
      await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] precache skip:', url, e.message))
        )
      );
      // CDN リソース: 個別にキャッシュし、失敗しても続行
      await Promise.allSettled(
        CDN_URLS.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => { if (res.ok) return cache.put(url, res); })
            .catch(e => console.warn('[SW] CDN cache skip:', url, e.message))
        )
      );
    })
  );
  self.skipWaiting();
});

// ============================================================
// activate: 古いキャッシュ削除 + クライアントにリロード通知
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 旧バージョンのキャッシュを削除
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      );
      // 即座に全タブの制御を奪取
      await self.clients.claim();
      // ★ 全クライアントに更新通知 → index.html 側でリロード
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
    })()
  );
});

// ============================================================
// fetch: リクエスト種別ごとに戦略を切り替え
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // POST やクロスオリジン API（GAS等）は一切キャッシュしない
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ─── ① ナビゲーション（HTML）: Network-First ───
  //   → 常に最新 HTML を取りに行き、失敗時のみキャッシュ返却
  //   → これにより「古い HTML が返り続ける白画面」を防止
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(BASE + '/index.html'))
    );
    return;
  }

  // ─── ② CDN リソース: Stale-While-Revalidate ───
  //   → キャッシュがあれば即返却（高速）、裏でネットワーク更新
  if (!url.origin.startsWith(self.location.origin) && CDN_URLS.some(c => request.url.startsWith(c))) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached); // ネットワーク失敗時はキャッシュを返す
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ─── ③ 同一オリジン静的リソース: Cache-First ───
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const cloned = response.clone();
              caches.open(CACHE_VERSION).then(cache => {
                cache.put(request, cloned);
                trimCache(CACHE_VERSION, DYNAMIC_CACHE_LIMIT);
              });
            }
            return response;
          })
          .catch(() => {
            // オフラインでナビゲーション系なら index.html にフォールバック
            if (request.destination === 'document') {
              return caches.match(BASE + '/index.html');
            }
          });
      })
    );
    return;
  }

  // ─── ④ その他のクロスオリジンリクエスト: ネットワークのみ ───
  // (GAS API等 — キャッシュしない)
});

// ============================================================
// notificationclick: アプリを前面に表示
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/shopping-stock-list') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(BASE + '/');
    })
  );
});