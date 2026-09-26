// @ts-check
import { defineConfig, devices } from '@playwright/test';

export const ADMIN_STATE = 'playwright/.auth/admin.json';

export default defineConfig({
  testDir: './tests',
  // The OrangeHRM public demo is shared and often slow, so allow generous timeouts.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // Keep concurrency modest so we don't hammer the shared demo server.
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://opensource-demo.orangehrmlive.com',
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
      dependencies: ['setup'],
    },
  ],
});
