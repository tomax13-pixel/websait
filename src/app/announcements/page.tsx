'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { Plus, Megaphone } from 'lucide-react'

export default function AnnouncementsPage() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchAnnouncements() {
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            setProfile(profile)

            if (profile?.organization_id) {
                const { data } = await supabase
                    .from('announcements')
                    .select('*, profiles(display_name)')
                    .eq('organization_id', profile.organization_id)
                    .order('created_at', { ascending: false })

                setAnnouncements(data || [])
            }
            setLoading(false)
        }

        if (!authLoading) fetchAnnouncements()
    }, [user, authLoading, supabase])

    if (loading) return null

    return (
        <div className="p-6 space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">お知らせ</h1>
                {profile?.role === 'owner' && (
                    <Link href="/announcements/create" className="bg-black text-white p-2 rounded-full shadow-lg hover:bg-gray-800">
                        <Plus size={24} />
                    </Link>
                )}
            </header>

            <div className="space-y-4">
                {announcements.length > 0 ? (
                    announcements.map((ann) => (
                        <div
                            key={ann.id}
                            className="p-6 border border-gray-100 rounded-3xl bg-white shadow-sm"
                        >
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                <Megaphone size={12} />
                                <span>告知 • {new Date(ann.created_at).toLocaleDateString('ja-JP')}</span>
                            </div>
                            <h3 className="font-black text-xl text-gray-900 leading-tight mb-3">{ann.title}</h3>
                            <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">
                                {ann.body}
                            </p>
                            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">
                                    {ann.profiles?.display_name?.[0]}
                                </div>
                                <span className="text-xs text-gray-500 font-medium">{ann.profiles?.display_name}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-sm text-gray-400">新しいお知らせはありません</p>
                    </div>
                )}
            </div>
        </div>
    )
}
