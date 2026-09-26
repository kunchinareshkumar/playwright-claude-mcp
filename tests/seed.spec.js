// Seed test: gives the planner/generator agents a ready page context and the house style.
// Tests in the "chromium" project start logged in as Admin (see tests/auth.setup.js).
import { test, expect } from '@playwright/test';
import { url } from './support/orangehrm.js';

test.describe('seed', () => {
  test('app loads logged in', async ({ page }) => {
    await page.goto(url('/dashboard/index'));
    await expect(page).toHaveTitle('OrangeHRM');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
