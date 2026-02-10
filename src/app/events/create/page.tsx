'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notifyEventCreated } from '@/lib/notifications'

const CANCEL_POLICY_OPTIONS = [
    { value: 'free', label: '自由キャンセル', desc: 'いつでもキャンセル可能' },
    { value: 'deadline_only', label: '締切後キャンセル不可', desc: '回答締切後は変更不可' },
    { value: 'penalty', label: 'ペナルティあり', desc: '締切後のキャンセルにペナルティ' },
]

export default function CreateEventPage() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const [formData, setFormData] = useState({
        title: '',
        datetime: '',
        place: '',
        fee: '0',
        note: '',
        rsvp_deadline: '',
        capacity: '',
        cancel_policy: 'free',
        cancel_fee: '0',
    })

    useEffect(() => {
        async function fetchProfile() {
            if (!user) return
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (data?.role !== 'owner' && data?.role !== 'admin') {
                router.push('/events')
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
        if (!profile?.organization_id) return
        setLoading(true)
        setError(null)

        try {
            const { data: event, error: eventError } = await supabase
                .from('events')
                .insert({
                    organization_id: profile.organization_id,
                    title: formData.title,
                    datetime: new Date(formData.datetime).toISOString(),
                    place: formData.place,
                    fee: parseInt(formData.fee),
                    note: formData.note,
                    rsvp_deadline: new Date(formData.rsvp_deadline).toISOString(),
                    created_by: user!.id,
                    capacity: formData.capacity ? parseInt(formData.capacity) : null,
                    cancel_policy: formData.cancel_policy,
                    cancel_fee: formData.cancel_policy === 'penalty' ? parseInt(formData.cancel_fee) : 0,
                })
                .select()
                .single()

            if (eventError) throw eventError

            // Send browser notification
            notifyEventCreated(
                formData.title,
                new Date(formData.datetime).toLocaleString('ja-JP'),
                formData.place
            )

            router.push(`/events/${event.id}`)
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
                <Link href="/events" className="text-gray-400 hover:text-black">
                    <ChevronLeft size={24} />
                </Link>
                <h1 className="text-2xl font-bold">イベント作成</h1>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700">タイトル</label>
                    <input
                        type="text"
                        required
                        className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="練習会、飲み会など"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">日時</label>
                        <input
                            type="datetime-local"
                            required
                            className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                            value={formData.datetime}
                            onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">回答締切</label>
                        <input
                            type="datetime-local"
                            required
                            className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                            value={formData.rsvp_deadline}
                            onChange={(e) => setFormData({ ...formData, rsvp_deadline: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">場所</label>
                    <input
                        type="text"
                        className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                        value={formData.place}
                        onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                        placeholder="施設名、教室番号など"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">参加費 (円)</label>
                        <input
                            type="number"
                            required
                            className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                            value={formData.fee}
                            onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">定員</label>
                        <input
                            type="number"
                            className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                            placeholder="制限なし"
                            min="1"
                        />
                    </div>
                </div>

                {/* Cancel Policy */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">キャンセルポリシー</label>
                    <div className="space-y-2">
                        {CANCEL_POLICY_OPTIONS.map(option => (
                            <label
                                key={option.value}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${formData.cancel_policy === option.value
                                    ? 'border-black bg-gray-50'
                                    : 'border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="cancel_policy"
                                    value={option.value}
                                    checked={formData.cancel_policy === option.value}
                                    onChange={(e) => setFormData({ ...formData, cancel_policy: e.target.value })}
                                    className="accent-black"
                                />
                                <div>
                                    <p className="font-bold text-sm">{option.label}</p>
                                    <p className="text-xs text-gray-400">{option.desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Cancel Fee (only shown for penalty policy) */}
                {formData.cancel_policy === 'penalty' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">キャンセル料 (円)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                            value={formData.cancel_fee}
                            onChange={(e) => setFormData({ ...formData, cancel_fee: e.target.value })}
                            min="0"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700">備考</label>
                    <textarea
                        className="mt-1 block w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black"
                        rows={3}
                        value={formData.note}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-black text-white font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                    {loading ? '作成中...' : 'イベントを作成する'}
                </button>
            </form>
        </div>
    )
}
