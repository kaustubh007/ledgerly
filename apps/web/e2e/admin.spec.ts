import { expect, test } from '@playwright/test';
import { ADMIN_URL, STAFF, totp } from './admin';
import { expectNoAxeViolations, signUp } from './helpers';

// The Phase 5 gate (PLAN §5): staff find an organisation, suspend it with a reason, and the
// tenant's users are blocked. Staff and tenant are separate browsers (contexts): different
// people, different sessions. One test, because a TOTP code is accepted once per 30 seconds.

test('the Phase 5 gate: staff sign in with TOTP, suspend an organisation with a reason, and its users are blocked', async ({
  browser,
}) => {
  const tenantContext = await browser.newContext();
  const tenant = await tenantContext.newPage();
  const orgName = `Suspend Me ${Date.now().toString(36)}`;
  const { slug } = await signUp(tenant, 'Tess Tenant', orgName);

  const staffContext = await browser.newContext({ baseURL: ADMIN_URL });
  const admin = await staffContext.newPage();

  // Guarded: no staff session, so sign-in, remembering where we were going.
  await admin.goto('/organizations');
  await expect(admin.getByRole('heading', { name: 'Sign in to Ledgerly Admin' })).toBeVisible();
  await expect(admin).toHaveURL(/\/sign-in\?next=%2Forganizations$/);
  await expectNoAxeViolations(admin);
  await admin.getByLabel('Email').fill(STAFF.email);
  await admin.getByLabel('Password').fill(STAFF.password);
  await admin.getByRole('button', { name: 'Continue' }).click();

  // First sign-in: enrol the authenticator (we are it), then its code.
  await expect(admin.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
  await expectNoAxeViolations(admin);
  const secret = (await admin.getByTestId('totp-secret').textContent())?.trim() ?? '';
  await admin.getByLabel('Code').fill(totp(secret));
  await admin.getByRole('button', { name: 'Verify' }).click();
  await expect(admin.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
  await expect(admin.getByRole('listitem')).toHaveCount(10);
  await admin.getByRole('link', { name: 'I have saved them, continue' }).click();

  // Find the organisation.
  await expect(admin.getByRole('heading', { name: 'Organisations' })).toBeVisible();
  await admin.getByLabel('Name or slug starts with').fill(orgName);
  await admin.getByRole('button', { name: 'Search' }).click();
  await expect(admin).toHaveURL(/q=Suspend/);
  await expectNoAxeViolations(admin);
  await admin.getByRole('link', { name: orgName }).click();
  await expect(admin.getByRole('heading', { level: 1, name: new RegExp(orgName) })).toBeVisible();
  await expect(admin.getByRole('table', { name: 'Members' })).toContainText('Tess Tenant');
  await expectNoAxeViolations(admin);

  // Suspend, with a reason.
  await admin.getByRole('button', { name: 'Suspend organisation' }).click();
  await admin
    .getByLabel('Reason (written to the audit log)')
    .fill('Chargeback dispute, ticket #4521');
  await admin.getByRole('button', { name: 'Suspend', exact: true }).click();
  await expect(admin.getByRole('region', { name: 'Notifications' })).toContainText(
    `${orgName} is suspended.`,
  );
  await expect(admin.getByRole('heading', { level: 1 })).toContainText('Suspended');

  // The tenant: read-only from the next request, told why, and refused when trying to change.
  await tenant.goto(`/en/o/${slug}/customers`);
  await expect(tenant.getByText('This organisation is suspended.')).toBeVisible();
  await tenant.getByText('Add customer').click();
  await tenant.getByLabel('Name').fill('Blocked Ltd');
  await tenant.getByRole('button', { name: 'Create customer' }).click();
  // (Next.js has its own, empty, route-announcer alert; this is the form's.)
  await expect(
    tenant.getByRole('alert').filter({ hasText: 'This organisation is suspended' }),
  ).toBeVisible();
  await expect(tenant.getByRole('link', { name: 'Blocked Ltd' })).toHaveCount(0);
  await expectNoAxeViolations(tenant);

  // The audit log has it, with the reason.
  await admin.getByRole('link', { name: 'Audit log' }).click();
  const log = admin.getByRole('table', { name: 'Audit log' });
  await expect(log).toContainText('organization.suspend');
  await expect(log).toContainText('Chargeback dispute, ticket #4521');
  await expectNoAxeViolations(admin);

  await staffContext.close();
  await tenantContext.close();
});
