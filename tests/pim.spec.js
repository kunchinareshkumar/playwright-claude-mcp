import { test, expect } from '@playwright/test';
import {
  createEmployee, deleteEmployees, expectToast, field, input, selectOption, tableRows, uid, url,
} from './support/orangehrm.js';

const empNumberFromUrl = (page) => Number(page.url().match(/empNumber\/(\d+)/)[1]);

test.describe('PIM > Employee List', () => {
  let employee;

  test.beforeEach(async ({ page }) => {
    employee = await createEmployee(page, { firstName: 'Srch' });
    await page.goto(url('/pim/viewEmployeeList'));
    await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await deleteEmployees(page, [employee.empNumber]);
  });

  test('shows the employee table columns', async ({ page }) => {
    for (const col of [/^Id/, /^First \(& Middle\) Name/, /^Last Name/, /^Job Title/, /^Employment Status/, /^Sub Unit/, /^Supervisor/]) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
  });

  test('finds an employee by Employee Id', async ({ page }) => {
    await input(page, 'Employee Id').fill(employee.employeeId);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('(1) Record Found')).toBeVisible();
    await expect(tableRows(page).first()).toContainText(employee.lastName);
  });

  test('finds an employee by name using the autocomplete', async ({ page }) => {
    await field(page, 'Employee Name').getByPlaceholder('Type for hints...').fill(employee.lastName);
    await expect(page.getByRole('listbox').getByRole('option', { name: employee.lastName })).toBeVisible();
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('(1) Record Found')).toBeVisible();
    await expect(tableRows(page).first()).toContainText(employee.employeeId);
  });

  test('shows "No Records Found" for an unknown Employee Id', async ({ page }) => {
    await input(page, 'Employee Id').fill(`x${uid()}`.slice(0, 10));
    await page.getByRole('button', { name: 'Search' }).click();
    await expectToast(page, 'No Records Found');
    await expect(tableRows(page)).toHaveCount(0);
  });

  test('Reset clears the search filters', async ({ page }) => {
    await input(page, 'Employee Id').fill(employee.employeeId);
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(input(page, 'Employee Id')).toHaveValue('');
  });

  test('opens an employee from the list', async ({ page }) => {
    await input(page, 'Employee Id').fill(employee.employeeId);
    await page.getByRole('button', { name: 'Search' }).click();
    await tableRows(page).first().getByRole('cell', { name: employee.lastName }).click();
    await expect(page).toHaveURL(new RegExp(`/pim/viewPersonalDetails/empNumber/${employee.empNumber}`));
    await expect(page.getByPlaceholder('Last Name')).toHaveValue(employee.lastName);
  });

  test('deletes an employee from the list', async ({ page }) => {
    await input(page, 'Employee Id').fill(employee.employeeId);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('(1) Record Found')).toBeVisible();
    await tableRows(page).first().locator('button:has(.bi-trash)').click();
    await expect(page.getByText('The selected record will be permanently deleted. Are you sure you want to continue?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expectToast(page, 'Successfully Deleted');
    await expect(tableRows(page)).toHaveCount(0);
  });

  test('keeps the employee when deletion is cancelled', async ({ page }) => {
    await input(page, 'Employee Id').fill(employee.employeeId);
    await page.getByRole('button', { name: 'Search' }).click();
    await tableRows(page).first().locator('button:has(.bi-trash)').click();
    await page.getByRole('button', { name: 'No, Cancel' }).click();
    await expect(tableRows(page)).toHaveCount(1);
  });
});

test.describe('PIM > Add Employee', () => {
  const created = [];

  test.afterEach(async ({ page }) => {
    await deleteEmployees(page, created.splice(0));
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(url('/pim/viewEmployeeList'));
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page).toHaveURL(/\/pim\/addEmployee/);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
  });

  test('requires first and last name', async ({ page }) => {
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Required', { exact: true })).toHaveCount(2);
    await expect(page).toHaveURL(/\/pim\/addEmployee/);
  });

  test('pre-fills an Employee Id', async ({ page }) => {
    await expect(input(page, 'Employee Id')).not.toHaveValue('');
  });

  test('adds an employee and opens their personal details', async ({ page }) => {
    const last = `Add${uid()}`;
    await page.getByPlaceholder('First Name').fill('Pat');
    await page.getByPlaceholder('Middle Name').fill('Q');
    await page.getByPlaceholder('Last Name').fill(last);
    await input(page, 'Employee Id').fill(uid().slice(-10));
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Successfully Saved');
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/);
    created.push(empNumberFromUrl(page));
    await expect(page.getByRole('heading', { name: `Pat ${last}` })).toBeVisible();
    await expect(page.getByPlaceholder('Last Name')).toHaveValue(last);
  });

  test('rejects a duplicate Employee Id', async ({ page }) => {
    const existing = await createEmployee(page);
    created.push(existing.empNumber);
    await input(page, 'Employee Id').fill(existing.employeeId);
    await expect(field(page, 'Employee Id').getByText('Employee Id already exists')).toBeVisible();
  });

  test('rejects names longer than 30 characters', async ({ page }) => {
    await page.getByPlaceholder('First Name').fill('A'.repeat(31));
    await expect(page.getByText('Should not exceed 30 characters')).toBeVisible();
  });

  test('adds an employee with login details', async ({ page }) => {
    const last = `Login${uid()}`;
    const username = `emp_${uid()}`;
    await page.getByPlaceholder('First Name').fill('Lee');
    await page.getByPlaceholder('Last Name').fill(last);
    await input(page, 'Employee Id').fill(uid().slice(-10));
    await page.getByText('Create Login Details').locator('..').locator('.oxd-switch-input').click();
    await input(page, 'Username').fill(username);
    await input(page, 'Password').fill('Passw0rd!2026');
    await input(page, 'Confirm Password').fill('Passw0rd!2026');
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Successfully Saved');
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/);
    created.push(empNumberFromUrl(page));

    // The login account shows up in Admin > User Management.
    await page.goto(url('/admin/viewSystemUsers'));
    await input(page, 'Username').fill(username);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(tableRows(page).first()).toContainText(last);
  });

  test('Cancel returns to the employee list', async ({ page }) => {
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/pim\/viewEmployeeList/);
  });
});

test.describe('PIM > Employee profile', () => {
  let employee;

  test.beforeEach(async ({ page }) => {
    employee = await createEmployee(page, { firstName: 'Prof' });
  });

  test.afterEach(async ({ page }) => {
    await deleteEmployees(page, [employee.empNumber]);
  });

  test('updates personal details and keeps them after reload', async ({ page }) => {
    await page.goto(url(`/pim/viewPersonalDetails/empNumber/${employee.empNumber}`));
    await expect(page.getByPlaceholder('Last Name')).toHaveValue(employee.lastName);
    await page.getByPlaceholder('Middle Name').fill('Edited');
    await input(page, 'Other Id').fill('OID-42');
    await selectOption(page, 'Nationality', 'Canadian');
    await selectOption(page, 'Marital Status', 'Married');
    await page.getByText('Female', { exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expectToast(page, 'Successfully Updated');

    await page.reload();
    await expect(page.getByPlaceholder('Middle Name')).toHaveValue('Edited');
    await expect(input(page, 'Other Id')).toHaveValue('OID-42');
    await expect(field(page, 'Nationality')).toContainText('Canadian');
    await expect(field(page, 'Marital Status')).toContainText('Married');
    await expect(page.getByRole('radio', { name: 'Female' })).toBeChecked();
  });

  test('requires first name when editing personal details', async ({ page }) => {
    await page.goto(url(`/pim/viewPersonalDetails/empNumber/${employee.empNumber}`));
    await expect(page.getByPlaceholder('First Name')).toHaveValue(employee.firstName);
    await page.getByPlaceholder('First Name').clear();
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Required', { exact: true })).toBeVisible();
  });

  test('switches between profile tabs', async ({ page }) => {
    await page.goto(url(`/pim/viewPersonalDetails/empNumber/${employee.empNumber}`));
    const tabs = [
      { name: 'Contact Details', path: /\/pim\/contactDetails/ },
      { name: 'Emergency Contacts', path: /\/pim\/viewEmergencyContacts/ },
      { name: 'Dependents', path: /\/pim\/viewDependents/ },
      { name: 'Immigration', path: /\/pim\/viewImmigration/ },
      { name: 'Job', path: /\/pim\/viewJobDetails/ },
      { name: 'Salary', path: /\/pim\/viewSalaryList/ },
      { name: 'Report-to', path: /\/pim\/viewReportToDetails/ },
      { name: 'Qualifications', path: /\/pim\/viewQualifications/ },
      { name: 'Memberships', path: /\/pim\/viewMemberships/ },
      { name: 'Personal Details', path: /\/pim\/viewPersonalDetails/ },
    ];
    for (const { name, path } of tabs) {
      await page.getByRole('tab', { name }).click();
      await expect(page).toHaveURL(path);
    }
  });

  test('validates and saves contact details', async ({ page }) => {
    await page.goto(url(`/pim/contactDetails/empNumber/${employee.empNumber}`));
    await expect(page.getByRole('heading', { name: 'Contact Details' })).toBeVisible();

    await input(page, 'Work Email').fill('not-an-email');
    await expect(field(page, 'Work Email').getByText('Expected format: admin@example.com')).toBeVisible();
    await input(page, 'Mobile').fill('abc');
    await expect(field(page, 'Mobile').getByText('Allows numbers and only + - / ( )')).toBeVisible();

    const email = `${employee.employeeId}@example.com`;
    await input(page, 'Street 1').fill('1 Test Street');
    await input(page, 'City').fill('Springfield');
    await input(page, 'Mobile').fill('+1 555-0100');
    await input(page, 'Work Email').fill(email);
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Successfully Updated');

    await page.reload();
    await expect(input(page, 'City')).toHaveValue('Springfield');
    await expect(input(page, 'Work Email')).toHaveValue(email);
  });

  test('validates the emergency contact form', async ({ page }) => {
    await page.goto(url(`/pim/viewEmergencyContacts/empNumber/${employee.empNumber}`));
    await page.getByRole('button', { name: 'Add' }).first().click();
    await expect(page.getByRole('heading', { name: 'Save Emergency Contact' })).toBeVisible();
    await expect(page.locator('.oxd-form-loader')).toBeHidden();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(field(page, 'Name').getByText('Required')).toBeVisible();
    await expect(field(page, 'Relationship').getByText('Required')).toBeVisible();
    await expect(page.getByText('At least one phone number is required')).toBeVisible();
  });

  test('adds and deletes an emergency contact', async ({ page }) => {
    await page.goto(url(`/pim/viewEmergencyContacts/empNumber/${employee.empNumber}`));
    await page.getByRole('button', { name: 'Add' }).first().click();
    await expect(page.getByRole('heading', { name: 'Save Emergency Contact' })).toBeVisible();
    await expect(page.locator('.oxd-form-loader')).toBeHidden();

    await input(page, 'Name').fill('Jamie Contact');
    await input(page, 'Relationship').fill('Sibling');
    await input(page, 'Mobile').fill('555-0101');
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Successfully Saved');
    const row = tableRows(page).filter({ hasText: 'Jamie Contact' });
    await expect(row).toContainText('Sibling');

    await row.locator('button:has(.bi-trash)').click();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expectToast(page, 'Successfully Deleted');
    await expect(row).toHaveCount(0);
  });
});
