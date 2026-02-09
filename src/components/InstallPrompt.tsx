'use client'

import { useEffect, useState } from 'react'
import { Share, PlusSquare, X, Download } from 'lucide-react'

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        // Check if iOS
        const userAgent = window.navigator.userAgent.toLowerCase()
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
        setIsIOS(isIosDevice)

        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
        if (isStandalone) return

        // Check if recently dismissed
        const dismissedAt = localStorage.getItem('installPromptDismissedAt')
        if (dismissedAt) {
            const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
            if (daysSinceDismissed < 7) return
        }

        if (isIosDevice) {
            // Show custom prompt for iOS after a delay
            setTimeout(() => setShowPrompt(true), 3000)
        } else {
            // Android / Desktop: Listen for beforeinstallprompt
            const handler = (e: any) => {
                e.preventDefault()
                setDeferredPrompt(e)
                setShowPrompt(true)
            }
            window.addEventListener('beforeinstallprompt', handler)
            return () => window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        console.log(`User response to the install prompt: ${outcome}`)
        setDeferredPrompt(null)
        setShowPrompt(false)
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem('installPromptDismissedAt', Date.now().toString())
    }

    if (!mounted || !showPrompt) return null

    return (
        <div className="fixed bottom-24 left-4 right-4 z-50 transition-all duration-500 transform translate-y-0 opacity-100">
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-100 relative">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-2"
                    aria-label="閉じる"
                >
                    <X size={18} />
                </button>

                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-[var(--knot-red)] rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg mt-1">
                        <span className="text-3xl font-black">結</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg">ホームに追加</h3>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                            アプリとしてインストールすると、より便利に使えます。
                        </p>

                        {isIOS ? (
                            <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Share size={16} className="text-blue-500" />
                                    <span className="font-bold">共有</span>
                                    <span>をタップ</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <PlusSquare size={16} />
                                    <span className="font-bold">ホーム画面に追加</span>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handleInstall}
                                className="mt-3 w-full bg-[var(--knot-red)] hover:bg-[#8C1C26] active:scale-95 text-white rounded-xl h-12 text-sm font-bold shadow-md flex items-center justify-center transition-all"
                            >
                                <Download size={18} className="mr-2" />
                                インストールする
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
