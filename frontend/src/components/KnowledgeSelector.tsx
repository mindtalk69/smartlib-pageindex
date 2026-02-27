import { useState, useEffect, useMemo } from 'react'
import { api } from '../utils/apiClient'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Target, X } from 'lucide-react'

interface Knowledge {
    id: number
    name: string
    description?: string
}

interface Library {
    id: number
    name: string
}

interface KnowledgeLibrariesMap {
    [knowledgeId: string]: {
        name: string
        libraries: Library[]
    }
}

interface KnowledgeSelectorProps {
    selectedKnowledgeId: number | null
    selectedLibraryId: number | null
    onKnowledgeChange: (id: number | null) => void
    onLibraryChange: (id: number | null) => void
}

/**
 * KnowledgeSelector Component
 * 
 * Dropdown selectors for knowledge bases and libraries.
 * Libraries are filtered based on selected knowledge.
 */
export function KnowledgeSelector({
    selectedKnowledgeId,
    selectedLibraryId,
    onKnowledgeChange,
    onLibraryChange,
}: KnowledgeSelectorProps) {
    const [knowledges, setKnowledges] = useState<Knowledge[]>([])
    const [allLibraries, setAllLibraries] = useState<Library[]>([])
    const [knowledgeLibrariesMap, setKnowledgeLibrariesMap] = useState<KnowledgeLibrariesMap>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [vectorStoreMode, setVectorStoreMode] = useState<string>('user')

    useEffect(() => {
        fetchOptions()
    }, [])

    const fetchOptions = async () => {
        try {
            setLoading(true)

            // Fetch knowledges with their libraries mapping
            const knowledgesData = await api.get<any>('/knowledges')
            setKnowledges(knowledgesData.knowledges || [])
            setKnowledgeLibrariesMap(knowledgesData.knowledge_libraries_map || {})
            setVectorStoreMode(knowledgesData.mode || 'user')

            // Fetch all libraries (fallback when no knowledge selected)
            const librariesData = await api.get<any>('/libraries')
            setAllLibraries(librariesData.libraries || [])

            setError(null)
        } catch (err) {
            console.error('Failed to fetch options:', err)
            setError('Failed to load options')
        } finally {
            setLoading(false)
        }
    }

    // Filter libraries based on selected knowledge
    const filteredLibraries = useMemo(() => {
        if (selectedKnowledgeId && knowledgeLibrariesMap[String(selectedKnowledgeId)]) {
            return knowledgeLibrariesMap[String(selectedKnowledgeId)].libraries
        }
        return allLibraries
    }, [selectedKnowledgeId, knowledgeLibrariesMap, allLibraries])

    // Clear library selection when knowledge changes and library is not in new list
    useEffect(() => {
        if (selectedLibraryId && selectedKnowledgeId) {
            const validLibs = knowledgeLibrariesMap[String(selectedKnowledgeId)]?.libraries || []
            const isValid = validLibs.some(lib => lib.id === selectedLibraryId)
            if (!isValid) {
                onLibraryChange(null)
            }
        }
    }, [selectedKnowledgeId, selectedLibraryId, knowledgeLibrariesMap, onLibraryChange])

    const hasFilter = selectedKnowledgeId !== null || selectedLibraryId !== null

    // Don't show selector if not in knowledge mode
    if (vectorStoreMode !== 'knowledge') {
        return null
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={hasFilter ? "default" : "outline"} size="sm" className="gap-2">
                    <Target className="h-4 w-4" />
                    {hasFilter ? (
                        <Badge variant="secondary" className="text-xs">Filtered</Badge>
                    ) : (
                        "All Docs"
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 p-4">
                {loading && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                        Loading...
                    </div>
                )}

                {error && (
                    <div className="text-sm text-destructive text-center py-2">
                        {error}
                    </div>
                )}

                {!loading && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <DropdownMenuLabel className="p-0">Knowledge Base</DropdownMenuLabel>
                            <select
                                value={selectedKnowledgeId || ''}
                                onChange={(e) => onKnowledgeChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_option]:bg-background [&_option]:text-foreground"
                            >
                                <option value="">All Knowledge Bases</option>
                                {knowledges.map((kb) => (
                                    <option key={kb.id} value={kb.id}>
                                        {kb.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <DropdownMenuLabel className="p-0">
                                Library
                                {selectedKnowledgeId && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                        ({filteredLibraries.length} available)
                                    </span>
                                )}
                            </DropdownMenuLabel>
                            <select
                                value={selectedLibraryId || ''}
                                onChange={(e) => onLibraryChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_option]:bg-background [&_option]:text-foreground"
                            >
                                <option value="">All Libraries</option>
                                {filteredLibraries.map((lib) => (
                                    <option key={lib.id} value={lib.id}>
                                        {lib.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <DropdownMenuSeparator />

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => {
                                onKnowledgeChange(null)
                                onLibraryChange(null)
                            }}
                        >
                            <X className="h-4 w-4" /> Clear Filters
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

