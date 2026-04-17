import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://frontend:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop-ltr-light', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-desktop-ltr-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'chromium-mobile-ltr-light', use: { ...devices['Pixel 7'] } },
    {
      name: 'chromium-desktop-rtl-light',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar',
      },
    },
    {
      name: 'chromium-desktop-rtl-dark',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar',
        colorScheme: 'dark',
      },
    },
  ],
});
