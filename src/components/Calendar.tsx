'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarProps {
    events: Array<{ id: string; datetime: string; title: string }>
    onDateSelect?: (date: Date, events: Array<{ id: string; datetime: string; title: string }>) => void
}

export function Calendar({ events, onDateSelect }: CalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date())

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // Get first day of month and total days
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday

    // Group events by date string (YYYY-MM-DD)
    const eventsByDate = useMemo(() => {
        const map = new Map<string, typeof events>()
        events.forEach(event => {
            const dateKey = new Date(event.datetime).toISOString().split('T')[0]
            const existing = map.get(dateKey) || []
            map.set(dateKey, [...existing, event])
        })
        return map
    }, [events])

    const days = useMemo(() => {
        const result: Array<{ day: number; date: Date; events: typeof events }> = []

        // Empty slots for days before the first day of month
        for (let i = 0; i < startingDayOfWeek; i++) {
            result.push({ day: 0, date: new Date(), events: [] })
        }

        // Actual days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day)
            const dateKey = date.toISOString().split('T')[0]
            result.push({
                day,
                date,
                events: eventsByDate.get(dateKey) || []
            })
        }

        return result
    }, [year, month, daysInMonth, startingDayOfWeek, eventsByDate])

    const goToPreviousMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1))
    }

    const goToNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1))
    }

    const isToday = (date: Date) => {
        const today = new Date()
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
    }

    const weekDays = ['日', '月', '火', '水', '木', '金', '土']

    return (
        <div className="bg-white rounded-2xl shadow-sm p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={goToPreviousMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <h3 className="text-lg font-bold">
                    {year}年 {month + 1}月
                </h3>
                <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((day, i) => (
                    <div
                        key={day}
                        className={`text-center text-xs font-bold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                            }`}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((item, index) => (
                    <button
                        key={index}
                        disabled={item.day === 0}
                        onClick={() => item.day > 0 && onDateSelect?.(item.date, item.events)}
                        className={`
                            aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all
                            ${item.day === 0 ? 'invisible' : 'hover:bg-gray-50 active:scale-95'}
                            ${isToday(item.date) ? 'bg-[var(--knot-red)] text-white hover:bg-[var(--knot-red)]' : ''}
                        `}
                    >
                        {item.day > 0 && (
                            <>
                                <span>{item.day}</span>
                                {item.events.length > 0 && (
                                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isToday(item.date) ? 'bg-white' : 'bg-[var(--knot-gold)]'}`} />
                                )}
                            </>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}
