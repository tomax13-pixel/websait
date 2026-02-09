'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Megaphone, CreditCard, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
    { name: 'ホーム', href: '/home', icon: Home },
    { name: 'イベント', href: '/events', icon: Calendar },
    { name: 'メンバー', href: '/members', icon: Users },
    { name: 'お知らせ', href: '/announcements', icon: Megaphone },
    { name: '管理', href: '/admin', icon: Settings },
]

export function BottomNav() {
    const pathname = usePathname()

    if (pathname === '/login' || pathname === '/onboarding') return null

    return (
        <nav className="fixed bottom-0 left-0 right-0 glass pb-safe-area-inset-bottom z-50">
            <div className="flex justify-around items-center h-20 max-w-md mx-auto px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300",
                                isActive ? "text-[var(--knot-red)] -translate-y-1" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            {isActive && (
                                <div className="absolute -top-1 w-8 h-1 bg-[var(--knot-red)] rounded-full shadow-[0_0_10px_var(--knot-red)]" />
                            )}
                            <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "drop-shadow-sm" : ""} />
                            <span className="text-[10px] font-bold tracking-wide">{item.name}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
