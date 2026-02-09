'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { Plus, MapPin, Clock } from 'lucide-react'

export default function EventsPage() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [events, setEvents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchEvents() {
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            setProfile(profile)

            if (profile?.circle_id) {
                const { data: eventsData } = await supabase
                    .from('events')
                    .select('*')
                    .eq('circle_id', profile.circle_id)
                    .order('datetime', { ascending: true })

                setEvents(eventsData || [])
            }
            setLoading(false)
        }

        if (!authLoading) {
            fetchEvents()
        }
    }, [user, authLoading, supabase])

    if (loading) return <EventsSkeleton />

    return (
        <div className="p-6 space-y-6 pb-24">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-8 bg-[var(--knot-red)] rounded-full" />
                    <h1 className="text-2xl font-bold">イベント</h1>
                </div>
                {profile?.role === 'owner' && (
                    <Link href="/events/create" className="bg-[var(--knot-red)] text-white p-3 rounded-full shadow-[0_4px_14px_rgba(191,30,44,0.4)] hover:bg-[#a01925] hover:-translate-y-1 transition-all">
                        <Plus size={24} />
                    </Link>
                )}
            </header>

            <div className="space-y-4">
                {events.length > 0 ? (
                    events.map((event) => (
                        <Link
                            key={event.id}
                            href={`/events/${event.id}`}
                            className="block group"
                        >
                            <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] group-hover:-translate-y-1 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="bg-gray-100 text-xs font-bold px-3 py-1 rounded-full text-gray-600">
                                        {new Date(event.datetime).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                                    </div>
                                    <span className="text-[var(--knot-gold)] font-bold text-sm">
                                        ¥{event.fee.toLocaleString()}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg mb-3 text-gray-900">{event.title}</h3>
                                <div className="mt-2 space-y-2 text-sm text-gray-500">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-[var(--knot-red)]" />
                                        <span>{new Date(event.datetime).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-gray-400" />
                                        <span>{event.place || '未定'}</span>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))
                ) : (
                    <Card className="p-12 text-center bg-gray-50/50 border-2 border-dashed border-gray-100 shadow-none">
                        <p className="text-sm text-gray-400">イベントがまだありません</p>
                    </Card>
                )}
            </div>
        </div>
    )
}

function EventsSkeleton() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                ))}
            </div>
        </div>
    )
}
