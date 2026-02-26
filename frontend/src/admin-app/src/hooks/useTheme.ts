import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('admin-theme') as Theme
    if (stored) {
      setThemeState(stored)
    }
  }, [])

  useEffect(() => {
    // Resolve system theme
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    let effective = theme
    if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    setResolvedTheme(effective)
    root.classList.add(effective)
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('admin-theme', newTheme)
    setThemeState(newTheme)
  }

  return { theme: resolvedTheme, setTheme, rawTheme: theme }
}
