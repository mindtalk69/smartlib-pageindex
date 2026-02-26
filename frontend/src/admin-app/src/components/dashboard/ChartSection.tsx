/**
 * ChartSection - Chart section with view switching for dashboard
 *
 * Features:
 * - Toggle between 4 chart types: Library Ref, Users per Library, File vs URL, Knowledge Stats
 * - Refresh button for manual data update
 * - Loading and error states
 * - Chart.js integration placeholder
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, BarChart3, PieChart, TrendingUp, Activity } from "lucide-react"

/**
 * Available chart types
 */
export type ChartType = 'library-ref' | 'users-per-library' | 'file-vs-url' | 'knowledge-stats'

/**
 * ChartSection component props
 */
export interface ChartSectionProps {
    /** Initial chart type to display */
    initialChart?: ChartType
    /** Callback function for refresh button */
    onRefresh?: () => void
    /** Loading state for refresh operation */
    isRefreshing?: boolean
}

/**
 * Chart type configuration with labels and icons
 */
const chartTypes: { id: ChartType; label: string; icon: React.ReactNode }[] = [
    { id: 'library-ref', label: 'Library Ref', icon: <PieChart className="h-4 w-4" /> },
    { id: 'users-per-library', label: 'Users per Library', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'file-vs-url', label: 'File vs URL', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'knowledge-stats', label: 'Knowledge Stats', icon: <Activity className="h-4 w-4" /> },
]

/**
 * ChartSection component with chart type toggle buttons
 */
export function ChartSection({
    initialChart = 'library-ref',
    onRefresh,
    isRefreshing = false,
}: ChartSectionProps) {
    const [selectedChart, setSelectedChart] = useState<ChartType>(initialChart)

    const handleRefresh = () => {
        if (onRefresh) {
            onRefresh()
        }
    }

    return (
        <Card className="bg-card/50 border rounded-lg">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">
                        Analytics Dashboard
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Chart type toggle buttons */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {chartTypes.map((chart) => (
                        <Button
                            key={chart.id}
                            variant={selectedChart === chart.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedChart(chart.id)}
                            className="gap-2"
                        >
                            {chart.icon}
                            {chart.label}
                        </Button>
                    ))}
                </div>

                {/* Chart area */}
                <div className="min-h-[300px] border rounded-md bg-background/50 p-4 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">
                            Chart placeholder for: <span className="font-medium">{selectedChart}</span>
                        </p>
                        <p className="text-xs mt-1">
                            Integrate Chart.js or Recharts for actual data visualization
                        </p>
                    </div>
                </div>

                {/* Loading state overlay */}
                {isRefreshing && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Refreshing data...</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
