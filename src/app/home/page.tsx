'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Calendar, CreditCard, MessageSquare } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [stats, setStats] = useState({ unpaid: 0, pendingRsvps: 0 })
    const [upcomingEvent, setUpcomingEvent] = useState<any>(null)
    const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchData() {
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('*, organizations(*)')
                .eq('user_id', user.id)
                .single()

            setProfile(profile)

            if (profile?.organization_id) {
                // Fetch upcoming event
                const { data: events } = await supabase
                    .from('events')
                    .select('*')
                    .eq('organization_id', profile.organization_id)
                    .gte('datetime', new Date().toISOString())
                    .order('datetime', { ascending: true })
                    .limit(1)

                if (events && events[0]) {
                    setUpcomingEvent(events[0])

                    // Count pending RSVPs for this user
                    const { count: pendingRsvpCount } = await supabase
                        .from('rsvps')
                        .select('*', { count: 'exact', head: true })
                        .eq('event_id', events[0].id)
                        .eq('user_id', user.id)
                        .is('status', null)

                    // Count unpaid payments
                    const { count: unpaidCount } = await supabase
                        .from('payments')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .eq('status', 'unpaid')

                    setStats({
                        unpaid: unpaidCount || 0,
                        pendingRsvps: pendingRsvpCount || 0
                    })
                }

                // Fetch latest announcement
                const { data: announcements } = await supabase
                    .from('announcements')
                    .select('*')
                    .eq('organization_id', profile.organization_id)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (announcements && announcements[0]) {
                    setLatestAnnouncement(announcements[0])
                }
            }
            setLoading(false)
        }

        if (!authLoading) {
            fetchData()
        }
    }, [user, authLoading, supabase])

    if (loading) return <HomeSkeleton />

    return (
        <div className="pb-24">
            {/* Hero Section */}
            <header className="relative bg-knot-gradient text-white p-8 pt-12 rounded-b-[2.5rem] shadow-xl mb-6">
                <div className="relative z-10">
                    <p className="text-sm opacity-80 font-medium tracking-wider mb-1">
                        {profile?.organizations?.name || '組織未設定'}
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {profile?.display_name ? `こんにちは、\n${profile.display_name}さん` : 'ようこそ'}
                    </h1>
                </div>
                {/* Decorative circle */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-12 -mb-12" />
            </header>

            <div className="px-6 space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <Link href="/payments" className="group">
                        <Card className="h-40 flex flex-col justify-between bg-white border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] group-hover:-translate-y-1 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--knot-red)]/5 rounded-full blur-xl -mr-10 -mt-10" />
                            <div className="w-12 h-12 rounded-2xl bg-[var(--knot-red)]/10 flex items-center justify-center text-[var(--knot-red)] mb-4">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold mb-1">未払い</p>
                                <p className="text-3xl font-black text-gray-900 tracking-tight">
                                    {stats.unpaid} <span className="text-sm font-medium text-gray-400">件</span>
                                </p>
                            </div>
                        </Card>
                    </Link>
                    <Link href="/events" className="group">
                        <Card className="h-40 flex flex-col justify-between bg-white border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] group-hover:-translate-y-1 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--knot-gold)]/10 rounded-full blur-xl -mr-10 -mt-10" />
                            <div className="w-12 h-12 rounded-2xl bg-[var(--knot-gold)]/10 flex items-center justify-center text-[var(--knot-gold)] mb-4">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold mb-1">次の予定</p>
                                <p className="text-2xl font-bold text-gray-900 leading-tight">
                                    {stats.pendingRsvps > 0 ? '回答待ち' : '確認済'}
                                </p>
                            </div>
                        </Card>
                    </Link>
                </div>

                {/* Next Event */}
                <section className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                        <div className="w-1 h-6 bg-[var(--knot-red)] rounded-full" />
                        次回のイベント
                    </h2>
                    {upcomingEvent ? (
                        <Link href={`/events/${upcomingEvent.id}`}>
                            <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="bg-[var(--knot-bg)] text-xs font-bold px-3 py-1 rounded-full text-gray-600">
                                        {new Date(upcomingEvent.datetime).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                                    </div>
                                    <span className="text-[var(--knot-gold)] font-bold text-sm">
                                        ¥{upcomingEvent.fee.toLocaleString()}
                                    </span>
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-gray-900">{upcomingEvent.title}</h3>
                                <div className="flex items-center text-sm text-gray-500 gap-4">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        <span>{new Date(upcomingEvent.datetime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                        <span>{upcomingEvent.place}</span>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ) : (
                        <Card className="p-8 text-center bg-gray-50/50 border-dashed border-2 border-gray-100 shadow-none">
                            <p className="text-sm text-gray-400">予定されているイベントはありません</p>
                        </Card>
                    )}
                </section>

                {/* Announcements */}
                <section className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                        <div className="w-1 h-6 bg-[var(--knot-gold)] rounded-full" />
                        最新の告知
                    </h2>
                    {latestAnnouncement ? (
                        <Link href="/announcements">
                            <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--knot-gold)]/10 flex items-center justify-center text-[var(--knot-gold)] shrink-0">
                                        <MessageSquare size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 truncate">{latestAnnouncement.title}</h3>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(latestAnnouncement.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ) : (
                        <Card className="bg-gray-50/50 border-none shadow-none">
                            <div className="flex items-center gap-3 text-gray-400 italic text-sm">
                                <MessageSquare size={16} />
                                <p>新しいお知らせはありません</p>
                            </div>
                        </Card>
                    )}
                </section>
            </div>
        </div>
    )
}

function HomeSkeleton() {
    return (
        <div className="p-6 space-y-8">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-64" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-40 rounded-2xl" />
            </div>
        </div>
    )
}
