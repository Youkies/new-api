import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const UserContext = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
})

function readUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

export function UserProvider({ children }) {
  const [user, setUserState] = useState(readUser)

  const setUser = useCallback((u) => {
    setUserState((prev) => {
      const next = u && prev?._avatar_t && !u._avatar_t
        ? { ...u, _avatar_t: prev._avatar_t }
        : u
      try {
        if (next) localStorage.setItem('user', JSON.stringify(next))
        else localStorage.removeItem('user')
      } catch (_) {}
      return next
    })
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [setUser])

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'user') setUserState(readUser())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
