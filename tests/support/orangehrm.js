// Shared helpers for the OrangeHRM demo (https://opensource-demo.orangehrmlive.com).
// The demo is public and shared: never rely on pre-existing records, create uniquely named data instead.
import { expect } from '@playwright/test';

export const ADMIN = { username: 'Admin', password: 'admin123' };
export const API = '/web/index.php/api/v2';
export const url = (path) => `/web/index.php${path}`;

/** Short unique suffix for test data, e.g. "lq3k9z1abc". */
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Use in a describe block to run its tests logged out. */
export const LOGGED_OUT = { cookies: [], origins: [] };

export async function login(page, { username, password } = ADMIN) {
  await page.goto(url('/auth/login'));
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

// OrangeHRM labels are not associated with their inputs, so scope to the input group that owns the label.
export function field(scope, label) {
  const root = typeof scope.page === 'function' ? scope.page() : scope;
  return scope
    .locator('.oxd-input-group')
    .filter({ has: root.locator('label').getByText(label, { exact: true }) });
}

export const input = (scope, label) => field(scope, label).locator('input, textarea');

/** Pick an option from an OrangeHRM custom <select>. */
export async function selectOption(scope, label, option) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  await field(scope, label).locator('.oxd-select-text').click();
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
  await expect(field(scope, label).locator('.oxd-select-text')).toContainText(option);
}

/** Type into an autocomplete ("Type for hints...") and pick the matching suggestion. */
export async function autocomplete(scope, label, text, optionName = text) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  await field(scope, label).getByPlaceholder('Type for hints...').fill(text);
  await page.getByRole('listbox').getByRole('option', { name: optionName }).first().click();
}

export async function expectToast(page, text) {
  await expect(page.locator('.oxd-toast').filter({ hasText: text }).first()).toBeVisible();
}

export async function openUserMenu(page) {
  await page.locator('.oxd-userdropdown-tab').click();
  await expect(page.getByRole('menu')).toBeVisible();
}

/** Data rows of the OrangeHRM list table (header row excluded). */
export const tableRows = (page) => page.locator('.oxd-table-body').getByRole('row');

/** Format a Date the way the demo's date inputs expect it: yyyy-dd-mm. */
export function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getDate())}-${pad(date.getMonth() + 1)}`;
}

/** A weekday at least `minDays` from today (skips Saturday/Sunday). */
export function upcomingWeekday(minDays = 7) {
  const d = new Date();
  d.setDate(d.getDate() + minDays);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

// ---- API-based arrangement / cleanup (uses the page's authenticated session) ----

export async function createEmployee(page, overrides = {}) {
  const suffix = uid();
  const data = { firstName: 'Auto', middleName: '', lastName: `Emp${suffix}`, employeeId: suffix.slice(-10), ...overrides };
  const res = await page.request.post(`${API}/pim/employees`, { data });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

export async function deleteEmployees(page, empNumbers) {
  if (empNumbers.length) await page.request.delete(`${API}/pim/employees`, { data: { ids: empNumbers } });
}

export async function createLeaveType(page, name = `LT ${uid()}`) {
  const res = await page.request.post(`${API}/leave/leave-types`, { data: { name, situational: false } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

export async function deleteLeaveTypes(page, ids) {
  if (ids.length) await page.request.delete(`${API}/leave/leave-types`, { data: { ids } });
}
