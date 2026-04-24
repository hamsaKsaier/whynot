import { useState, useEffect, useCallback, lazy } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "sonner"
import { ThemeProvider } from "./components/ThemeProvider"
import { AuthProvider } from "./contexts/AuthContext"
import { FeatureFlagsProvider } from "./providers/FeatureFlagsProvider"
import { WorkspaceProvider } from "./contexts/WorkspaceContext"
import { ToastProvider } from "./contexts/ToastContext"
import { DirectionProvider } from "./components/DirectionProvider"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AppShell } from "./components/layout/AppShell"
import { LoginPage } from "./pages/LoginPage"
import { SignupPage } from "./pages/SignupPage"
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import { VerifyEmailPage } from "./pages/VerifyEmailPage"
import { AuthCallbackPage } from "./pages/AuthCallbackPage"
import { HomePage } from "./pages/HomePage"
import { ProjectsPage } from "./pages/ProjectsPage"
import { ProjectDetailPage } from "./pages/ProjectDetailPage"
import { TestRunDetailPage } from "./pages/TestRunDetailPage"
import { TestResultsPage } from "./pages/TestResultsPage"
import { SettingsPage } from "./pages/SettingsPage"
import { ArchitectureFlowPage } from "./pages/ArchitectureFlowPage"
import { QALoopPage } from "./pages/QALoopPage"
import { NotFoundPage } from "./pages/NotFoundPage"
import { LandingPage } from "./pages/landing/LandingPage"
import { PublicScanResultsPage } from "./pages/PublicScanResultsPage"
import { MonitorsPage } from "./pages/MonitorsPage"
import { PerformancePage } from "./pages/PerformancePage"
import { CheckoutPage } from "./pages/CheckoutPage"
import { UpgradePrompt } from "./components/common/UpgradePrompt"
import { ReconRoute } from "./pages/recon/ReconRoute"

const ReconScansListPage = lazy(() =>
  import("./pages/recon/ReconScansListPage").then((m) => ({ default: m.ReconScansListPage }))
)
const ReconNewScanPage = lazy(() =>
  import("./pages/recon/ReconNewScanPage").then((m) => ({ default: m.ReconNewScanPage }))
)
const ReconScanDetailPage = lazy(() =>
  import("./pages/recon/ReconScanDetailPage").then((m) => ({ default: m.ReconScanDetailPage }))
)

function App() {
  const [upgradePrompt, setUpgradePrompt] = useState<{
    isOpen: boolean
    type: "credits" | "feature" | "subscription"
    details?: any
  }>({ isOpen: false, type: "credits" })

  const handleUpgradeEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail
    setUpgradePrompt({ isOpen: true, type: detail.type, details: detail.details })
  }, [])

  useEffect(() => {
    window.addEventListener("upgrade-prompt", handleUpgradeEvent)
    return () => window.removeEventListener("upgrade-prompt", handleUpgradeEvent)
  }, [handleUpgradeEvent])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <FeatureFlagsProvider>
          <ToastProvider>
            <DirectionProvider>
            <Router>
              <Routes>
                {/* Public routes — rendered without the app shell */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/landing" element={<Navigate to="/" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/scan/:sessionId" element={<PublicScanResultsPage />} />

                {/* All other routes require auth + workspace */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<WorkspaceProvider><AppShell /></WorkspaceProvider>}>
                    <Route path="/app" element={<HomePage />} />
                    <Route path="/qa-loop" element={<QALoopPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/test-results" element={<TestResultsPage />} />
                    <Route path="/test-runs/:executionId" element={<TestRunDetailPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/monitors" element={<MonitorsPage />} />
                    <Route path="/performance" element={<PerformancePage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/architecture-flow" element={<ArchitectureFlowPage />} />
                    <Route path="/recon" element={<ReconRoute><ReconScansListPage /></ReconRoute>} />
                    <Route path="/recon/new" element={<ReconRoute><ReconNewScanPage /></ReconRoute>} />
                    <Route path="/recon/:scanId" element={<ReconRoute><ReconScanDetailPage /></ReconRoute>} />

                    {/* Redirects from old routes */}
                    <Route path="/test-runs" element={<Navigate to="/test-results?tab=runs" replace />} />
                    <Route path="/test-cases" element={<Navigate to="/test-results?tab=cases" replace />} />
                    <Route path="/environments" element={<Navigate to="/settings?tab=environments" replace />} />
                    <Route path="/integrations" element={<Navigate to="/settings?tab=integrations" replace />} />
                    <Route path="/github-repos" element={<Navigate to="/settings?tab=github" replace />} />
                    <Route path="/webhooks" element={<Navigate to="/settings?tab=webhooks" replace />} />
                    <Route path="/notifications" element={<Navigate to="/settings?tab=notifications" replace />} />
                    <Route path="/billing" element={<Navigate to="/settings?tab=billing" replace />} />

                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
              <UpgradePrompt
                isOpen={upgradePrompt.isOpen}
                onClose={() => setUpgradePrompt((prev) => ({ ...prev, isOpen: false }))}
                type={upgradePrompt.type}
                details={upgradePrompt.details}
              />
            </Router>
            </DirectionProvider>
            <Toaster position="bottom-right" richColors closeButton />
          </ToastProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
