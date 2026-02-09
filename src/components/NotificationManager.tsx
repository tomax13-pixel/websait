'use client'

import { useEffect } from 'react'

export function NotificationManager() {
    useEffect(() => {
        // Request notification permission on mount
        async function requestPermission() {
            if ('Notification' in window && 'serviceWorker' in navigator) {
                const permission = await Notification.requestPermission()
                if (permission === 'granted') {
                    console.log('Notification permission granted')
                }
            }
        }

        // Wait a bit before requesting permission (better UX)
        const timer = setTimeout(requestPermission, 2000)
        return () => clearTimeout(timer)
    }, [])

    return null
}
