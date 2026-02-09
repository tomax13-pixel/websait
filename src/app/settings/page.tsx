'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Bell, User, LogOut, Shield, Github, ChevronRight, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'

export default function SettingsPage() {
    const { user, signOut } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default')
    const [displayName, setDisplayName] = useState('')
    const [updating, setUpdating] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        async function fetchProfile() {
            if (!user) return
            const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
            setProfile(data)
            setDisplayName(data?.display_name || '')
        }

        if (user) fetchProfile()

        // Check notification status
        if ('Notification' in window) {
            setNotificationStatus(Notification.permission)
        }
    }, [user, supabase])

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return
        setUpdating(true)

        const { error } = await supabase
            .from('profiles')
            .update({ display_name: displayName })
            .eq('user_id', user.id)

        if (!error) {
            alert('プロフィールを更新しました')
            router.refresh()
        } else {
            alert('更新に失敗しました')
        }
        setUpdating(false)
    }

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            alert('このブラウザは通知をサポートしていません')
            return
        }

        const permission = await Notification.requestPermission()
        setNotificationStatus(permission)

        if (permission === 'granted') {
            // Test notification
            new Notification('通知設定完了', {
                body: 'サークル結からの通知を受け取れるようになりました',
                icon: '/icons/icon.svg'
            })
        }
    }

    const handleSignOut = async () => {
        await signOut()
        router.push('/login')
    }

    return (
        <div className="p-6 space-y-8 pb-24">
            <header>
                <h1 className="text-2xl font-bold">設定</h1>
            </header>

            {/* Profile Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <User size={16} /> プロフィール設定
                </h2>
                <Card className="bg-white border-none shadow-sm">
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1">表示名</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-red)] font-bold text-gray-900"
                                placeholder="名前を入力"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={updating}
                                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50"
                            >
                                {updating ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </form>
                </Card>
            </section>

            {/* Notification Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Bell size={16} /> 通知設定
                </h2>
                <Card className="bg-white border-none shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-900">プッシュ通知</p>
                            <p className="text-xs text-gray-500">
                                {notificationStatus === 'granted' ? '許可されています' :
                                    notificationStatus === 'denied' ? 'ブロックされています' : '設定されていません'}
                            </p>
                        </div>
                        {notificationStatus !== 'granted' && (
                            <button
                                onClick={requestNotificationPermission}
                                className="bg-[var(--knot-red)] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#8C1C26]"
                            >
                                許可する
                            </button>
                        )}
                        {notificationStatus === 'granted' && (
                            <span className="text-[var(--knot-red)] font-bold text-xs bg-[var(--knot-red)]/5 px-3 py-1 rounded-full border border-[var(--knot-red)]/10">ON</span>
                        )}
                    </div>
                    {notificationStatus === 'denied' && (
                        <p className="text-xs text-red-500 mt-2 bg-red-50 p-2 rounded-lg">
                            ※ ブラウザの設定から通知のブロックを解除してください
                        </p>
                    )}
                </Card>
            </section>

            {/* About Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={16} /> アプリ情報
                </h2>
                {profile?.role === 'owner' && (
                    <Card
                        className="bg-gradient-to-r from-gray-900 to-black text-white border-none shadow-lg cursor-pointer transform transition-all active:scale-95"
                        onClick={() => router.push('/admin')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <p className="font-bold">管理者メニュー</p>
                                    <p className="text-[10px] opacity-70">サークル設定・招待コード管理</p>
                                </div>
                            </div>
                            <ChevronRight size={20} />
                        </div>
                    </Card>
                )}
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-50 flex justify-between items-center">
                        <span className="text-sm font-medium">バージョン</span>
                        <span className="text-sm text-gray-500">1.0.0 (Beta)</span>
                    </div>
                    <a href="https://github.com/Tomax/websaito" target="_blank" rel="noopener noreferrer" className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors cursor-pointer">
                        <span className="text-sm font-medium flex items-center gap-2"><Github size={16} /> GitHub</span>
                        <ChevronRight size={16} className="text-gray-300" />
                    </a>
                </div>
            </section>

            {/* Logout */}
            <button
                onClick={handleSignOut}
                className="w-full py-4 text-red-500 font-bold bg-white rounded-2xl shadow-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
                <LogOut size={18} />
                ログアウト
            </button>
        </div>
    )
}
