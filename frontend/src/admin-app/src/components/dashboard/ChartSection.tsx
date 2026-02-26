/**
 * ChartSection - Chart section with view switching for dashboard
 *
 * Features:
 * - Toggle between 4 chart types: Library Ref, Users per Library, File vs URL, Knowledge Stats
 * - Refresh button for manual data update
 * - Loading and error states
 * - Recharts integration with actual data visualization
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, BarChart3, PieChart, TrendingUp, Activity } from "lucide-react"
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'

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
 * Chart data interfaces
 */
export interface LibraryRefData {
    name: string
    value: number
}

export interface UsersPerLibraryData {
    libraryName: string
    users: number
}

export interface FileVsUrlData {
    type: string
    count: number
}

export interface KnowledgeStatsData {
    knowledge: string
    documents: number
    queries: number
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
 * Color palette for pie chart segments
 */
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042']

/**
 * Mock data generators for each chart type
 */
const generateLibraryRefData = (): LibraryRefData[] => [
    { name: 'Science', value: 45 },
    { name: 'Technology', value: 32 },
    { name: 'History', value: 28 },
    { name: 'Arts', value: 15 },
    { name: 'Philosophy', value: 12 },
    { name: 'Literature', value: 22 },
]

const generateUsersPerLibraryData = (): UsersPerLibraryData[] => [
    { libraryName: 'Main Library', users: 128 },
    { libraryName: 'Science Dept', users: 85 },
    { libraryName: 'Arts Dept', users: 64 },
    { libraryName: 'Engineering', users: 92 },
    { libraryName: 'Medical', users: 56 },
]

const generateFileVsUrlData = (): FileVsUrlData[] => [
    { type: 'PDF Files', count: 245 },
    { type: 'Word Docs', count: 128 },
    { type: 'Text Files', count: 87 },
    { type: 'URLs', count: 312 },
    { type: 'Images', count: 156 },
]

const generateKnowledgeStatsData = (): KnowledgeStatsData[] => [
    { knowledge: 'AI Research', documents: 89, queries: 1245 },
    { knowledge: 'History Archive', documents: 156, queries: 892 },
    { knowledge: 'Science Papers', documents: 234, queries: 2103 },
    { knowledge: 'Literature', documents: 178, queries: 756 },
    { knowledge: 'Tech Docs', documents: 312, queries: 1876 },
]

/**
 * Render chart based on selected type
 */
const renderChart = (type: ChartType, data: any) => {
    switch (type) {
        case 'library-ref':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            label
                        >
                            {data.map((entry: LibraryRefData, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </RechartsPieChart>
                </ResponsiveContainer>
            )
        case 'users-per-library':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="libraryName" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="users" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
            )
        case 'file-vs-url':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="count" stroke="#82ca9d" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            )
        case 'knowledge-stats':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="knowledge" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="documents" fill="#8884d8" name="Documents" />
                        <Bar yAxisId="right" dataKey="queries" fill="#82ca9d" name="Queries" />
                    </BarChart>
                </ResponsiveContainer>
            )
        default:
            return null
    }
}

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

    // Memoized data generation based on selected chart type
    const chartData = useMemo(() => {
        switch (selectedChart) {
            case 'library-ref':
                return generateLibraryRefData()
            case 'users-per-library':
                return generateUsersPerLibraryData()
            case 'file-vs-url':
                return generateFileVsUrlData()
            case 'knowledge-stats':
                return generateKnowledgeStatsData()
            default:
                return []
        }
    }, [selectedChart])

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
                <div className="min-h-[300px] border rounded-md bg-background/50 p-4">
                    {renderChart(selectedChart, chartData)}
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
