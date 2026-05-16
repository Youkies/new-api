import { Navigate, useLocation } from 'react-router-dom'
import { useUser } from '../../context/UserContext.jsx'

export default function ProtectedRoute({ children }) {
  const { user } = useUser()
  const location = useLocation()

  if (!user) {
    const loginPath = location.search.includes('debug=') ? `/login${location.search}` : '/login'
    return <Navigate to={loginPath} state={{ from: location.pathname + location.search }} replace />
  }
  return children
}
