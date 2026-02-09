// Service Worker for Web Push Notifications
// サークル結 - Push Notification Handler

self.addEventListener('push', function (event) {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || 'サークル結からの通知',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/home',
            dateOfArrival: Date.now(),
        },
        actions: [
            { action: 'open', title: '開く' },
            { action: 'close', title: '閉じる' },
        ],
        tag: data.tag || 'notification',
        renotify: true,
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'サークル結', options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    if (event.action === 'close') return;

    const urlToOpen = event.notification.data?.url || '/home';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                // 既存のウィンドウがあればフォーカス
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // なければ新しいウィンドウを開く
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Service Worker のインストール
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

// Service Worker のアクティベート
self.addEventListener('activate', function (event) {
    event.waitUntil(clients.claim());
});
