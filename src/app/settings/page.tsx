'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Bell, User, LogOut, Shield, Github, ChevronRight, Settings, Users, Crown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
    owner: '代表',
    admin: '幹部',
    member: '一般',
}

export default function SettingsPage() {
    const { user, signOut } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default')
    const [displayName, setDisplayName] = useState('')
    const [updating, setUpdating] = useState(false)
    const [members, setMembers] = useState<any[]>([])
    const [updatingRole, setUpdatingRole] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const fetchMembers = useCallback(async (orgId: string) => {
        const { data } = await supabase
            .from('organization_members')
            .select('*, profiles(display_name)')
            .eq('organization_id', orgId)
            .order('role', { ascending: true })
        setMembers(data || [])
    }, [supabase])

    useEffect(() => {
        async function fetchProfile() {
            if (!user) return
            const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
            setProfile(data)
            setDisplayName(data?.display_name || '')

            // Fetch members if owner or admin
            if ((data?.role === 'owner' || data?.role === 'admin') && data?.organization_id) {
                fetchMembers(data.organization_id)
            }
        }

        if (user) fetchProfile()

        if ('Notification' in window) {
            setNotificationStatus(Notification.permission)
        }
    }, [user, supabase, fetchMembers])

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

    const handleRoleChange = async (targetUserId: string, newRole: string) => {
        setUpdatingRole(targetUserId)
        const { error } = await supabase.rpc('update_member_role', {
            target_user_id: targetUserId,
            new_role: newRole,
        })

        if (error) {
            alert('ロール変更に失敗しました: ' + error.message)
        } else {
            // Refresh members list
            if (profile?.organization_id) {
                fetchMembers(profile.organization_id)
            }
        }
        setUpdatingRole(null)
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

            {/* Role Management Section - Owner Only */}
            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                <section className="space-y-4">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Users size={16} /> メンバー管理
                    </h2>
                    <div className="space-y-2">
                        {members.map((member) => {
                            const isOwner = member.role === 'owner'
                            const isSelf = member.user_id === user?.id
                            return (
                                <Card key={member.id} className="bg-white border-none shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {isOwner && <Crown size={16} className="text-[var(--knot-gold)]" />}
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">
                                                    {member.profiles?.display_name || '名前未設定'}
                                                    {isSelf && <span className="text-xs text-gray-400 ml-1">(あなた)</span>}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{ROLE_LABELS[member.role]}</p>
                                            </div>
                                        </div>
                                        {!isOwner && !isSelf ? (
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                                                disabled={updatingRole === member.user_id}
                                                className={cn(
                                                    "text-xs font-bold px-3 py-1.5 rounded-full border-none appearance-none cursor-pointer transition-colors",
                                                    member.role === 'admin'
                                                        ? "bg-blue-50 text-blue-700"
                                                        : "bg-gray-100 text-gray-600",
                                                    updatingRole === member.user_id && "opacity-50"
                                                )}
                                            >
                                                <option value="member">一般</option>
                                                <option value="admin">幹部</option>
                                            </select>
                                        ) : (
                                            <span className={cn(
                                                "text-xs font-bold px-3 py-1.5 rounded-full",
                                                isOwner ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"
                                            )}>
                                                {ROLE_LABELS[member.role]}
                                            </span>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </section>
            )}

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
                {(profile?.role === 'owner' || profile?.role === 'admin') && (
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
