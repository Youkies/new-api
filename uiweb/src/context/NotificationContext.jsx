import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useUser } from './UserContext.jsx'
import { getNotificationUnreadCount } from '../services/notifications.js'

const NotificationContext = createContext({
  unreadCount: 0,
  refreshUnread: () => {},
})

function extractUnread(res) {
  return Number(res?.data?.unread ?? res?.data?.data?.unread ?? res?.unread ?? 0) || 0
}

export function NotificationProvider({ children }) {
  const { user } = useUser()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnread = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      return 0
    }
    try {
      const res = await getNotificationUnreadCount()
      const next = extractUnread(res)
      setUnreadCount(next)
      return next
    } catch (_) {
      return 0
    }
  }, [user?.id])

  useEffect(() => {
    refreshUnread()
  }, [refreshUnread])

  useEffect(() => {
    const onFocus = () => refreshUnread()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshUnread])

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
