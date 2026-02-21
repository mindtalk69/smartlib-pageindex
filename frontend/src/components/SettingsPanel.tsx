import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Settings, Sun, Moon, Monitor } from 'lucide-react'

type Theme = 'light' | 'dark' | 'system'

interface SettingsPanelProps {
    isOpen: boolean
    onClose: () => void
}

/**
 * SettingsPanel Component
 * 
 * Settings for theme, display options, and other preferences.
 * Uses shadcn/ui Dialog component and Lucide icons.
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const [theme, setTheme] = useState<Theme>(() =>
        (localStorage.getItem('smartlib_theme') as Theme) || 'system'
    )
    const [showTimestamps, setShowTimestamps] = useState(() =>
        localStorage.getItem('smartlib_show_timestamps') === 'true'
    )
    const [streamEnabled, setStreamEnabled] = useState(() =>
        localStorage.getItem('smartlib_stream_enabled') !== 'false'
    )
    const [mmrEnabled, setMmrEnabled] = useState(() =>
        localStorage.getItem('smartlib_mmr_enabled') !== 'false'
    )
    const [restoreChat, setRestoreChat] = useState(() =>
        localStorage.getItem('smartlib_restore_chat') === 'true'
    )
    const [selfRetriever, setSelfRetriever] = useState(() =>
        localStorage.getItem('smartlib_self_retriever') !== 'false'
    )
    const [bgAnimation, setBgAnimation] = useState(() =>
        localStorage.getItem('smartlib_bg_animation') === 'true'
    )

    useEffect(() => {
        applyTheme(theme)
        localStorage.setItem('smartlib_theme', theme)
    }, [theme])

    useEffect(() => {
        localStorage.setItem('smartlib_show_timestamps', String(showTimestamps))
    }, [showTimestamps])

    useEffect(() => {
        localStorage.setItem('smartlib_stream_enabled', String(streamEnabled))
    }, [streamEnabled])

    useEffect(() => {
        localStorage.setItem('smartlib_mmr_enabled', String(mmrEnabled))
    }, [mmrEnabled])

    useEffect(() => {
        localStorage.setItem('smartlib_restore_chat', String(restoreChat))
    }, [restoreChat])

    useEffect(() => {
        localStorage.setItem('smartlib_self_retriever', String(selfRetriever))
    }, [selfRetriever])

    useEffect(() => {
        localStorage.setItem('smartlib_bg_animation', String(bgAnimation))
    }, [bgAnimation])

    const applyTheme = (t: Theme) => {
        const root = document.documentElement
        if (t === 'system') {
            root.removeAttribute('data-theme')
            root.classList.remove('dark')
        } else if (t === 'dark') {
            root.classList.add('dark')
            root.setAttribute('data-theme', 'dark')
        } else {
            root.classList.remove('dark')
            root.setAttribute('data-theme', 'light')
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" /> Settings
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Theme */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Appearance
                        </h4>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Theme</span>
                            <div className="flex gap-1">
                                <Button
                                    variant={theme === 'light' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTheme('light')}
                                    className="gap-1"
                                >
                                    <Sun className="h-4 w-4" /> Light
                                </Button>
                                <Button
                                    variant={theme === 'dark' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTheme('dark')}
                                    className="gap-1"
                                >
                                    <Moon className="h-4 w-4" /> Dark
                                </Button>
                                <Button
                                    variant={theme === 'system' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTheme('system')}
                                    className="gap-1"
                                >
                                    <Monitor className="h-4 w-4" /> Auto
                                </Button>
                            </div>
                        </div>
                        <SettingToggle
                            id="bgAnimation"
                            label="Background animation"
                            description="Subtle animated effects"
                            checked={bgAnimation}
                            onChange={setBgAnimation}
                        />
                    </div>

                    <Separator />

                    {/* Display Options */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Display
                        </h4>
                        <SettingToggle
                            id="showTimestamps"
                            label="Show timestamps"
                            checked={showTimestamps}
                            onChange={setShowTimestamps}
                        />
                        <SettingToggle
                            id="restoreChat"
                            label="Restore chat"
                            description="Load previous conversation on refresh"
                            checked={restoreChat}
                            onChange={setRestoreChat}
                        />
                    </div>

                    <Separator />

                    {/* Response Options */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Response
                        </h4>
                        <SettingToggle
                            id="streamEnabled"
                            label="Stream answers"
                            description="Show responses as they're generated"
                            checked={streamEnabled}
                            onChange={setStreamEnabled}
                        />
                    </div>

                    <Separator />

                    {/* Search Options */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Search
                        </h4>
                        <SettingToggle
                            id="mmrEnabled"
                            label="Use MMR (diverse results)"
                            description="Reduces duplicate content"
                            checked={mmrEnabled}
                            onChange={setMmrEnabled}
                        />
                        <SettingToggle
                            id="selfRetriever"
                            label="Self retriever"
                            description="Generate metadata filters automatically"
                            checked={selfRetriever}
                            onChange={setSelfRetriever}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface SettingToggleProps {
    id: string
    label: string
    description?: string
    checked: boolean
    onChange: (checked: boolean) => void
}

function SettingToggle({ id, label, description, checked, onChange }: SettingToggleProps) {
    return (
        <div className="flex items-center justify-between">
            <label htmlFor={id} className="flex-1 cursor-pointer">
                <span className="text-sm font-medium">{label}</span>
                {description && (
                    <span className="block text-xs text-muted-foreground">{description}</span>
                )}
            </label>
            <input
                type="checkbox"
                id={id}
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
        </div>
    )
}

/**
 * ThemeToggle - Quick theme button for header
 */
export function ThemeToggle() {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('smartlib_theme')
        if (saved === 'dark') return true
        if (saved === 'light') return false
        return window.matchMedia('(prefers-color-scheme: dark)').matches
    })

    const toggle = () => {
        const newTheme = isDark ? 'light' : 'dark'
        setIsDark(!isDark)
        localStorage.setItem('smartlib_theme', newTheme)
        const root = document.documentElement
        if (newTheme === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        root.setAttribute('data-theme', newTheme)
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
    )
}
