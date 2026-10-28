import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, gql, PASSWORD, signUp, uniqueEmail } from './helpers';

const CREATE_ORG = `mutation ($name: String!) { createOrganization(name: $name) { organization { slug } } }`;
const CREATE_CUSTOMER = `mutation ($name: String!) { createCustomer(input: { name: $name, defaultCurrency: "EUR", documentLocale: "de-DE" }) { userErrors { code } } }`;

test('signs up, lands on the new organisation’s dashboard, and the page is accessible', async ({
  page,
}) => {
  await signUp(page);
  await expect(page.getByText('Analytical Engines (Owner)')).toBeVisible();
  await expect(page.getByText('No open invoices yet.')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('the Phase 3 gate: two organisations in two tabs, each with its own data', async ({
  page,
  context,
}) => {
  const { slug: first } = await signUp(page, 'Grace', 'First Org');
  const { createOrganization } = await gql<{
    createOrganization: { organization: { slug: string } };
  }>(page.request, CREATE_ORG, { name: 'Second Org' });
  const second = createOrganization.organization.slug;
  await gql(page.request, CREATE_CUSTOMER, { name: 'Customer of First' }, first);
  await gql(page.request, CREATE_CUSTOMER, { name: 'Customer of Second' }, second);

  const tabA = page;
  const tabB = await context.newPage();
  await tabA.goto(`/en/o/${first}/customers`);
  await tabB.goto(`/en/o/${second}/customers`);

  // Same user, same cookies, two organisations side by side.
  await expect(tabA.getByRole('cell', { name: 'Customer of First' })).toBeVisible();
  await expect(tabB.getByRole('cell', { name: 'Customer of Second' })).toBeVisible();
  await expect(tabA.getByRole('cell', { name: 'Customer of Second' })).toHaveCount(0);
  await expect(tabB.getByRole('cell', { name: 'Customer of First' })).toHaveCount(0);

  // Working in one tab does not disturb the other.
  await tabB.getByRole('link', { name: 'Dashboard' }).click();
  await tabA.reload();
  await expect(tabA.getByRole('cell', { name: 'Customer of First' })).toBeVisible();
  await expect(tabA.getByText('First Org (Owner)')).toBeVisible();
  await expect(tabB.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // The switcher moves to the same page in the other organisation.
  await tabA.getByText('First Org (Owner)').click();
  await tabA.getByRole('link', { name: /Second Org/ }).click();
  await expect(tabA).toHaveURL(new RegExp(`/en/o/${second}/customers$`));
  await expect(tabA.getByRole('cell', { name: 'Customer of Second' })).toBeVisible();
  await expectNoAxeViolations(tabA);
});

test('restores the session transparently when the access token has expired', async ({
  page,
  context,
}) => {
  const { slug } = await signUp(page);
  await context.clearCookies({ name: '__Host-at' });
  await page.goto(`/en/o/${slug}/customers`);
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === '__Host-at')).toBe(true);
});

test('signing out in one tab signs out the other', async ({ page, context }) => {
  const { slug } = await signUp(page);
  const other = await context.newPage();
  await other.goto(`/en/o/${slug}`);
  await expect(other.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByLabel('Account: Ada').click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/en\/sign-in/);
  await expect(other).toHaveURL(/\/en\/sign-in/);

  await page.goto(`/en/o/${slug}`);
  await expect(page).toHaveURL(/\/en\/sign-in\?next=/);
});

test('sign-in: wrong password is reported, the right one goes back to `next`', async ({
  page,
  context,
}) => {
  const { email, slug } = await signUp(page);
  await context.clearCookies();
  await page.goto(`/en/sign-in?next=${encodeURIComponent(`/en/o/${slug}/customers`)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/o/${slug}/customers$`));
});

test('an organisation you are not a member of is a 404', async ({ page, browser }) => {
  const { slug } = await signUp(page);
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await signUp(strangerPage, 'Mallory', 'Elsewhere');
  await strangerPage.goto(`/en/o/${slug}`);
  await expect(strangerPage.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await stranger.close();
});

test('Arabic renders right-to-left and German is translated', async ({ page }) => {
  await page.goto('/ar/sign-in');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.goto('/de/sign-up');
  await expect(page.getByRole('heading', { name: 'Konto erstellen' })).toBeVisible();
  await page.getByLabel('E-Mail').fill(uniqueEmail());
  await page.getByLabel('E-Mail').fill('kein-email');
  await page.getByLabel('Passwort').focus();
  await expect(page.getByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeVisible();
});
