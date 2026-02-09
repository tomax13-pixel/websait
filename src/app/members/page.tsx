'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Users, Crown, UserCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export default function MembersPage() {
    const { user, loading: authLoading } = useAuth()
    const [members, setMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchMembers() {
            if (!user) return

            // Get current user's circle
            const { data: profile } = await supabase
                .from('profiles')
                .select('circle_id')
                .eq('user_id', user.id)
                .single()

            if (!profile?.circle_id) return

            // Get all members in the same circle
            const { data } = await supabase
                .from('profiles')
                .select('user_id, display_name, role')
                .eq('circle_id', profile.circle_id)
                .order('role', { ascending: false }) // owners first
                .order('display_name')

            setMembers(data || [])
            setLoading(false)
        }

        if (!authLoading) fetchMembers()
    }, [user, authLoading, supabase])

    if (loading) return null

    const ownerCount = members.filter(m => m.role === 'owner').length
    const memberCount = members.filter(m => m.role === 'member').length

    return (
        <div className="p-6 space-y-6 pb-24">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-8 bg-[var(--knot-gold)] rounded-full" />
                    <h1 className="text-2xl font-bold">メンバー一覧</h1>
                </div>
                <div className="flex gap-3 text-sm text-gray-500 font-medium">
                    <span className="bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">総数: {members.length}</span>
                    <span className="bg-[var(--knot-gold)]/10 text-[var(--knot-gold)] px-3 py-1 rounded-full">管理者: {ownerCount}</span>
                </div>
            </header>

            <div className="space-y-3">
                {members.map((member) => (
                    <Card
                        key={member.user_id}
                        className={`flex items-center justify-between border-none shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.05)] transition-all ${member.role === 'owner' ? 'bg-gradient-to-r from-white to-[var(--knot-gold)]/5 ring-1 ring-[var(--knot-gold)]/20' : 'bg-white'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${member.role === 'owner'
                                    ? 'bg-gradient-to-br from-[var(--knot-gold)] to-[#8C7A4A] text-white'
                                    : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500'
                                }`}>
                                {member.role === 'owner' ? (
                                    <Crown size={20} />
                                ) : (
                                    <UserCircle size={24} />
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-lg">{member.display_name}</p>
                                <p className={`text-xs font-bold ${member.role === 'owner' ? 'text-[var(--knot-gold)]' : 'text-gray-400'}`}>
                                    {member.role === 'owner' ? 'Administrator' : 'Member'}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {members.length === 0 && (
                <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <p>メンバーがいません</p>
                </div>
            )}
        </div>
    )
}
