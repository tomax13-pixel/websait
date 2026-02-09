'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { RefreshCw, UserPlus, ShieldCheck } from 'lucide-react'

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [circle, setCircle] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const fetchAdminData = useCallback(async () => {
        if (!user) return
        const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
        if (prof?.role !== 'owner') {
            router.push('/home')
            return
        }
        setProfile(prof)

        if (prof.circle_id) {
            const { data: circ } = await supabase.from('circles').select('*').eq('id', prof.circle_id).single()
            setCircle(circ)
        }

        setLoading(false)
    }, [user, router, supabase])

    useEffect(() => {
        if (!authLoading) fetchAdminData()
    }, [authLoading, fetchAdminData])

    const regenerateJoinCode = async () => {
        if (!circle) return
        setUpdating(true)
        const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()
        const { error } = await supabase
            .from('circles')
            .update({ join_code: newCode })
            .eq('id', circle.id)

        if (!error) setCircle({ ...circle, join_code: newCode })
        setUpdating(false)
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        alert(`${inviteEmail} への招待機能は Edge Function 実装後に有効化されます。`)
        setInviteEmail('')
    }

    if (loading) return null

    return (
        <div className="p-6 space-y-8 pb-24">
            <header className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">管理者設定</h1>
            </header>

            <section className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">現在の招待コード</p>
                    <h2 className="text-4xl font-black mb-6">{circle?.join_code}</h2>
                    <button
                        onClick={regenerateJoinCode}
                        disabled={updating}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
                    >
                        <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
                        コードを再生成
                    </button>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10">
                    <ShieldCheck size={160} />
                </div>
            </section>

            <div className="space-y-6">
                <section className="space-y-4">
                    <h3 className="font-bold flex items-center gap-2 text-gray-900">
                        <UserPlus size={20} /> 管理者（オーナー）の追加
                    </h3>
                    <form onSubmit={handleInvite} className="flex gap-2">
                        <input
                            type="email"
                            required
                            placeholder="メールアドレス"
                            className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black text-sm"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <button className="bg-black text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors">
                            招待
                        </button>
                    </form>
                    <p className="text-[10px] text-gray-400">
                        ※ 招待されたユーザーは、登録時に「オーナー権限」が付与されます。
                    </p>
                </section>

                <section className="space-y-4 pt-4 border-t border-gray-100">
                    <h3 className="font-bold text-gray-900">サークル情報</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between p-4 bg-gray-50 rounded-xl text-sm">
                            <span className="text-gray-500">サークル名</span>
                            <span className="font-bold">{circle?.name}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-gray-50 rounded-xl text-sm">
                            <span className="text-gray-500">作成日</span>
                            <span className="font-bold">{new Date(circle?.created_at).toLocaleDateString('ja-JP')}</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
