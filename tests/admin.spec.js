import { test, expect } from '@playwright/test';
import {
  LOGGED_OUT, autocomplete, createEmployee, deleteEmployees, expectToast, field, input, login, selectOption,
  tableRows, uid, url,
} from './support/orangehrm.js';

const PASSWORD = 'Passw0rd!2026';

async function deleteRow(page, row) {
  await row.locator('button:has(.bi-trash)').click();
  await page.getByRole('button', { name: 'Yes, Delete' }).click();
  await expectToast(page, 'Successfully Deleted');
}

test.describe('Admin > User Management > search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/admin/viewSystemUsers'));
    await expect(page.getByRole('heading', { name: 'System Users' })).toBeVisible();
  });

  test('lists system users with the expected columns', async ({ page }) => {
    for (const col of ['Username', 'User Role', 'Employee Name', 'Status', 'Actions']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
    await expect(page.getByText(/\(\d+\) Records? Found/)).toBeVisible();
  });

  test('finds a user by exact username', async ({ page }) => {
    await input(page, 'Username').fill('Admin');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('(1) Record Found')).toBeVisible();
    await expect(tableRows(page).first().getByRole('cell', { name: 'Admin', exact: true }).first()).toBeVisible();
  });

  test('filters by user role', async ({ page }) => {
    await selectOption(page, 'User Role', 'Admin');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(/\(\d+\) Records? Found/)).toBeVisible();
    await expect(tableRows(page).first()).toBeVisible();
    await expect(tableRows(page).getByRole('cell', { name: 'ESS', exact: true })).toHaveCount(0);
  });

  test('filters by status', async ({ page }) => {
    await selectOption(page, 'Status', 'Enabled');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(/\(\d+\) Records? Found/)).toBeVisible();
    await expect(tableRows(page).getByRole('cell', { name: 'Disabled', exact: true })).toHaveCount(0);
  });

  test('shows "No Records Found" for an unknown username', async ({ page }) => {
    await input(page, 'Username').fill(`nobody_${uid()}`);
    await page.getByRole('button', { name: 'Search' }).click();
    await expectToast(page, 'No Records Found');
    await expect(page.getByText('No Records Found', { exact: true }).first()).toBeVisible();
    await expect(tableRows(page)).toHaveCount(0);
  });

  test('Reset clears the filters', async ({ page }) => {
    await input(page, 'Username').fill('Admin');
    await selectOption(page, 'User Role', 'Admin');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(input(page, 'Username')).toHaveValue('');
    await expect(field(page, 'User Role')).toContainText('-- Select --');
  });
});

test.describe('Admin > Add User validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/admin/viewSystemUsers'));
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page).toHaveURL(/\/admin\/saveSystemUser/);
    await expect(page.getByRole('heading', { name: 'Add User' })).toBeVisible();
  });

  test('requires every mandatory field', async ({ page }) => {
    await page.getByRole('button', { name: 'Save' }).click();
    for (const label of ['User Role', 'Employee Name', 'Status', 'Username', 'Password']) {
      await expect(field(page, label).getByText('Required')).toBeVisible();
    }
    await expect(page).toHaveURL(/\/admin\/saveSystemUser/);
  });

  test('rejects a username shorter than 5 characters', async ({ page }) => {
    await input(page, 'Username').fill('abc');
    await expect(field(page, 'Username').getByText('Should be at least 5 characters')).toBeVisible();
  });

  test('rejects a username that already exists', async ({ page }) => {
    await input(page, 'Username').fill('Admin');
    await expect(field(page, 'Username').getByText('Already exists')).toBeVisible();
  });

  test('rejects a password shorter than 7 characters', async ({ page }) => {
    await input(page, 'Password').fill('ab1');
    await expect(field(page, 'Password').getByText('Should have at least 7 characters')).toBeVisible();
  });

  test('rejects a password without a number', async ({ page }) => {
    await input(page, 'Password').fill('abcdefgh');
    await expect(field(page, 'Password').getByText('Your password must contain minimum 1 number')).toBeVisible();
  });

  test('rejects a confirmation that does not match', async ({ page }) => {
    await input(page, 'Password').fill(PASSWORD);
    await input(page, 'Confirm Password').fill(`${PASSWORD}x`);
    await expect(field(page, 'Confirm Password').getByText('Passwords do not match')).toBeVisible();
  });

  test('rejects an employee name not picked from the suggestions', async ({ page }) => {
    await field(page, 'Employee Name').getByPlaceholder('Type for hints...').fill(`Ghost ${uid()}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(field(page, 'Employee Name').getByText('Invalid')).toBeVisible();
  });

  test('Cancel returns to the user list', async ({ page }) => {
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/admin\/viewSystemUsers/);
  });
});

test.describe('Admin > system user lifecycle', () => {
  let employee;

  test.beforeEach(async ({ page }) => {
    employee = await createEmployee(page, { firstName: 'Usr' });
  });

  test.afterEach(async ({ page }) => {
    await deleteEmployees(page, [employee.empNumber]);
  });

  test('creates an ESS user, logs in as them, edits and deletes the user', async ({ page, browser }) => {
    const username = `ess_${uid()}`;

    await test.step('create the user', async () => {
      await page.goto(url('/admin/saveSystemUser'));
      await selectOption(page, 'User Role', 'ESS');
      await autocomplete(page, 'Employee Name', `Usr ${employee.lastName}`, employee.lastName);
      await selectOption(page, 'Status', 'Enabled');
      await input(page, 'Username').fill(username);
      await input(page, 'Password').fill(PASSWORD);
      await input(page, 'Confirm Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Save' }).click();
      await expectToast(page, 'Successfully Saved');
      await expect(page).toHaveURL(/\/admin\/viewSystemUsers/);
    });

    await test.step('find the user by username', async () => {
      await input(page, 'Username').fill(username);
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page.getByText('(1) Record Found')).toBeVisible();
      const row = tableRows(page).first();
      await expect(row).toContainText(username);
      await expect(row).toContainText('ESS');
      await expect(row).toContainText('Enabled');
    });

    await test.step('log in as the new ESS user and see a restricted menu', async () => {
      const context = await browser.newContext({ storageState: LOGGED_OUT });
      const essPage = await context.newPage();
      await login(essPage, { username, password: PASSWORD });
      await expect(essPage).toHaveURL(/\/dashboard\/index/);
      const menu = essPage.getByRole('navigation', { name: 'Sidepanel' });
      await expect(menu.getByRole('link', { name: 'My Info' })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Admin' })).toHaveCount(0);
      await expect(menu.getByRole('link', { name: 'PIM' })).toHaveCount(0);
      await context.close();
    });

    await test.step('disable the user', async () => {
      await tableRows(page).first().locator('button:has(.bi-pencil-fill)').click();
      await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible();
      await expect(input(page, 'Username')).toHaveValue(username);
      await selectOption(page, 'Status', 'Disabled');
      await page.getByRole('button', { name: 'Save' }).click();
      await expectToast(page, 'Successfully Updated');
      await expect(page).toHaveURL(/\/admin\/viewSystemUsers/);
      await input(page, 'Username').fill(username);
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(tableRows(page).first()).toContainText('Disabled');
    });

    await test.step('a disabled user cannot log in', async () => {
      const context = await browser.newContext({ storageState: LOGGED_OUT });
      const essPage = await context.newPage();
      await login(essPage, { username, password: PASSWORD });
      await expect(essPage.getByRole('alert')).toContainText('Account disabled');
      await context.close();
    });

    await test.step('delete the user', async () => {
      await deleteRow(page, tableRows(page).first());
      await input(page, 'Username').fill(username);
      await page.getByRole('button', { name: 'Search' }).click();
      await expectToast(page, 'No Records Found');
    });
  });
});

test.describe('Admin > Job > Job Titles', () => {
  test('navigates to Job Titles from the top menu', async ({ page }) => {
    await page.goto(url('/admin/viewSystemUsers'));
    await page.getByRole('navigation', { name: 'Topbar Menu' }).getByText('Job').click();
    await page.getByRole('menuitem', { name: 'Job Titles' }).click();
    await expect(page).toHaveURL(/\/admin\/viewJobTitleList/);
    await expect(page.getByRole('heading', { name: 'Job Titles' })).toBeVisible();
  });

  test('requires a job title', async ({ page }) => {
    await page.goto(url('/admin/viewJobTitleList'));
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('heading', { name: 'Add Job Title' })).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(field(page, 'Job Title').getByText('Required')).toBeVisible();
  });

  test('adds, rejects a duplicate of, edits and deletes a job title', async ({ page }) => {
    const title = `QA Auto ${uid()}`;
    const renamed = `${title} v2`;

    await test.step('add', async () => {
      await page.goto(url('/admin/viewJobTitleList'));
      await page.getByRole('button', { name: 'Add' }).click();
      await expect(page.getByRole('heading', { name: 'Add Job Title' })).toBeVisible();
      await input(page, 'Job Title').fill(title);
      await input(page, 'Job Description').fill('Created by Playwright');
      await input(page, 'Note').fill('Temporary record');
      await page.getByRole('button', { name: 'Save' }).click();
      await expectToast(page, 'Successfully Saved');
      await expect(page).toHaveURL(/\/admin\/viewJobTitleList/);
      await expect(tableRows(page).filter({ hasText: title })).toHaveCount(1);
    });

    await test.step('duplicate is rejected', async () => {
      await page.getByRole('button', { name: 'Add' }).click();
      await input(page, 'Job Title').fill(title);
      await expect(field(page, 'Job Title').getByText('Already exists')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page).toHaveURL(/\/admin\/viewJobTitleList/);
    });

    await test.step('edit', async () => {
      await tableRows(page).filter({ hasText: title }).locator('button:has(.bi-pencil-fill)').click();
      await expect(page.getByRole('heading', { name: 'Edit Job Title' })).toBeVisible();
      await expect(input(page, 'Job Title')).toHaveValue(title);
      await input(page, 'Job Title').fill(renamed);
      await page.getByRole('button', { name: 'Save' }).click();
      await expectToast(page, 'Successfully Updated');
      await expect(tableRows(page).filter({ hasText: renamed })).toHaveCount(1);
    });

    await test.step('delete', async () => {
      await deleteRow(page, tableRows(page).filter({ hasText: renamed }));
      await expect(tableRows(page).filter({ hasText: renamed })).toHaveCount(0);
    });
  });
});
