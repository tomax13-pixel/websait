// Simple client-side notification helper (no backend required)
export async function sendNotification(title: string, body: string, url?: string) {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications')
        return
    }

    // Check if permission is granted
    if (Notification.permission === 'granted') {
        // Use Service Worker if available
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                const registration = await navigator.serviceWorker.ready
                await registration.showNotification(title, {
                    body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-192x192.png',
                    data: url ? { url } : {},
                    requireInteraction: false
                })
            } catch (error) {
                console.error('Service Worker notification failed:', error)
                // Fallback to simple notification
                new Notification(title, { body, icon: '/icons/icon-192x192.png' })
            }
        } else {
            // Fallback for browsers without Service Worker
            new Notification(title, { body, icon: '/icons/icon-192x192.png' })
        }
    } else if (Notification.permission !== 'denied') {
        // Request permission
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
            sendNotification(title, body, url)
        }
    }
}

// Helper to show event notification
export function notifyEventCreated(eventTitle: string, datetime: string, place: string) {
    sendNotification(
        `📅 新しいイベント「${eventTitle}」`,
        `📍 ${place || '場所未定'}\n🕐 ${datetime}\n\n出欠回答をお願いします！`,
        '/events'
    )
}

// Helper to show payment notification
export function notifyPaymentReminder(eventTitle: string, amount: number) {
    sendNotification(
        `💰 集金のお知らせ`,
        `「${eventTitle}」の参加費 ¥${amount.toLocaleString()}円をお支払いください`,
        '/payments'
    )
}

// Helper to show announcement notification
export function notifyAnnouncement(title: string, content: string) {
    sendNotification(
        `📢 ${title}`,
        content,
        '/announcements'
    )
}
