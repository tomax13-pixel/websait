'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import {
    Users, Crown, UserCircle, Briefcase, ShieldCheck,
    Search, Filter, ChevronDown, ChevronUp, TrendingUp, AlertTriangle,
    Calendar, Mail, Phone, Edit3, X, Check, RefreshCw, Trash2, ShieldPlus, ShieldMinus
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    owner: { label: '代表', icon: Crown, color: 'text-[var(--knot-gold)]', bgColor: 'bg-gradient-to-br from-[var(--knot-gold)] to-[#8C7A4A]' },
    admin: { label: '幹部', icon: ShieldCheck, color: 'text-blue-600', bgColor: 'bg-gradient-to-br from-blue-500 to-blue-700' },
    member: { label: '一般', icon: UserCircle, color: 'text-gray-400', bgColor: 'bg-gradient-to-br from-gray-100 to-gray-200' },
}

const GRADE_LABELS: Record<string, string> = {
    B1: '学部1年', B2: '学部2年', B3: '学部3年', B4: '学部4年',
    M1: '修士1年', M2: '修士2年', D1: '博士1年', D2: '博士2年', D3: '博士3年',
    other: 'その他'
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: '在籍', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    on_leave: { label: '休会', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
    withdrawn: { label: '退会', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
}

type MemberData = {
    member_id: string
    organization_id: string
    user_id: string
    role: string
    grade: string | null
    position: string | null
    contact_email: string | null
    contact_phone: string | null
    joined_at: string | null
    membership_status: string
    display_name: string
    attendance_rate: number
    unpaid_count: number
    total_rsvps: number
    attended_count: number
}

type EditingMember = {
    member_id: string
    grade: string
    position: string
    contact_email: string
    contact_phone: string
    membership_status: string
    role: string
}

export default function MembersPage() {
    const { user, loading: authLoading } = useAuth()
    const [members, setMembers] = useState<MemberData[]>([])
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [expandedMember, setExpandedMember] = useState<string | null>(null)
    const [editingMember, setEditingMember] = useState<EditingMember | null>(null)
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    const fetchMembers = useCallback(async () => {
        if (!user) return

        const { data: prof } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('user_id', user.id)
            .single()

        if (!prof?.organization_id) return
        setProfile(prof)

        // Fetch from member_stats view
        const { data, error } = await supabase
            .from('member_stats')
            .select('*')
            .eq('organization_id', prof.organization_id)
            .order('role')
            .order('display_name')

        if (!error && data) {
            setMembers(data as MemberData[])
        } else {
            // Fallback: fetch from organization_members with profiles join
            const { data: fallbackData } = await supabase
                .from('organization_members')
                .select('*, profiles(display_name)')
                .eq('organization_id', prof.organization_id)
                .order('role')

            if (fallbackData) {
                setMembers(fallbackData.map((m: any) => ({
                    member_id: m.id,
                    organization_id: m.organization_id,
                    user_id: m.user_id,
                    role: m.role,
                    grade: m.grade,
                    position: m.position,
                    contact_email: m.contact_email,
                    contact_phone: m.contact_phone,
                    joined_at: m.joined_at,
                    membership_status: m.membership_status || 'active',
                    display_name: m.profiles?.display_name || '不明',
                    attendance_rate: 0,
                    unpaid_count: 0,
                    total_rsvps: 0,
                    attended_count: 0,
                })))
            }
        }
        setLoading(false)
    }, [user, supabase])

    useEffect(() => {
        if (!authLoading) fetchMembers()
    }, [authLoading, fetchMembers])

    const handleEdit = (member: MemberData) => {
        setEditingMember({
            member_id: member.member_id,
            grade: member.grade || '',
            position: member.position || '',
            contact_email: member.contact_email || '',
            contact_phone: member.contact_phone || '',
            membership_status: member.membership_status,
            role: member.role,
        })
    }

    const handleSave = async () => {
        if (!editingMember) return
        setSaving(true)

        const { error } = await supabase
            .from('organization_members')
            .update({
                grade: editingMember.grade || null,
                position: editingMember.position || null,
                contact_email: editingMember.contact_email || null,
                contact_phone: editingMember.contact_phone || null,
                membership_status: editingMember.membership_status,
                role: editingMember.role,
            })
            .eq('id', editingMember.member_id)

        if (!error) {
            const member = members.find(m => m.member_id === editingMember.member_id)
            if (member) {
                await supabase
                    .from('profiles')
                    .update({ role: editingMember.role })
                    .eq('user_id', member.user_id)
            }
            setEditingMember(null)
            fetchMembers()
        }
        setSaving(false)
    }

    const handleRoleToggle = async (member: MemberData) => {
        const newRole = member.role === 'admin' ? 'member' : 'admin'
        const label = newRole === 'admin' ? '幹部' : '一般'
        if (!confirm(`${member.display_name} を「${label}」に変更しますか？`)) return

        const { error } = await supabase.rpc('update_member_role', {
            target_user_id: member.user_id,
            new_role: newRole,
        })

        if (error) {
            alert('ロール変更に失敗しました: ' + error.message)
        } else {
            fetchMembers()
        }
    }

    const handleRemoveMember = async (member: MemberData) => {
        if (!confirm(`${member.display_name} をサークルから削除しますか？\nこの操作は取り消せません。`)) return

        const { error } = await supabase.rpc('remove_member', {
            target_user_id: member.user_id,
        })

        if (error) {
            alert('削除に失敗しました: ' + error.message)
        } else {
            fetchMembers()
        }
    }

    const isManager = profile?.role === 'owner' || profile?.role === 'admin'

    // Filter & search
    const filteredMembers = members.filter(m => {
        const matchesSearch = m.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.position?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || m.membership_status === statusFilter
        return matchesSearch && matchesStatus
    })

    const roleOrder = ['owner', 'admin', 'member']
    const sortedMembers = [...filteredMembers].sort((a, b) => {
        return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
    })

    if (loading) return null

    const activeCount = members.filter(m => m.membership_status === 'active').length
    const onLeaveCount = members.filter(m => m.membership_status === 'on_leave').length

    return (
        <div className="p-6 space-y-6 pb-24">
            <header className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-8 bg-[var(--knot-gold)] rounded-full" />
                    <h1 className="text-2xl font-bold">メンバー台帳</h1>
                </div>
                <div className="flex gap-2 text-sm text-gray-500 font-medium self-start sm:self-auto">
                    <span className="bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">在籍: {activeCount}</span>
                    {onLeaveCount > 0 && (
                        <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full border border-yellow-200">休会: {onLeaveCount}</span>
                    )}
                </div>
            </header>

            {/* Search & Filter */}
            <div className="space-y-3">
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="名前・役職で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100 focus:ring-2 focus:ring-[var(--knot-gold)] text-sm"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {[
                        { key: 'all', label: 'すべて' },
                        { key: 'active', label: '在籍' },
                        { key: 'on_leave', label: '休会' },
                        { key: 'withdrawn', label: '退会' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                                statusFilter === f.key
                                    ? "bg-black text-white"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Members List */}
            <div className="space-y-3">
                {sortedMembers.map((member) => {
                    const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member
                    const RoleIcon = roleConfig.icon
                    const statusConfig = STATUS_CONFIG[member.membership_status] || STATUS_CONFIG.active
                    const isExpanded = expandedMember === member.member_id

                    return (
                        <Card
                            key={member.member_id}
                            className={cn(
                                "border-none shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.05)] transition-all",
                                member.role === 'owner' ? 'bg-gradient-to-r from-white to-[var(--knot-gold)]/5 ring-1 ring-[var(--knot-gold)]/20' : 'bg-white'
                            )}
                        >
                            {/* Main Row */}
                            <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedMember(isExpanded ? null : member.member_id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center shadow-sm",
                                        member.role === 'member' ? 'text-gray-500' : 'text-white',
                                        roleConfig.bgColor
                                    )}>
                                        <RoleIcon size={member.role === 'owner' ? 20 : 24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-lg">{member.display_name}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={cn("text-xs font-bold", roleConfig.color)}>{roleConfig.label}</span>
                                            {member.grade && (
                                                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {GRADE_LABELS[member.grade] || member.grade}
                                                </span>
                                            )}
                                            {member.position && (
                                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{member.position}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Stats Badges */}
                                    <div className="hidden sm:flex items-center gap-2">
                                        {member.total_rsvps > 0 && (
                                            <span className={cn(
                                                "text-[10px] font-bold px-2 py-1 rounded-full",
                                                member.attendance_rate >= 70 ? "bg-green-50 text-green-600" :
                                                    member.attendance_rate >= 40 ? "bg-yellow-50 text-yellow-600" :
                                                        "bg-red-50 text-red-600"
                                            )}>
                                                出席 {member.attendance_rate}%
                                            </span>
                                        )}
                                        {member.unpaid_count > 0 && (
                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 flex items-center gap-1">
                                                <AlertTriangle size={10} />
                                                未払{member.unpaid_count}件
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", statusConfig.bg, statusConfig.color)}>
                                        {statusConfig.label}
                                    </span>
                                    {isExpanded ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                                    {/* Stats (mobile) */}
                                    <div className="sm:hidden flex gap-2 flex-wrap">
                                        {member.total_rsvps > 0 && (
                                            <span className={cn(
                                                "text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1",
                                                member.attendance_rate >= 70 ? "bg-green-50 text-green-600" :
                                                    member.attendance_rate >= 40 ? "bg-yellow-50 text-yellow-600" :
                                                        "bg-red-50 text-red-600"
                                            )}>
                                                <TrendingUp size={12} />
                                                出席率 {member.attendance_rate}%
                                            </span>
                                        )}
                                        {member.unpaid_count > 0 && (
                                            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-600 flex items-center gap-1">
                                                <AlertTriangle size={12} />
                                                未払い {member.unpaid_count}件
                                            </span>
                                        )}
                                    </div>

                                    {/* Detail Grid */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {member.contact_email && (
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Mail size={14} className="text-gray-400" />
                                                <span className="truncate">{member.contact_email}</span>
                                            </div>
                                        )}
                                        {member.contact_phone && (
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Phone size={14} className="text-gray-400" />
                                                <span>{member.contact_phone}</span>
                                            </div>
                                        )}
                                        {member.joined_at && (
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar size={14} className="text-gray-400" />
                                                <span>入会: {new Date(member.joined_at).toLocaleDateString('ja-JP')}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <TrendingUp size={14} className="text-gray-400" />
                                            <span>参加 {member.attended_count}/{member.total_rsvps} 回</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons (Manager only) */}
                                    {isManager && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(member) }}
                                                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full"
                                            >
                                                <Edit3 size={14} />
                                                編集
                                            </button>
                                            {member.role !== 'owner' && member.user_id !== user?.id && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRoleToggle(member) }}
                                                        className={cn(
                                                            "flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full transition-colors",
                                                            member.role === 'admin'
                                                                ? "text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
                                                                : "text-blue-700 bg-blue-50 hover:bg-blue-100"
                                                        )}
                                                    >
                                                        {member.role === 'admin' ? <ShieldMinus size={14} /> : <ShieldPlus size={14} />}
                                                        {member.role === 'admin' ? '一般に変更' : '幹部にする'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(member) }}
                                                        className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                        削除
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    )
                })}
            </div>

            {sortedMembers.length === 0 && (
                <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <p>{searchQuery ? '検索結果がありません' : 'メンバーがいません'}</p>
                </div>
            )}

            {/* Edit Modal */}
            {editingMember && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingMember(null)}>
                    <div
                        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">メンバー情報編集</h3>
                            <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">ロール</label>
                                <select
                                    value={editingMember.role}
                                    onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] font-bold"
                                >
                                    <option value="owner">代表</option>
                                    <option value="admin">幹部</option>
                                    <option value="member">一般</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">学年</label>
                                <select
                                    value={editingMember.grade}
                                    onChange={(e) => setEditingMember({ ...editingMember, grade: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] font-bold"
                                >
                                    <option value="">未設定</option>
                                    {Object.entries(GRADE_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">役職名</label>
                                <input
                                    type="text"
                                    value={editingMember.position}
                                    onChange={(e) => setEditingMember({ ...editingMember, position: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] font-bold"
                                    placeholder="部長、副部長など"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">メールアドレス</label>
                                <input
                                    type="email"
                                    value={editingMember.contact_email}
                                    onChange={(e) => setEditingMember({ ...editingMember, contact_email: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] font-bold"
                                    placeholder="example@university.ac.jp"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">電話番号</label>
                                <input
                                    type="tel"
                                    value={editingMember.contact_phone}
                                    onChange={(e) => setEditingMember({ ...editingMember, contact_phone: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] font-bold"
                                    placeholder="090-xxxx-xxxx"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">在籍ステータス</label>
                                <select
                                    value={editingMember.membership_status}
                                    onChange={(e) => setEditingMember({ ...editingMember, membership_status: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-[var(--knot-gold)] font-bold"
                                >
                                    <option value="active">在籍</option>
                                    <option value="on_leave">休会</option>
                                    <option value="withdrawn">退会</option>
                                </select>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-4 bg-black text-white font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <><RefreshCw size={16} className="animate-spin" /> 保存中...</>
                                ) : (
                                    <><Check size={16} /> 保存</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
