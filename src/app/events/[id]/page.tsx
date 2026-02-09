'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { ChevronLeft, MapPin, Clock, Users, CreditCard, Lock } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function EventDetailPage() {
    const { id } = useParams()
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [event, setEvent] = useState<any>(null)
    const [rsvps, setRsvps] = useState<any[]>([])
    const [myRsvp, setMyRsvp] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const supabase = createClient()

    const fetchData = useCallback(async () => {
        if (!user || !id) return

        const [profileRes, eventRes, rsvpsRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('user_id', user.id).single(),
            supabase.from('events').select('*').eq('id', id).single(),
            supabase.from('rsvps').select('*, profiles(display_name)').eq('event_id', id)
        ])

        setProfile(profileRes.data)
        setEvent(eventRes.data)
        setRsvps(rsvpsRes.data || [])

        const userRsvp = rsvpsRes.data?.find(r => r.user_id === user.id)
        setMyRsvp(userRsvp)
        setLoading(false)
    }, [user, id, supabase])

    useEffect(() => {
        if (!authLoading) fetchData()
    }, [authLoading, fetchData])

    const handleRsvp = async (status: 'yes' | 'no' | 'maybe') => {
        if (isLocked && profile?.role !== 'owner') return
        setUpdating(true)

        const { error } = await supabase
            .from('rsvps')
            .upsert({
                event_id: id,
                user_id: user!.id,
                status,
                updated_at: new Date().toISOString()
            }, { onConflict: 'event_id,user_id' })

        if (!error) {
            if (status === 'yes') {
                // Auto-create unpaid payment record if RSVP is yes
                await supabase.from('payments').upsert({
                    event_id: id,
                    user_id: user!.id,
                    status: 'unpaid',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'event_id,user_id' })
            } else {
                // Remove payment record if status is not yes (no or maybe)
                await supabase.from('payments').delete().match({
                    event_id: id,
                    user_id: user!.id
                })
            }
        }

        fetchData()
        setUpdating(false)
    }

    if (loading) return null

    const isLocked = new Date() > new Date(event.rsvp_deadline)
    const yesCount = rsvps.filter(r => r.status === 'yes').length
    const noCount = rsvps.filter(r => r.status === 'no').length
    const maybeCount = rsvps.filter(r => r.status === 'maybe').length

    return (
        <div className="pb-20">
            <header className="fixed top-0 max-w-md w-full bg-white/80 backdrop-blur-md z-40 p-4 flex items-center gap-4 border-b border-gray-100">
                <Link href="/events" className="text-gray-400">
                    <ChevronLeft size={24} />
                </Link>
                <h1 className="font-bold truncate">{event.title}</h1>
            </header>

            <div className="pt-20 px-6 space-y-8">
                <section className="space-y-4">
                    <div className="space-y-2 text-gray-500">
                        <div className="flex items-center gap-2">
                            <Clock size={18} />
                            <span>{new Date(event.datetime).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={18} />
                            <span>{event.place || '未定'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-black font-bold">
                            <CreditCard size={18} />
                            <span>¥{event.fee.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl text-sm whitespace-pre-wrap">
                        {event.note || '備考なし'}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-orange-600 bg-orange-50 p-3 rounded-xl">
                        <Clock size={14} />
                        <span>回答締切: {new Date(event.rsvp_deadline).toLocaleString('ja-JP')}</span>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="font-bold flex items-center justify-between">
                        <span>出欠回答</span>
                        {isLocked && <span className="text-xs text-red-500 flex items-center gap-1"><Lock size={12} />締切済</span>}
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                        {(['yes', 'no', 'maybe'] as const).map((status) => (
                            <button
                                key={status}
                                disabled={updating || (isLocked && profile?.role !== 'owner')}
                                onClick={() => handleRsvp(status)}
                                className={cn(
                                    "py-3 rounded-xl font-bold transition-all border-2",
                                    myRsvp?.status === status
                                        ? "bg-black text-white border-black"
                                        : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                                )}
                            >
                                {status === 'yes' ? '参加' : status === 'no' ? '欠席' : '検討中'}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="font-bold flex items-center gap-2"><Users size={20} /> 参加状況 ({yesCount}人)</h2>
                    <div className="space-y-2">
                        {rsvps.map((rsvp) => (
                            <div key={rsvp.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl text-sm">
                                <span className="font-medium text-gray-700">{rsvp.profiles?.display_name}</span>
                                <span className={cn(
                                    "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                                    rsvp.status === 'yes' ? "bg-green-100 text-green-700" :
                                        rsvp.status === 'no' ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                )}>
                                    {rsvp.status === 'yes' ? '参加' : rsvp.status === 'no' ? '不参加' : '不明'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {profile?.role === 'owner' && (
                    <section className="space-y-4 pb-10">
                        <h2 className="font-bold text-red-600">管理者ツール</h2>
                        <Link
                            href={`/payments?event_id=${id}`}
                            className="flex items-center justify-between p-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-colors"
                        >
                            <span className="font-bold text-sm">集金管理ツールを開く</span>
                            <ChevronLeft className="rotate-180" size={20} />
                        </Link>
                    </section>
                )}
            </div>
        </div>
    )
}
