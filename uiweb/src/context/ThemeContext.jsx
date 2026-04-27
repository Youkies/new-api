import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'uiweb.theme.mode'
const MODES = ['system', 'light', 'dark']

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialMode() {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(stored) ? stored : 'system'
  } catch (_) {
    return 'system'
  }
}

function applyTheme(mode, resolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = resolvedTheme
  root.dataset.themeMode = mode
  root.style.colorScheme = resolvedTheme
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)

  const resolvedTheme = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return undefined
    const onChange = () => setSystemTheme(getSystemTheme())
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyTheme(mode, resolvedTheme)
  }, [mode, resolvedTheme])

  const setMode = useCallback((nextMode) => {
    if (!MODES.includes(nextMode)) return
    setModeState(nextMode)
    try {
      localStorage.setItem(STORAGE_KEY, nextMode)
    } catch (_) {}
  }, [])

  const cycleMode = useCallback(() => {
    if (mode === 'system') {
      setMode(resolvedTheme === 'dark' ? 'light' : 'dark')
      return
    }
    setMode(mode === 'light' ? 'dark' : 'system')
  }, [mode, resolvedTheme, setMode])

  const value = useMemo(() => ({
    mode,
    resolvedTheme,
    setMode,
    cycleMode,
  }), [cycleMode, mode, resolvedTheme, setMode])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
