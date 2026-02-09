'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'

export default function OnboardingPage() {
    const { user, loading: authLoading } = useAuth()
    const [displayName, setDisplayName] = useState('')
    const [mode, setMode] = useState<'join' | 'create' | null>(null)
    const [circleName, setCircleName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login')
        }
    }, [user, authLoading, router])

    const handleOnboarding = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return
        setLoading(true)
        setError(null)

        try {
            let circleId = ''
            const role = user.user_metadata.role || 'member'

            if (mode === 'create') {
                if (role !== 'owner') throw new Error('オーナー権限が必要です。')

                // Use secure RPC to create circle
                const { data: result, error: rpcError } = await supabase
                    .rpc('create_circle_secure', { c_name: circleName })

                if (rpcError) throw rpcError

                // result is JSONB, so cast it or access it carefully
                const newCircle = result as any
                circleId = newCircle.id
            } else {
                // Use secure RPC to join circle
                const { data: result, error: rpcError } = await supabase
                    .rpc('join_circle_secure', { code: joinCode })

                if (rpcError) throw new Error('招待コードが無効です。')

                const foundCircle = result as any
                circleId = foundCircle.id
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    user_id: user.id,
                    circle_id: circleId,
                    role,
                    display_name: displayName,
                })

            if (profileError) throw profileError

            router.push('/home')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (authLoading) return null

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900">ようこそ</h2>
                    <p className="mt-2 text-sm text-gray-600">プロフィールの設定を完了しましょう</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleOnboarding}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">表示名 (本名など)</label>
                            <input
                                type="text"
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />
                        </div>

                        {!mode ? (
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setMode('join')}
                                    className="p-4 border-2 border-gray-100 rounded-xl hover:border-black transition-colors"
                                >
                                    <p className="font-bold">サークルに参加</p>
                                    <p className="text-xs text-gray-500">招待コードをお持ちの方</p>
                                </button>
                                {user?.user_metadata.role === 'owner' && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('create')}
                                        className="p-4 border-2 border-gray-100 rounded-xl hover:border-black transition-colors"
                                    >
                                        <p className="font-bold">サークルを作成</p>
                                        <p className="text-xs text-gray-500">新しく団体を立ち上げる方</p>
                                    </button>
                                )}
                            </div>
                        ) : mode === 'create' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">サークル名</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                                    value={circleName}
                                    onChange={(e) => setCircleName(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setMode(null)}
                                    className="mt-2 text-xs text-gray-500 underline"
                                >
                                    戻る
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">招待コード</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setMode(null)}
                                    className="mt-2 text-xs text-gray-500 underline"
                                >
                                    戻る
                                </button>
                            </div>
                        )}
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || !mode}
                        className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:opacity-50"
                    >
                        {loading ? '処理中...' : 'はじめる'}
                    </button>
                </form>
            </div>
        </div>
    )
}
