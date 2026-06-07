// NEXUTHA CRM V2 — Service Worker 廃止（自己解除）
// 旧版で登録されたSWがfetchを横取りして全リソース取得を失敗させる不具合への恒久対策。
// このSWは fetch を一切横取りせず、有効化された瞬間に自分自身を unregister し、
// 旧キャッシュを全削除して、制御中のページを正規の通信状態へ戻す。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.navigate(c.url));
    } catch (e) {}
  })());
});
// fetchイベントハンドラは意図的に未定義（リクエストを横取りしない）。
