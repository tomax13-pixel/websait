'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import {
    RefreshCw, UserPlus, ShieldCheck, Pencil, Check, X,
    Link2, Copy, Trash2, Globe, Mail, Clock, Users
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

type InviteLink = {
    id: string
    token: string
    email_domain: string | null
    max_uses: number | null
    current_uses: number
    expires_at: string | null
    is_active: boolean
    created_at: string
}

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<any>(null)
    const [organization, setOrganization] = useState<any>(null)
    const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [isEditingName, setIsEditingName] = useState(false)
    const [editedName, setEditedName] = useState('')
    const [savingName, setSavingName] = useState(false)
    const [showInviteForm, setShowInviteForm] = useState(false)
    const [newLinkDomain, setNewLinkDomain] = useState('')
    const [newLinkMaxUses, setNewLinkMaxUses] = useState('')
    const [newLinkExpiry, setNewLinkExpiry] = useState('')
    const [creatingLink, setCreatingLink] = useState(false)
    const [copiedToken, setCopiedToken] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const fetchAdminData = useCallback(async () => {
        if (!user) return
        const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
        if (prof?.role !== 'owner' && prof?.role !== 'admin') {
            router.push('/home')
            return
        }
        setProfile(prof)

        if (prof.organization_id) {
            const { data: org } = await supabase.from('organizations').select('*').eq('id', prof.organization_id).single()
            setOrganization(org)
            setEditedName(org?.name || '')

            // Fetch invite links
            const { data: links } = await supabase
                .from('invite_links')
                .select('*')
                .eq('organization_id', prof.organization_id)
                .order('created_at', { ascending: false })
            setInviteLinks(links || [])
        }

        setLoading(false)
    }, [user, router, supabase])

    useEffect(() => {
        if (!authLoading) fetchAdminData()
    }, [authLoading, fetchAdminData])

    const regenerateJoinCode = async () => {
        if (!organization) return
        setUpdating(true)
        const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()
        const { error } = await supabase
            .from('organizations')
            .update({ join_code: newCode })
            .eq('id', organization.id)

        if (!error) setOrganization({ ...organization, join_code: newCode })
        setUpdating(false)
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        alert(`${inviteEmail} への招待機能は Edge Function 実装後に有効化されます。`)
        setInviteEmail('')
    }

    const handleSaveName = async () => {
        if (!organization || !editedName.trim()) return
        setSavingName(true)

        const { error } = await supabase
            .from('organizations')
            .update({ name: editedName.trim() })
            .eq('id', organization.id)

        if (!error) {
            setOrganization({ ...organization, name: editedName.trim() })
            setIsEditingName(false)
        } else {
            alert('保存に失敗しました: ' + error.message)
        }
        setSavingName(false)
    }

    const handleCancelEdit = () => {
        setEditedName(organization?.name || '')
        setIsEditingName(false)
    }

    const createInviteLink = async () => {
        if (!organization) return
        setCreatingLink(true)

        const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        const { error } = await supabase
            .from('invite_links')
            .insert({
                organization_id: organization.id,
                token,
                email_domain: newLinkDomain || null,
                max_uses: newLinkMaxUses ? parseInt(newLinkMaxUses) : null,
                expires_at: newLinkExpiry ? new Date(newLinkExpiry).toISOString() : null,
                created_by: user!.id,
            })

        if (!error) {
            setShowInviteForm(false)
            setNewLinkDomain('')
            setNewLinkMaxUses('')
            setNewLinkExpiry('')
            fetchAdminData()
        } else {
            alert('リンクの作成に失敗しました: ' + error.message)
        }
        setCreatingLink(false)
    }

    const copyInviteLink = async (token: string) => {
        const url = `${window.location.origin}/onboarding?invite=${token}`
        await navigator.clipboard.writeText(url)
        setCopiedToken(token)
        setTimeout(() => setCopiedToken(null), 2000)
    }

    const deleteInviteLink = async (id: string) => {
        if (!confirm('この招待リンクを削除しますか？')) return
        await supabase.from('invite_links').delete().eq('id', id)
        fetchAdminData()
    }

    const toggleInviteLink = async (id: string, isActive: boolean) => {
        await supabase.from('invite_links').update({ is_active: !isActive }).eq('id', id)
        fetchAdminData()
    }

    if (loading) return null

    return (
        <div className="p-6 space-y-8 pb-24">
            <header className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">管理者設定</h1>
            </header>

            {/* Join Code Section */}
            <section className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">現在の招待コード</p>
                    <h2 className="text-4xl font-black mb-6">{organization?.join_code}</h2>
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

            {/* Invite Links Section */}
            <section className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-gray-900">
                        <Link2 size={20} /> 招待リンク
                    </h3>
                    <button
                        onClick={() => setShowInviteForm(!showInviteForm)}
                        className="bg-[var(--knot-gold)] text-white px-4 py-2 rounded-full text-xs font-bold hover:opacity-90 transition-all"
                    >
                        + 新規リンク
                    </button>
                </div>

                {/* Create Form */}
                {showInviteForm && (
                    <Card className="bg-white border-none shadow-md space-y-4">
                        <h4 className="font-bold text-sm">新しい招待リンクを作成</h4>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1">
                                <Mail size={12} className="inline mr-1" />
                                メールドメイン制限（任意）
                            </label>
                            <input
                                type="text"
                                value={newLinkDomain}
                                onChange={(e) => setNewLinkDomain(e.target.value)}
                                className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] text-sm"
                                placeholder="例: university.ac.jp（空欄で制限なし）"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">
                                    <Users size={12} className="inline mr-1" />
                                    最大使用回数
                                </label>
                                <input
                                    type="number"
                                    value={newLinkMaxUses}
                                    onChange={(e) => setNewLinkMaxUses(e.target.value)}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] text-sm"
                                    placeholder="無制限"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">
                                    <Clock size={12} className="inline mr-1" />
                                    有効期限
                                </label>
                                <input
                                    type="datetime-local"
                                    value={newLinkExpiry}
                                    onChange={(e) => setNewLinkExpiry(e.target.value)}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={createInviteLink}
                                disabled={creatingLink}
                                className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm"
                            >
                                {creatingLink ? '作成中...' : 'リンクを作成'}
                            </button>
                            <button
                                onClick={() => setShowInviteForm(false)}
                                className="py-3 px-4 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                            >
                                キャンセル
                            </button>
                        </div>
                    </Card>
                )}

                {/* Existing Links */}
                {inviteLinks.length > 0 ? (
                    <div className="space-y-3">
                        {inviteLinks.map(link => (
                            <Card key={link.id} className={cn(
                                "border-none shadow-sm",
                                link.is_active ? "bg-white" : "bg-gray-50 opacity-60"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn(
                                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                link.is_active ? "bg-green-50 text-green-700" : "bg-gray-200 text-gray-500"
                                            )}>
                                                {link.is_active ? '有効' : '無効'}
                                            </span>
                                            {link.email_domain && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-1">
                                                    <Mail size={8} />
                                                    @{link.email_domain}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 font-mono truncate">
                                            ...{link.token.substring(link.token.length - 12)}
                                        </p>
                                        <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                                            <span>使用: {link.current_uses}{link.max_uses ? `/${link.max_uses}` : ''}</span>
                                            {link.expires_at && (
                                                <span>期限: {new Date(link.expires_at).toLocaleDateString('ja-JP')}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        <button
                                            onClick={() => copyInviteLink(link.token)}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            title="リンクをコピー"
                                        >
                                            {copiedToken === link.token ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                        </button>
                                        <button
                                            onClick={() => toggleInviteLink(link.id, link.is_active)}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            title={link.is_active ? '無効化' : '有効化'}
                                        >
                                            <Globe size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteInviteLink(link.id)}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="削除"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 italic text-center py-4">
                        招待リンクはまだありません
                    </p>
                )}
            </section>

            <div className="space-y-6">
                <section className="space-y-4">
                    <h3 className="font-bold flex items-center gap-2 text-gray-900">
                        <UserPlus size={20} /> 管理者（代表）の追加
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
                        ※ 招待されたユーザーは、登録時に「代表権限」が付与されます。
                    </p>
                </section>

                <section className="space-y-4 pt-4 border-t border-gray-100">
                    <h3 className="font-bold text-gray-900">組織情報</h3>
                    <div className="space-y-2">
                        {/* Editable Organization Name */}
                        <div className="p-4 bg-gray-50 rounded-xl text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">組織名</span>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={editedName}
                                            onChange={(e) => setEditedName(e.target.value)}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-black focus:outline-none w-40"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSaveName}
                                            disabled={savingName || !editedName.trim()}
                                            className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                                        >
                                            {savingName ? (
                                                <RefreshCw size={16} className="animate-spin" />
                                            ) : (
                                                <Check size={16} />
                                            )}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="p-1.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{organization?.name}</span>
                                        <button
                                            onClick={() => setIsEditingName(true)}
                                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between p-4 bg-gray-50 rounded-xl text-sm">
                            <span className="text-gray-500">プラン</span>
                            <span className="font-bold">{organization?.plan === 'pro' ? 'Pro' : 'Free'}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-gray-50 rounded-xl text-sm">
                            <span className="text-gray-500">メンバー上限</span>
                            <span className="font-bold">{organization?.member_limit}人</span>
                        </div>
                        <div className="flex justify-between p-4 bg-gray-50 rounded-xl text-sm">
                            <span className="text-gray-500">作成日</span>
                            <span className="font-bold">{new Date(organization?.created_at).toLocaleDateString('ja-JP')}</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
