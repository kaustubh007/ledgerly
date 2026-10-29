import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'correct horse battery staple';

export function uniqueEmail(): string {
  return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Signs up through the real form and waits for the dashboard. Returns the org slug. */
export async function signUp(
  page: Page,
  name = 'Ada',
  orgName = 'Analytical Engines',
): Promise<{ email: string; slug: string }> {
  const email = uniqueEmail();
  await page.goto('/en/sign-up');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel('Organisation name').fill(orgName);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const slug = /\/en\/o\/([^/]+)/.exec(page.url())?.[1];
  if (!slug) throw new Error(`not on an org page: ${page.url()}`);
  return { email, slug };
}

/** Calls the API as the page's user (same cookies), optionally in an organisation. */
export async function gql<T = Record<string, unknown>>(
  request: APIRequestContext,
  query: string,
  variables: Record<string, unknown> = {},
  org?: string,
): Promise<T> {
  const response = await request.post('/graphql', {
    data: { query, variables },
    headers: { 'content-type': 'application/json', ...(org ? { 'x-org': org } : {}) },
  });
  const body = (await response.json()) as { data?: T; errors?: unknown };
  if (body.errors || !body.data) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}
