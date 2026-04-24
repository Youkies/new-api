import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getStatus } from '../services/auth.js'
import { persistStatusFields } from '../utils/quota.js'

const StatusContext = createContext({
  status: null,
  loading: true,
  refresh: async () => {},
})

export function StatusProvider({ children }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const s = await getStatus()
      setStatus(s)
      if (s) {
        persistStatusFields(s)
      }
    } catch (_) {
      // keep previous status on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // warm-start from cache
    try {
      const cached = localStorage.getItem('status')
      if (cached) setStatus(JSON.parse(cached))
    } catch (_) {}
    refresh()
  }, [refresh])

  return (
    <StatusContext.Provider value={{ status, loading, refresh }}>
      {children}
    </StatusContext.Provider>
  )
}

export function useStatus() {
  return useContext(StatusContext)
}
