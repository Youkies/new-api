import { Navigate } from 'react-router-dom'
import { useUser } from '../../context/UserContext.jsx'

export default function AdminRoute({ children }) {
  const { user } = useUser()
  const role = Number(user?.role ?? user?.Role ?? 0)

  if (role < 10) {
    return <Navigate to="/forbidden" replace />
  }
  return children
}
