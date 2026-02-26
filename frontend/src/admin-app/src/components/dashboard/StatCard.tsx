/**
 * StatCard - Reusable stat card component for displaying metrics
 *
 * Features:
 * - Displays title, value, optional icon, description, and trend
 * - Responsive design with dark/light theme support
 * - Uses shadcn/ui Card component as base
 */

import { Card, CardContent } from "@/components/ui/card"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react"

/**
 * StatCard component props
 */
export interface StatCardProps {
    /** Card title displayed below the value */
    title: string
    /** Main value displayed prominently (number or string) */
    value: number | string
    /** Optional icon displayed on the card */
    icon?: React.ReactNode
    /** Optional description text in muted color */
    description?: string
    /** Optional trend indicator (up, down, or neutral) */
    trend?: 'up' | 'down' | 'neutral'
    /** Optional trend value text (e.g., "+12%" or "-5%") */
    trendValue?: string
}

/**
 * StatCard component for displaying system metrics
 */
export function StatCard({
    title,
    value,
    icon,
    description,
    trend,
    trendValue,
}: StatCardProps) {
    // Trend icon and color based on trend type
    const getTrendIndicator = () => {
        if (!trend) return null

        const trendClasses = {
            up: 'text-green-500',
            down: 'text-red-500',
            neutral: 'text-muted-foreground',
        }

        const trendIcons = {
            up: <ArrowUpIcon className="h-4 w-4" />,
            down: <ArrowDownIcon className="h-4 w-4" />,
            neutral: <ArrowRightIcon className="h-4 w-4" />,
        }

        return (
            <span className={`flex items-center gap-1 ${trendClasses[trend]}`}>
                {trendIcons[trend]}
                {trendValue && <span className="text-sm font-medium">{trendValue}</span>}
            </span>
        )
    }

    return (
        <Card className="bg-card/50 border rounded-lg">
            <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        {/* Value - prominently displayed */}
                        <div className="text-4xl font-bold mb-1">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </div>

                        {/* Title */}
                        <div className="text-sm text-muted-foreground mb-1">
                            {title}
                        </div>

                        {/* Description (optional) */}
                        {description && (
                            <div className="text-xs text-muted-foreground">
                                {description}
                            </div>
                        )}

                        {/* Trend indicator (optional) */}
                        {trend && (
                            <div className="mt-2">
                                {getTrendIndicator()}
                            </div>
                        )}
                    </div>

                    {/* Icon (optional) */}
                    {icon && (
                        <div className="text-muted-foreground opacity-70">
                            {icon}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
