import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@whynot.test'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

test.describe('Admin Frontend E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')
  })

  test('dashboard loads with KPI cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Total Users')).toBeVisible()
    await expect(page.getByText('MRR')).toBeVisible()
    await expect(page.getByText('ARR')).toBeVisible()
  })

  test('users page with search and pagination', async ({ page }) => {
    await page.getByRole('link', { name: 'Users' }).click()
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByPlaceholder('Search by name or email...')).toBeVisible()
    const table = page.locator('table')
    await expect(table).toBeVisible()
  })

  test('plans page with new plan button', async ({ page }) => {
    await page.getByRole('link', { name: 'Plans' }).click()
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible()
    const newPlanBtn = page.getByRole('link', { name: /New Plan/ })
    await expect(newPlanBtn).toBeVisible()
  })

  test('plan edit form loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Plans' }).click()
    await page.getByRole('link', { name: /New Plan/ }).click()
    await expect(page.getByRole('heading', { name: 'Create Plan' })).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
    await expect(page.getByLabel('Slug')).toBeVisible()
    await expect(page.getByLabel('Price ($)')).toBeVisible()
  })

  test('subscriptions page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Subscriptions' }).click()
    await expect(page.getByRole('heading', { name: 'Subscriptions' })).toBeVisible()
  })

  test('credits page with grant dialog', async ({ page }) => {
    await page.getByRole('link', { name: 'Credits' }).click()
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible()
    await page.getByRole('button', { name: /Grant Credits/ }).click()
    await expect(page.getByText('Grant credits to a specific workspace')).toBeVisible()
  })

  test('analytics page with charts', async ({ page }) => {
    await page.getByRole('link', { name: 'Analytics' }).click()
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await expect(page.getByText('Total Users')).toBeVisible()
  })

  test('audit log page with filter', async ({ page }) => {
    await page.getByRole('link', { name: 'Audit Log' }).click()
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible()
  })

  test('announcements page with create dialog', async ({ page }) => {
    await page.getByRole('link', { name: 'Announcements' }).click()
    await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible()
    await page.getByRole('button', { name: /New Announcement/ }).click()
    await expect(page.getByLabel('Title')).toBeVisible()
  })

  test('system settings page with tabs', async ({ page }) => {
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'System Settings' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Credit Costs' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Security' })).toBeVisible()
  })

  test('dark mode toggle works', async ({ page }) => {
    const html = page.locator('html')
    await page.getByRole('button', { name: /☀|🌙/ }).click()
    const cls = await html.getAttribute('class')
    expect(cls).toMatch(/dark|light/)
  })

  test('mobile sidebar opens via menu button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByLabel('Open navigation').click()
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test('sidebar navigation highlights active route', async ({ page }) => {
    await page.getByRole('link', { name: 'Users' }).click()
    await page.waitForURL('/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  })

  test('disabled nav items show tooltip', async ({ page }) => {
    const featureFlags = page.getByText('Feature Flags')
    await featureFlags.hover()
    await expect(page.getByText('Coming in phase 5')).toBeVisible()
  })
})
