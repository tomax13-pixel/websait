'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'

// VAPID Public Key - 環境変数から取得
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

// Use type alias to avoid collision with global NotificationPermission
type NotifPermission = 'default' | 'granted' | 'denied' | 'loading'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function NotificationPermission() {
    const { user } = useAuth()
    const [permission, setPermission] = useState<NotifPermission>('loading')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showBanner, setShowBanner] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (!('Notification' in window)) {
            setPermission('denied')
            return
        }
        setPermission(Notification.permission)

        // すでに許可されている場合、購読状態を確認
        if (Notification.permission === 'granted') {
            checkSubscription()
        } else if (Notification.permission === 'default') {
            // まだ許可を求めていない場合、バナーを表示
            const dismissed = localStorage.getItem('notification-banner-dismissed')
            if (!dismissed) {
                setShowBanner(true)
            }
        }
    }, [])

    const checkSubscription = async () => {
        if (!('serviceWorker' in navigator)) return

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setIsSubscribed(!!subscription)
        } catch (err) {
            console.error('Subscription check failed:', err)
        }
    }

    const subscribe = async () => {
        if (!user || !VAPID_PUBLIC_KEY) return
        setLoading(true)

        try {
            // Service Worker を登録
            const registration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready

            // 通知許可を要求
            const perm = await Notification.requestPermission()
            setPermission(perm)

            if (perm !== 'granted') {
                setLoading(false)
                return
            }

            // Push subscription を作成
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            })

            const subscriptionJson = subscription.toJSON()

            // DBに保存
            const { error } = await supabase.from('push_subscriptions').upsert({
                user_id: user.id,
                endpoint: subscriptionJson.endpoint!,
                p256dh: subscriptionJson.keys!.p256dh,
                auth: subscriptionJson.keys!.auth,
            }, {
                onConflict: 'endpoint',
            })

            if (error) {
                console.error('Failed to save subscription:', error)
            } else {
                setIsSubscribed(true)
                setShowBanner(false)
            }
        } catch (err) {
            console.error('Subscription failed:', err)
        } finally {
            setLoading(false)
        }
    }

    const unsubscribe = async () => {
        if (!user) return
        setLoading(true)

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                await subscription.unsubscribe()

                // DBから削除
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', subscription.endpoint)
            }

            setIsSubscribed(false)
        } catch (err) {
            console.error('Unsubscribe failed:', err)
        } finally {
            setLoading(false)
        }
    }

    const dismissBanner = () => {
        setShowBanner(false)
        localStorage.setItem('notification-banner-dismissed', 'true')
    }

    // 許可バナー（初回表示用）
    if (showBanner && permission === 'default') {
        return (
            <div className="bg-gradient-to-r from-[var(--knot-red)] to-[#8C1C26] text-white p-4 rounded-2xl shadow-lg mb-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Bell size={24} className="flex-shrink-0" />
                        <div>
                            <p className="font-bold text-sm">通知を有効にしませんか？</p>
                            <p className="text-xs opacity-80 mt-1">
                                新しいお知らせやイベントリマインダーを受け取れます
                            </p>
                        </div>
                    </div>
                    <button onClick={dismissBanner} className="p-1 hover:bg-white/20 rounded-full">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={subscribe}
                        disabled={loading}
                        className="flex-1 bg-white text-[var(--knot-red)] px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {loading ? '処理中...' : '通知を許可する'}
                    </button>
                    <button
                        onClick={dismissBanner}
                        className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/20 transition-colors"
                    >
                        後で
                    </button>
                </div>
            </div>
        )
    }

    // 設定画面用のトグルボタン
    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
                {isSubscribed ? (
                    <Bell size={20} className="text-[var(--knot-red)]" />
                ) : (
                    <BellOff size={20} className="text-gray-400" />
                )}
                <div>
                    <p className="font-bold text-sm text-gray-900">プッシュ通知</p>
                    <p className="text-xs text-gray-500">
                        {permission === 'denied'
                            ? 'ブラウザ設定で許可してください'
                            : isSubscribed
                                ? 'お知らせやリマインダーを受信中'
                                : '通知を有効にする'}
                    </p>
                </div>
            </div>
            <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={loading || permission === 'denied'}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${isSubscribed
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-[var(--knot-red)] text-white hover:bg-[var(--knot-red-light)]'
                    }`}
            >
                {loading ? '...' : isSubscribed ? 'オフ' : 'オン'}
            </button>
        </div>
    )
}
