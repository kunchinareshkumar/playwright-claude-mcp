import { test, expect } from '@playwright/test';
import { openUserMenu, url } from './support/orangehrm.js';

const sidepanel = (page) => page.getByRole('navigation', { name: 'Sidepanel' });

test.describe('Dashboard widgets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/dashboard/index'));
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('shows every dashboard widget', async ({ page }) => {
    for (const title of [
      'Time at Work',
      'My Actions',
      'Quick Launch',
      'Buzz Latest Posts',
      'Employees on Leave Today',
      'Employee Distribution by Sub Unit',
      'Employee Distribution by Location',
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
  });

  test('shows the version and copyright footer', async ({ page }) => {
    await expect(page.getByText(/OrangeHRM OS \d+\.\d+/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'OrangeHRM, Inc' })).toBeVisible();
  });

  test('has an Upgrade link to the OrangeHRM site', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Upgrade' })).toHaveAttribute('href', /orangehrm\.com/);
  });

  const quickLaunch = [
    { name: 'Assign Leave', path: /\/leave\/assignLeave/ },
    { name: 'Leave List', path: /\/leave\/viewLeaveList/ },
    { name: 'Timesheets', path: /\/time\/viewEmployeeTimesheet/ },
    { name: 'Apply Leave', path: /\/leave\/applyLeave/ },
    { name: 'My Leave', path: /\/leave\/viewMyLeaveList/ },
    { name: 'My Timesheet', path: /\/time\/viewMyTimesheet/ },
  ];
  for (const { name, path } of quickLaunch) {
    test(`Quick Launch "${name}" opens its page`, async ({ page }) => {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page).toHaveURL(path);
    });
  }
});

test.describe('Side panel navigation', () => {
  const modules = [
    { name: 'Admin', path: /\/admin\/viewSystemUsers/, header: 'Admin' },
    { name: 'PIM', path: /\/pim\/viewEmployeeList/, header: 'PIM' },
    { name: 'Leave', path: /\/leave\/viewLeaveList/, header: 'Leave' },
    { name: 'Time', path: /\/time\/viewEmployeeTimesheet/, header: 'Time' },
    { name: 'Recruitment', path: /\/recruitment\/viewCandidates/, header: 'Recruitment' },
    { name: 'My Info', path: /\/pim\/viewPersonalDetails\/empNumber\/\d+/, header: 'PIM' },
    { name: 'Performance', path: /\/performance\/searchEvaluatePerformanceReview/, header: 'Performance' },
    { name: 'Directory', path: /\/directory\/viewDirectory/, header: 'Directory' },
    { name: 'Claim', path: /\/claim\/viewAssignClaim/, header: 'Claim' },
    { name: 'Buzz', path: /\/buzz\/viewBuzz/, header: 'Buzz' },
  ];

  for (const { name, path, header } of modules) {
    test(`"${name}" opens the ${header} module`, async ({ page }) => {
      await page.goto(url('/dashboard/index'));
      await sidepanel(page).getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('banner').getByRole('heading', { name: header, exact: true })).toBeVisible();
      await expect(sidepanel(page).getByRole('link', { name, exact: true })).toHaveClass(/active/);
    });
  }

  test('"Maintenance" asks the administrator to re-enter credentials', async ({ page }) => {
    await page.goto(url('/dashboard/index'));
    await sidepanel(page).getByRole('link', { name: 'Maintenance' }).click();
    await expect(page).toHaveURL(/\/maintenance\/purgeEmployee/);
    await expect(page.getByRole('heading', { name: 'Administrator Access' })).toBeVisible();
  });

  test('"Dashboard" returns to the dashboard', async ({ page }) => {
    await page.goto(url('/pim/viewEmployeeList'));
    await sidepanel(page).getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard\/index/);
  });
});

test.describe('Side panel search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/dashboard/index'));
  });

  test('filters the menu to matching modules', async ({ page }) => {
    await sidepanel(page).getByPlaceholder('Search').fill('PIM');
    await expect(sidepanel(page).getByRole('listitem')).toHaveCount(1);
    await expect(sidepanel(page).getByRole('link', { name: 'PIM' })).toBeVisible();
  });

  test('is case-insensitive and matches partial names', async ({ page }) => {
    await sidepanel(page).getByPlaceholder('Search').fill('recr');
    await expect(sidepanel(page).getByRole('link', { name: 'Recruitment' })).toBeVisible();
    await expect(sidepanel(page).getByRole('link', { name: 'Directory' })).toBeHidden();
  });

  test('shows no modules for an unknown term', async ({ page }) => {
    await sidepanel(page).getByPlaceholder('Search').fill('zzzz');
    await expect(sidepanel(page).getByRole('listitem')).toHaveCount(0);
  });

  test('restores the full menu when the search is cleared', async ({ page }) => {
    const search = sidepanel(page).getByPlaceholder('Search');
    await search.fill('Leave');
    await expect(sidepanel(page).getByRole('listitem')).toHaveCount(1);
    await search.clear();
    await expect(sidepanel(page).getByRole('listitem')).toHaveCount(12);
  });
});

test.describe('User menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/dashboard/index'));
    await openUserMenu(page);
  });

  test('lists About, Support, Change Password and Logout', async ({ page }) => {
    for (const item of ['About', 'Support', 'Change Password', 'Logout']) {
      await expect(page.getByRole('menuitem', { name: item })).toBeVisible();
    }
  });

  test('About shows company and version information', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'About' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'About' })).toBeVisible();
    await expect(dialog.getByText('Company Name:')).toBeVisible();
    await expect(dialog.getByText('Version:')).toBeVisible();
    await dialog.getByRole('button', { name: '×' }).click();
    await expect(dialog).toBeHidden();
  });

  test('Support opens the help page', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'Support' }).click();
    await expect(page).toHaveURL(/\/help\/support/);
    await expect(page.getByRole('heading', { name: 'Getting Started with OrangeHRM' })).toBeVisible();
  });

  test('Change Password opens the update password form', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'Change Password' }).click();
    await expect(page).toHaveURL(/\/pim\/updatePassword/);
    await expect(page.getByRole('heading', { name: 'Update Password' })).toBeVisible();
  });
});
