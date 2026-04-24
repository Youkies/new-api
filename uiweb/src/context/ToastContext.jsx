import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react'

const ToastContext = createContext({
  push: () => {},
})

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLOR = {
  success: 'bg-clay-green-100 text-[#3d6b4f]',
  error: 'bg-clay-pink-200 text-[#8a4860]',
  warning: 'bg-clay-yellow-200 text-[#8a6a32]',
  info: 'bg-clay-blue-100 text-[#43658b]',
}

let counter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', duration = 3200) => {
    const id = ++counter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICON[t.type] ?? Info
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-clay-pill shadow-clay ${COLOR[t.type] ?? COLOR.info} font-bold`}
            >
              <Icon className="w-5 h-5" strokeWidth={2.5} />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  return ctx.push
}
