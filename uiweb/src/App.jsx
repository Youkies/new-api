import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import Forbidden from './pages/Forbidden.jsx'
import About from './pages/About.jsx'
import UserAgreement from './pages/UserAgreement.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Pricing from './pages/Pricing.jsx'
import ModelStatus from './pages/ModelStatus.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ResetRequest from './pages/ResetRequest.jsx'
import ResetConfirm from './pages/ResetConfirm.jsx'
import OAuthCallback from './pages/OAuthCallback.jsx'
import Setup from './pages/Setup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import TopUp from './pages/TopUp.jsx'
import PersonalSetting from './pages/PersonalSetting.jsx'
import Chat2Link from './pages/Chat2Link.jsx'
import TokenManage from './pages/TokenManage.jsx'
import LogList from './pages/LogList.jsx'
import Checkin from './pages/Checkin.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/status" element={<ModelStatus />} />
      <Route path="/user-agreement" element={<UserAgreement />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset" element={<ResetRequest />} />
      <Route path="/user/reset" element={<ResetConfirm />} />
      <Route path="/oauth/:provider" element={<OAuthCallback />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/forbidden" element={<Forbidden />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/topup"
        element={
          <ProtectedRoute>
            <TopUp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/personal"
        element={
          <ProtectedRoute>
            <PersonalSetting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat2link"
        element={
          <ProtectedRoute>
            <Chat2Link />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tokens"
        element={
          <ProtectedRoute>
            <TokenManage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <LogList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkin"
        element={
          <ProtectedRoute>
            <Checkin />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
