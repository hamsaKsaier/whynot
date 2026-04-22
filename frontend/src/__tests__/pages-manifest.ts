import type { ComponentType } from 'react';

export interface PageEntry {
  key: string;
  path: string;
  routePattern: string;
  component: ComponentType;
  requiresAuth: boolean;
}

// Lazy imports — resolved at test time so vi.mock() can intercept
import { LandingPage } from '../pages/landing/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { PublicScanResultsPage } from '../pages/PublicScanResultsPage';
import { HomePage } from '../pages/HomePage';
import { QALoopPage } from '../pages/QALoopPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { TestResultsPage } from '../pages/TestResultsPage';
import { TestRunDetailPage } from '../pages/TestRunDetailPage';
import { SettingsPage } from '../pages/SettingsPage';
import { MonitorsPage } from '../pages/MonitorsPage';
import { PerformancePage } from '../pages/PerformancePage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ArchitectureFlowPage } from '../pages/ArchitectureFlowPage';
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * Every user-facing route must appear here.
 * The pages-i18n test iterates this list × 5 locales.
 * When you add a new page, add it to this manifest.
 */
export const PAGES: PageEntry[] = [
  // ── Public routes ────────────────────────────────────────────────────
  { key: 'landing', path: '/', routePattern: '/', component: LandingPage, requiresAuth: false },
  { key: 'login', path: '/login', routePattern: '/login', component: LoginPage, requiresAuth: false },
  { key: 'signup', path: '/signup', routePattern: '/signup', component: SignupPage, requiresAuth: false },
  { key: 'forgot-password', path: '/forgot-password', routePattern: '/forgot-password', component: ForgotPasswordPage, requiresAuth: false },
  { key: 'reset-password', path: '/reset-password', routePattern: '/reset-password', component: ResetPasswordPage, requiresAuth: false },
  { key: 'verify-email', path: '/verify-email', routePattern: '/verify-email', component: VerifyEmailPage, requiresAuth: false },
  { key: 'public-scan', path: '/scan/test-session-1', routePattern: '/scan/:sessionId', component: PublicScanResultsPage, requiresAuth: false },

  // ── Protected routes ─────────────────────────────────────────────────
  { key: 'home', path: '/app', routePattern: '/app', component: HomePage, requiresAuth: true },
  { key: 'qa-loop', path: '/qa-loop', routePattern: '/qa-loop', component: QALoopPage, requiresAuth: true },
  { key: 'projects', path: '/projects', routePattern: '/projects', component: ProjectsPage, requiresAuth: true },
  { key: 'project-detail', path: '/projects/test-proj-1', routePattern: '/projects/:id', component: ProjectDetailPage, requiresAuth: true },
  { key: 'test-results', path: '/test-results', routePattern: '/test-results', component: TestResultsPage, requiresAuth: true },
  { key: 'test-run-detail', path: '/test-runs/test-exec-1', routePattern: '/test-runs/:executionId', component: TestRunDetailPage, requiresAuth: true },
  { key: 'settings', path: '/settings', routePattern: '/settings', component: SettingsPage, requiresAuth: true },
  { key: 'monitors', path: '/monitors', routePattern: '/monitors', component: MonitorsPage, requiresAuth: true },
  { key: 'performance', path: '/performance', routePattern: '/performance', component: PerformancePage, requiresAuth: true },
  { key: 'checkout', path: '/checkout', routePattern: '/checkout', component: CheckoutPage, requiresAuth: true },
  { key: 'architecture-flow', path: '/architecture-flow', routePattern: '/architecture-flow', component: ArchitectureFlowPage, requiresAuth: true },

  // ── Error page ────���──────────────────────────────────────────────────
  { key: 'not-found', path: '/nonexistent', routePattern: '*', component: NotFoundPage, requiresAuth: false },
];
