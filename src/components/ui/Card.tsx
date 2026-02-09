import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    noPadding?: boolean
}

export function Card({ children, className, noPadding = false, ...props }: CardProps) {
    return (
        <div
            className={cn(
                "bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md",
                noPadding ? "" : "p-5",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
}
