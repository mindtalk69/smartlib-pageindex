/**
 * LanguageList Component - Language list table with search and filter
 *
 * Features:
 * - Table display with columns (Code, Name, Is Active, Created, Created By, Actions)
 * - Search input with filtering by code or name
 * - Status filter (all/active/inactive)
 * - Toggle active status switch
 * - Actions dropdown menu with edit/delete
 * - Empty state with "Add Language" button
 */

import { useState, useMemo } from 'react'
import { LlmLanguage } from '@/hooks/useLanguages'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export interface LanguageListProps {
    languages: LlmLanguage[]
    onAdd: () => void
    onEdit: (language: LlmLanguage) => void
    onDelete: (id: number) => void
    onToggleActive: (id: number, currentStatus: boolean) => void
    onSuccess: (message: string) => void
    onError: (message: string) => void
}

export function LanguageList({
    languages,
    onAdd,
    onEdit,
    onDelete,
    onToggleActive,
    onSuccess,
    onError,
}: LanguageListProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

    // Filter languages based on search and status
    const filteredLanguages = useMemo(() => {
        return languages.filter((lang) => {
            const matchesSearch =
                lang.language_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lang.language_name.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && lang.is_active) ||
                (statusFilter === 'inactive' && !lang.is_active)

            return matchesSearch && matchesStatus
        })
    }, [languages, searchQuery, statusFilter])

    const handleToggleActive = (id: number, currentStatus: boolean) => {
        onToggleActive(id, currentStatus)
        onSuccess(`Language status updated successfully`)
    }

    const handleDelete = (id: number, languageName: string) => {
        if (window.confirm(`Delete language: ${languageName}?`)) {
            onDelete(id)
            onSuccess('Language deleted successfully')
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    if (languages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No languages configured</p>
                <Button onClick={onAdd}>Add Language</Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex gap-4">
                <Input
                    placeholder="Search by code or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <table className="w-full">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium">Language Code</th>
                            <th className="px-4 py-2 text-left font-medium">Language Name</th>
                            <th className="px-4 py-2 text-left font-medium">Is Active</th>
                            <th className="px-4 py-2 text-left font-medium">Created At</th>
                            <th className="px-4 py-2 text-left font-medium">Created By</th>
                            <th className="px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLanguages.map((lang) => (
                            <tr key={lang.id} className="border-t hover:bg-muted/30">
                                <td className="px-4 py-3 font-mono text-sm">{lang.language_code}</td>
                                <td className="px-4 py-3">{lang.language_name}</td>
                                <td className="px-4 py-3">
                                    <Switch
                                        checked={lang.is_active}
                                        onCheckedChange={() => handleToggleActive(lang.id, lang.is_active)}
                                    />
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {formatDate(lang.created_at)}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {lang.created_by || '—'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                Actions
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onEdit(lang)}>
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(lang.id, lang.language_name)}
                                                className="text-destructive"
                                            >
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredLanguages.length === 0 && searchQuery && (
                <div className="text-center py-8 text-muted-foreground">
                    No languages found matching "{searchQuery}"
                </div>
            )}
        </div>
    )
}

export default LanguageList
