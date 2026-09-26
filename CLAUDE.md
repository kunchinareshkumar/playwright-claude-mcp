# Playwright test conventions (read by Claude Code and the agent runner)

- Language: JavaScript (ESM), `@playwright/test`. Never generate TypeScript files.
- Tests live in `tests/`, named `<feature>.spec.js`. Plans live in `specs/<feature>.md`.
- Start every test from the seed pattern in `tests/seed.spec.js`; use relative `page.goto('/...')` (baseURL is in config).
- Locators, in order of preference: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId`. No XPath, no nth-child CSS.
- Use web-first assertions (`await expect(locator).toBeVisible()`); never `waitForTimeout`.
- One user flow per `test()`; group with `test.describe`. Tests must be independent and parallel-safe.
- If the app itself is broken (not the test), mark `test.fixme()` with a comment explaining why — never weaken an assertion to make it pass.
- Run tests with `npx playwright test <file> --reporter=list`.
