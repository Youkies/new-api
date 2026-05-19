import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import Forbidden from './pages/Forbidden.jsx'
import About from './pages/About.jsx'
import UserAgreement from './pages/UserAgreement.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Pricing from './pages/Pricing.jsx'
import ModelStatus from './pages/ModelStatus.jsx'
import Announcements from './pages/Announcements.jsx'
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
import ArchiveList from './pages/ArchiveList.jsx'
import ArchiveDetail from './pages/ArchiveDetail.jsx'
import ArchiveSharePreview from './pages/ArchiveSharePreview.jsx'
import LogList from './pages/LogList.jsx'
import Checkin from './pages/Checkin.jsx'
import ApiUrls from './pages/ApiUrls.jsx'
import PaymentReturn from './pages/PaymentReturn.jsx'
import Notifications from './pages/Notifications.jsx'
import Playground from './pages/Playground.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import AdminRoute from './components/layout/AdminRoute.jsx'
import AdminHome from './pages/admin/AdminHome.jsx'
import AdminAnnouncements from './pages/admin/AdminAnnouncements.jsx'
import AdminNotifications from './pages/admin/AdminNotifications.jsx'
import AdminRefundAppeals from './pages/admin/AdminRefundAppeals.jsx'
import AdminAssistant from './pages/admin/AdminAssistant.jsx'
import AdminPageConfig from './pages/admin/AdminPageConfig.jsx'
import AdminPlaygroundFoods from './pages/admin/AdminPlaygroundFoods.jsx'
import AdminDebugTraces from './pages/admin/AdminDebugTraces.jsx'
import AdminKPayTopUps from './pages/admin/AdminKPayTopUps.jsx'

import PioneerGuard from './components/layout/PioneerGuard.jsx'

export default function App() {
  return (
    <PioneerGuard>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/status" element={<ModelStatus />} />
      <Route path="/announcements" element={<Announcements />} />
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
        path="/console/log"
        element={
          <ProtectedRoute>
            <PaymentReturn />
          </ProtectedRoute>
        }
      />

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
        path="/console/topup"
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
        path="/archives"
        element={
          <ProtectedRoute>
            <ArchiveList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/archives/share/:code"
        element={
          <ProtectedRoute>
            <ArchiveSharePreview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/archives/:id"
        element={
          <ProtectedRoute>
            <ArchiveDetail />
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
      <Route
        path="/api-urls"
        element={
          <ProtectedRoute>
            <ApiUrls />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playground"
        element={
          <ProtectedRoute>
            <Playground />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playground/:gameId"
        element={
          <ProtectedRoute>
            <Playground />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/playground"
        element={
          <ProtectedRoute>
            <Playground />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/playground/:gameId"
        element={
          <ProtectedRoute>
            <Playground />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminHome />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/announcements"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminAnnouncements />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminNotifications />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/refund-appeals"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminRefundAppeals />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/page-config"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminPageConfig />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/playground-foods"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminPlaygroundFoods />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/debug-traces"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDebugTraces />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/kpay-topups"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminKPayTopUps />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assistant"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminAssistant />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </PioneerGuard>
  )
}
