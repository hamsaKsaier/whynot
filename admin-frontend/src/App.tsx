import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { FeatureFlagsProvider } from './providers/FeatureFlagsProvider'
import { ThemeProvider } from './components/ThemeProvider'
import { DirectionProvider } from './components/DirectionProvider'
import { AdminShell } from './components/layout/AdminShell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { UserDetailPage } from './pages/UserDetailPage'
import { PlansPage } from './pages/PlansPage'
import { PlanEditPage } from './pages/PlanEditPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { CreditsPage } from './pages/CreditsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { SystemSettingsPage } from './pages/SystemSettingsPage'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { FeatureFlagsPage } from './pages/FeatureFlagsPage'
import { BillingConfigPage } from './pages/BillingConfigPage'
import { AIProvidersPage } from './pages/AIProvidersPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { OrganizationDetailPage } from './pages/OrganizationDetailPage'
import { UsageTrackingPage } from './pages/UsageTrackingPage'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isSuperadmin } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || !isSuperadmin) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/:id" element={<OrganizationDetailPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="plans/new" element={<PlanEditPage />} />
        <Route path="plans/:id/edit" element={<PlanEditPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="usage" element={<UsageTrackingPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="billing-config" element={<BillingConfigPage />} />
        <Route path="feature-flags" element={<FeatureFlagsPage />} />
        <Route path="ai-providers" element={<AIProvidersPage />} />
        <Route path="settings" element={<SystemSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeatureFlagsProvider>
        <ThemeProvider>
          <DirectionProvider>
            <AppRoutes />
          </DirectionProvider>
        </ThemeProvider>
        </FeatureFlagsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
