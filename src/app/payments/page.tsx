'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

function PaymentsContent() {
    const searchParams = useSearchParams()
    const eventId = searchParams.get('event_id')
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [events, setEvents] = useState<any[]>([])
    const [selectedEventId, setSelectedEventId] = useState(eventId)
    const [payments, setPayments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const [showUnpaidOnly, setShowUnpaidOnly] = useState(false)
    const supabase = createClient()

    const fetchPayments = useCallback(async (eid: string) => {
        setLoading(true)
        const { data } = await supabase
            .from('payments')
            .select('*, profiles(display_name)')
            .eq('event_id', eid)

        setPayments(data || [])
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        async function init() {
            if (!user) return
            const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
            setProfile(prof)

            if (prof?.circle_id) {
                const { data: evs } = await supabase
                    .from('events')
                    .select('*')
                    .eq('circle_id', prof.circle_id)
                    .order('datetime', { ascending: false })
                setEvents(evs || [])

                if (selectedEventId) {
                    fetchPayments(selectedEventId)
                } else if (evs && evs.length > 0) {
                    setSelectedEventId(evs[0].id)
                    fetchPayments(evs[0].id)
                }
            }
            setLoading(false)
        }

        if (!authLoading) init()
    }, [user, authLoading, selectedEventId, fetchPayments, supabase])

    const togglePayment = async (paymentId: string, currentStatus: string) => {
        if (profile?.role !== 'owner') return
        setUpdating(paymentId)

        const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid'
        const { error } = await supabase
            .from('payments')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', paymentId)

        if (!error) {
            setPayments(payments.map(p => p.id === paymentId ? { ...p, status: newStatus } : p))
        }
        setUpdating(null)
    }

    if (authLoading) return null

    const filteredPayments = showUnpaidOnly
        ? payments.filter(p => p.status === 'unpaid')
        : payments

    return (
        <div className="p-6 space-y-6 pb-24">
            <header className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">支払い管理</h1>
            </header>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">イベント選択</label>
                    <select
                        className="mt-1 w-full p-4 bg-gray-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-black"
                        value={selectedEventId || ''}
                        onChange={(e) => {
                            setSelectedEventId(e.target.value)
                            fetchPayments(e.target.value)
                        }}
                    >
                        {events.map(ev => (
                            <option key={ev.id} value={ev.id}>{ev.title}</option>
                        ))}
                    </select>
                </div>

                {/* Filter Toggle */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                    <span className="text-sm font-medium text-gray-600">未払いのみ表示</span>
                    <button
                        onClick={() => setShowUnpaidOnly(!showUnpaidOnly)}
                        className={cn(
                            "w-12 h-7 rounded-full transition-colors relative",
                            showUnpaidOnly ? "bg-[var(--knot-red)]" : "bg-gray-300"
                        )}
                    >
                        <div
                            className={cn(
                                "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                                showUnpaidOnly ? "right-1" : "left-1"
                            )}
                        />
                    </button>
                </div>

                <section className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                        <span>メンバー ({filteredPayments.length}人)</span>
                        <span>ステータス</span>
                    </div>
                    {loading ? (
                        <div className="text-center py-10 text-gray-400 italic">読み込み中...</div>
                    ) : filteredPayments.length > 0 ? (
                        filteredPayments.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => togglePayment(p.id, p.status)}
                                className={cn(
                                    "p-4 rounded-2xl flex justify-between items-center transition-all cursor-pointer",
                                    p.status === 'paid' ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                                )}
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold">{p.profiles?.display_name}</span>
                                    <span className="text-[10px] opacity-70">
                                        {p.status === 'paid' ? '支払い済み' : '未払い'}
                                    </span>
                                </div>
                                {updating === p.id ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
                                ) : p.status === 'paid' ? (
                                    <CheckCircle2 size={24} />
                                ) : (
                                    <Circle size={24} />
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <p className="text-sm text-gray-400">{showUnpaidOnly ? '未払いの人はいません' : '支払い対象者がいません'}</p>
                            <p className="text-xs text-gray-400 mt-1">(RSVP『参加』のみ自動追加)</p>
                        </div>
                    )}
                </section>
            </div>

            <div className="bg-gray-100 p-5 rounded-2xl space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2">集計</h3>
                <div className="flex justify-between text-2xl font-black">
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold">回収済み</p>
                        <p className="text-green-600">¥{payments.filter(p => p.status === 'paid').length * (events.find(e => e.id === selectedEventId)?.fee || 0)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-500 font-bold">未回収</p>
                        <p className="text-gray-400">¥{payments.filter(p => p.status === 'unpaid').length * (events.find(e => e.id === selectedEventId)?.fee || 0)}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function PaymentsPage() {
    return (
        <Suspense fallback={<div className="p-6 text-center text-gray-400">読み込み中...</div>}>
            <PaymentsContent />
        </Suspense>
    )
}
