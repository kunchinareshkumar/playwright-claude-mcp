// Logs in once as Admin and saves the session so every other test starts authenticated.
import { test as setup, expect } from '@playwright/test';
import { ADMIN_STATE } from '../playwright.config.js';
import { login } from './support/orangehrm.js';

setup('authenticate as Admin', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard\/index/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
