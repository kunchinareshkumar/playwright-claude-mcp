import { test, expect } from '@playwright/test';
import {
  autocomplete, createEmployee, createLeaveType, deleteEmployees, deleteLeaveTypes, expectToast, field, formatDate,
  input, selectOption, tableRows, uid, upcomingWeekday, url,
} from './support/orangehrm.js';

test.describe('Leave > Leave List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url('/leave/viewLeaveList'));
    await expect(page.getByRole('heading', { name: 'Leave List' })).toBeVisible();
  });

  test('defaults to the current year and "Pending Approval"', async ({ page }) => {
    const year = new Date().getFullYear();
    await expect(input(page, 'From Date')).toHaveValue(`${year}-01-01`);
    await expect(input(page, 'To Date')).toHaveValue(`${year}-31-12`);
    await expect(field(page, 'Show Leave with Status')).toContainText('Pending Approval');
  });

  test('requires at least one leave status', async ({ page }) => {
    await field(page, 'Show Leave with Status').locator('.oxd-chip .bi-x').click();
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(field(page, 'Show Leave with Status').getByText('Required')).toBeVisible();
  });

  test('rejects a To Date before the From Date', async ({ page }) => {
    const year = new Date().getFullYear();
    await input(page, 'From Date').fill(`${year}-10-10`);
    await input(page, 'To Date').fill(`${year}-01-10`);
    await page.getByRole('heading', { name: 'Leave List' }).click();
    await expect(field(page, 'To Date').getByText('To date should be after from date')).toBeVisible();
  });

  test('Reset restores the default filters', async ({ page }) => {
    await selectOption(page, 'Show Leave with Status', 'Scheduled');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(field(page, 'Show Leave with Status')).not.toContainText('Scheduled');
    await expect(field(page, 'Show Leave with Status')).toContainText('Pending Approval');
  });
});

test.describe('Leave > forms', () => {
  test('Assign Leave requires employee, leave type and dates', async ({ page }) => {
    await page.goto(url('/leave/assignLeave'));
    await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();
    await page.getByRole('button', { name: 'Assign' }).click();
    for (const label of ['Employee Name', 'Leave Type', 'From Date', 'To Date']) {
      await expect(field(page, label).getByText('Required')).toBeVisible();
    }
  });

  test('Add Entitlement requires employee, leave type and entitlement', async ({ page }) => {
    await page.goto(url('/leave/addLeaveEntitlement'));
    await page.getByRole('button', { name: 'Save' }).click();
    for (const label of ['Employee Name', 'Leave Type', 'Entitlement']) {
      await expect(field(page, label).getByText('Required')).toBeVisible();
    }
  });

  test('Add Entitlement rejects a non-numeric entitlement', async ({ page }) => {
    await page.goto(url('/leave/addLeaveEntitlement'));
    await input(page, 'Entitlement').fill('abc');
    await expect(field(page, 'Entitlement').getByText('Should be a number with upto 2 decimal places')).toBeVisible();
  });

  test('Apply Leave and My Leave pages open for the logged-in user', async ({ page }) => {
    await page.goto(url('/leave/applyLeave'));
    await expect(page.getByRole('heading', { name: 'Apply Leave' })).toBeVisible();
    await page.goto(url('/leave/viewMyLeaveList'));
    await expect(page.getByRole('heading', { name: 'My Leave List' })).toBeVisible();
  });
});

test.describe('Leave > Configure > Leave Types', () => {
  test('adds, rejects a duplicate of and deletes a leave type', async ({ page }) => {
    const name = `QA Leave ${uid()}`;
    await page.goto(url('/leave/leaveTypeList'));
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('heading', { name: 'Add Leave Type' })).toBeVisible();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(field(page, 'Name').getByText('Required')).toBeVisible();

    await input(page, 'Name').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Successfully Saved');
    await expect(page).toHaveURL(/\/leave\/leaveTypeList/);
    const row = tableRows(page).filter({ hasText: name });
    await expect(row).toHaveCount(1);

    await page.getByRole('button', { name: 'Add' }).click();
    await input(page, 'Name').fill(name);
    await expect(field(page, 'Name').getByText('Already exists')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await row.locator('button:has(.bi-trash)').click();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expectToast(page, 'Successfully Deleted');
    await expect(row).toHaveCount(0);
  });
});

test.describe('Leave > end-to-end', () => {
  let employee;
  let leaveType;

  test.beforeEach(async ({ page }) => {
    employee = await createEmployee(page, { firstName: 'Lv' });
    leaveType = await createLeaveType(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteEmployees(page, [employee.empNumber]);
    await deleteLeaveTypes(page, [leaveType.id]);
  });

  test('entitles an employee, assigns leave and finds it in the leave list', async ({ page }) => {
    const employeeName = `Lv ${employee.lastName}`;
    const leaveDate = formatDate(upcomingWeekday());
    test.skip(!leaveDate.startsWith(String(new Date().getFullYear())), 'leave date falls outside the current leave period');

    await test.step('add a 5 day entitlement', async () => {
      await page.goto(url('/leave/addLeaveEntitlement'));
      await autocomplete(page, 'Employee Name', employeeName, employee.lastName);
      await selectOption(page, 'Leave Type', leaveType.name);
      await input(page, 'Entitlement').fill('5');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Updating Entitlement')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm' }).click();
      await expectToast(page, 'Successfully Saved');
      await expect(page).toHaveURL(/\/leave\/viewLeaveEntitlements/);
      await expect(tableRows(page).filter({ hasText: leaveType.name })).toContainText('5.00');
    });

    await test.step('assign one day of leave', async () => {
      await page.goto(url('/leave/assignLeave'));
      await autocomplete(page, 'Employee Name', employeeName, employee.lastName);
      await selectOption(page, 'Leave Type', leaveType.name);
      await expect(field(page, 'Leave Balance')).toContainText('5.00 Day(s)');
      await input(page, 'From Date').fill(leaveDate);
      await input(page, 'Comments').click();
      await expect(input(page, 'To Date')).toHaveValue(leaveDate);
      await input(page, 'Comments').fill('Assigned by Playwright');
      await page.getByRole('button', { name: 'Assign' }).click();
      await expectToast(page, 'Successfully Saved');
    });

    await test.step('the leave is listed as Scheduled', async () => {
      await page.goto(url('/leave/viewLeaveList'));
      await selectOption(page, 'Show Leave with Status', 'Scheduled');
      await autocomplete(page, 'Employee Name', employeeName, employee.lastName);
      await page.getByRole('button', { name: 'Search' }).click();
      const row = tableRows(page).filter({ hasText: leaveType.name });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Scheduled');
      await expect(row).toContainText(leaveDate);
    });

    await test.step('cancel the leave', async () => {
      await tableRows(page).filter({ hasText: leaveType.name }).getByRole('button', { name: 'Cancel' }).click();
      await expectToast(page, 'Successfully Updated');
    });
  });
});
