import type { ComponentType } from 'react';

export interface PageEntry {
  key: string;
  path: string;
  routePattern: string;
  component: ComponentType;
  requiresAuth: boolean;
}

import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { UsersPage } from '../pages/UsersPage';
import { UserDetailPage } from '../pages/UserDetailPage';
import { OrganizationsPage } from '../pages/OrganizationsPage';
import { OrganizationDetailPage } from '../pages/OrganizationDetailPage';
import { PlansPage } from '../pages/PlansPage';
import { PlanEditPage } from '../pages/PlanEditPage';
import { SubscriptionsPage } from '../pages/SubscriptionsPage';
import { CreditsPage } from '../pages/CreditsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { AuditLogPage } from '../pages/AuditLogPage';
import { UsageTrackingPage } from '../pages/UsageTrackingPage';
import { AnnouncementsPage } from '../pages/AnnouncementsPage';
import { BillingConfigPage } from '../pages/BillingConfigPage';
import { FeatureFlagsPage } from '../pages/FeatureFlagsPage';
import { AIProvidersPage } from '../pages/AIProvidersPage';
import { SystemSettingsPage } from '../pages/SystemSettingsPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { ServerErrorPage } from '../pages/ServerErrorPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';

/**
 * Every admin page must appear here.
 * The pages-i18n test iterates this list × 5 locales.
 * When you add a new page, add it to this manifest.
 */
export const PAGES: PageEntry[] = [
  // ── Public routes ────────────────────────────────────────────────────
  { key: 'login', path: '/login', routePattern: '/login', component: LoginPage, requiresAuth: false },

  // ── Protected routes ───────────────────────────────────────────���─────
  { key: 'dashboard', path: '/', routePattern: '/', component: DashboardPage, requiresAuth: true },
  { key: 'users', path: '/users', routePattern: '/users', component: UsersPage, requiresAuth: true },
  { key: 'user-detail', path: '/users/test-user-1', routePattern: '/users/:id', component: UserDetailPage, requiresAuth: true },
  { key: 'organizations', path: '/organizations', routePattern: '/organizations', component: OrganizationsPage, requiresAuth: true },
  { key: 'organization-detail', path: '/organizations/test-org-1', routePattern: '/organizations/:id', component: OrganizationDetailPage, requiresAuth: true },
  { key: 'plans', path: '/plans', routePattern: '/plans', component: PlansPage, requiresAuth: true },
  { key: 'plan-new', path: '/plans/new', routePattern: '/plans/new', component: PlanEditPage, requiresAuth: true },
  { key: 'plan-edit', path: '/plans/test-plan-1/edit', routePattern: '/plans/:id/edit', component: PlanEditPage, requiresAuth: true },
  { key: 'subscriptions', path: '/subscriptions', routePattern: '/subscriptions', component: SubscriptionsPage, requiresAuth: true },
  { key: 'credits', path: '/credits', routePattern: '/credits', component: CreditsPage, requiresAuth: true },
  { key: 'analytics', path: '/analytics', routePattern: '/analytics', component: AnalyticsPage, requiresAuth: true },
  { key: 'audit-log', path: '/audit-log', routePattern: '/audit-log', component: AuditLogPage, requiresAuth: true },
  { key: 'usage', path: '/usage', routePattern: '/usage', component: UsageTrackingPage, requiresAuth: true },
  { key: 'announcements', path: '/announcements', routePattern: '/announcements', component: AnnouncementsPage, requiresAuth: true },
  { key: 'billing-config', path: '/billing-config', routePattern: '/billing-config', component: BillingConfigPage, requiresAuth: true },
  { key: 'feature-flags', path: '/feature-flags', routePattern: '/feature-flags', component: FeatureFlagsPage, requiresAuth: true },
  { key: 'ai-providers', path: '/ai-providers', routePattern: '/ai-providers', component: AIProvidersPage, requiresAuth: true },
  { key: 'settings', path: '/settings', routePattern: '/settings', component: SystemSettingsPage, requiresAuth: true },

  // ── Error / status pages ────��────────────────────────────────────────
  { key: 'forbidden', path: '/forbidden', routePattern: '/forbidden', component: ForbiddenPage, requiresAuth: false },
  { key: 'server-error', path: '/error', routePattern: '/error', component: ServerErrorPage, requiresAuth: false },
  { key: 'not-found', path: '/nonexistent', routePattern: '*', component: NotFoundPage, requiresAuth: false },
  { key: 'access-denied', path: '/access-denied', routePattern: '/access-denied', component: AccessDeniedPage, requiresAuth: false },
];
