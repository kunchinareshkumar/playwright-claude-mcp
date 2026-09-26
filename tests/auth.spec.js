import { test, expect } from '@playwright/test';
import { ADMIN, LOGGED_OUT, login, openUserMenu, url } from './support/orangehrm.js';

test.use({ storageState: LOGGED_OUT });

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/auth/login'));
  });

  test('renders the login form and branding', async ({ page }) => {
    await expect(page).toHaveTitle('OrangeHRM');
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled();
    await expect(page.getByText('Forgot your password?')).toBeVisible();
    await expect(page.getByRole('img', { name: 'company-branding' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'OrangeHRM, Inc' })).toHaveAttribute('href', 'http://www.orangehrm.com');
  });

  test('masks the password field', async ({ page }) => {
    await expect(page.getByPlaceholder('Password')).toHaveAttribute('type', 'password');
  });

  test('links to the OrangeHRM social media pages', async ({ page }) => {
    for (const domain of ['linkedin.com', 'facebook.com', 'twitter.com', 'youtube.com']) {
      await expect(page.locator(`a[href*="${domain}"]`)).toHaveCount(1);
    }
  });
});

test.describe('Login - valid credentials', () => {
  test('logs in with the Login button and lands on the dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard\/index/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sidepanel' })).toBeVisible();
  });

  test('logs in by pressing Enter in the password field', async ({ page }) => {
    await page.goto(url('/auth/login'));
    await page.getByPlaceholder('Username').fill(ADMIN.username);
    await page.getByPlaceholder('Password').fill(ADMIN.password);
    await page.getByPlaceholder('Password').press('Enter');
    await expect(page).toHaveURL(/\/dashboard\/index/);
  });

  test('accepts the username case-insensitively', async ({ page }) => {
    await login(page, { username: 'admin', password: ADMIN.password });
    await expect(page).toHaveURL(/\/dashboard\/index/);
  });
});

test.describe('Login - invalid input', () => {
  const invalid = [
    { name: 'wrong password', username: ADMIN.username, password: 'wrong123' },
    { name: 'unknown username', username: 'no_such_user_xyz', password: ADMIN.password },
    { name: 'both wrong', username: 'nobody', password: 'nothing' },
    { name: 'password with wrong case', username: ADMIN.username, password: 'ADMIN123' },
    { name: 'SQL injection attempt', username: "' OR '1'='1", password: "' OR '1'='1" },
    { name: 'script injection attempt', username: '<script>alert(1)</script>', password: 'x' },
  ];

  for (const { name, username, password } of invalid) {
    test(`shows "Invalid credentials" for ${name}`, async ({ page }) => {
      await login(page, { username, password });
      await expect(page.getByRole('alert')).toContainText('Invalid credentials');
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  }

  test('requires both fields when submitted empty', async ({ page }) => {
    await page.goto(url('/auth/login'));
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Required')).toHaveCount(2);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('requires the username', async ({ page }) => {
    await page.goto(url('/auth/login'));
    await page.getByPlaceholder('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Required')).toHaveCount(1);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('requires the password', async ({ page }) => {
    await page.goto(url('/auth/login'));
    await page.getByPlaceholder('Username').fill(ADMIN.username);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Required')).toHaveCount(1);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('treats a whitespace-only username as empty', async ({ page }) => {
    await page.goto(url('/auth/login'));
    await page.getByPlaceholder('Username').fill('   ');
    await page.getByPlaceholder('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Required')).toBeVisible();
  });

  test('clears the "Required" message once the field is filled', async ({ page }) => {
    await page.goto(url('/auth/login'));
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Required')).toHaveCount(2);
    await page.getByPlaceholder('Username').fill(ADMIN.username);
    await expect(page.getByText('Required')).toHaveCount(1);
  });
});

test.describe('Access control', () => {
  for (const path of ['/dashboard/index', '/admin/viewSystemUsers', '/pim/viewEmployeeList', '/leave/viewLeaveList']) {
    test(`redirects an anonymous user from ${path} to login`, async ({ page }) => {
      await page.goto(url(path));
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    });
  }
});

test.describe('Logout', () => {
  test('logs out from the user menu and returns to login', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard\/index/);
    await openUserMenu(page);
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });

  test('cannot reach protected pages after logout', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard\/index/);
    await openUserMenu(page);
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.goto(url('/dashboard/index'));
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Forgot password', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/auth/login'));
    await page.getByText('Forgot your password?').click();
    await expect(page).toHaveURL(/\/auth\/requestPasswordResetCode/);
  });

  test('shows the reset password form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Password' })).toBeVisible();
  });

  test('requires a username', async ({ page }) => {
    await page.getByRole('button', { name: 'Reset Password' }).click();
    await expect(page.getByText('Required')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/requestPasswordResetCode/);
  });

  test('Cancel returns to the login page', async ({ page }) => {
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  // App bug (2026-09-26): POST /auth/requestResetPassword hangs and nginx returns
  // "504 Gateway Time-out" after 60s, so the success page is never shown.
  test.fixme('confirms that a reset link was sent', async ({ page }) => {
    await page.getByPlaceholder('Username').fill(ADMIN.username);
    await page.getByRole('button', { name: 'Reset Password' }).click();
    await expect(page.getByRole('heading', { name: 'Reset Password link sent successfully' })).toBeVisible();
  });
});
