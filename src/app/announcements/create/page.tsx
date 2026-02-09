'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function CreateAnnouncementPage() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const [formData, setFormData] = useState({
        title: '',
        body: '',
    })

    useEffect(() => {
        async function fetchProfile() {
            if (!user) return
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (data?.role !== 'owner') {
                router.push('/announcements')
            }
            setProfile(data)
        }

        if (!authLoading) {
            if (!user) router.push('/login')
            else fetchProfile()
        }
    }, [user, authLoading, router, supabase])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.circle_id) return
        setLoading(true)
        setError(null)

        try {
            const { error: annError } = await supabase
                .from('announcements')
                .insert({
                    circle_id: profile.circle_id,
                    title: formData.title,
                    body: formData.body,
                    created_by: user!.id,
                })

            if (annError) throw annError

            router.push('/announcements')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (authLoading || !profile) return null

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center gap-4">
                <Link href="/announcements" className="text-gray-400 hover:text-black">
                    <ChevronLeft size={24} />
                </Link>
                <h1 className="text-2xl font-bold">告知投稿</h1>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">タイトル</label>
                    <input
                        type="text"
                        required
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black font-bold"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="イベントについてのお知らせなど"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">本文</label>
                    <textarea
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black min-h-[200px]"
                        required
                        value={formData.body}
                        onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                        placeholder="周知したい内容を入力してください"
                    />
                </div>

                {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-black text-white font-black rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-xl active:scale-95"
                >
                    {loading ? '投稿中...' : '告知を投稿する'}
                </button>
            </form>
        </div>
    )
}
