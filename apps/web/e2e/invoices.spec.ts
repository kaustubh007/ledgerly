import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, gql, signUp } from './helpers';

const CREATE_CUSTOMER = `mutation ($name: String!) { createCustomer(input: { name: $name, defaultCurrency: "USD", documentLocale: "en-US" }) { customer { id } userErrors { code } } }`;
const CREATE_INVOICE = `mutation ($input: CreateInvoiceInput!, $key: ID!) { createInvoice(input: $input, idempotencyKey: $key) { invoice { id } userErrors { code } } }`;
const SEND = `mutation ($id: ID!, $key: ID!) { sendInvoice(id: $id, idempotencyKey: $key) { invoice { number } userErrors { code } } }`;

async function apiCustomer(page: Page, slug: string, name: string): Promise<string> {
  const r = await gql<{ createCustomer: { customer: { id: string } } }>(
    page.request,
    CREATE_CUSTOMER,
    { name },
    slug,
  );
  return r.createCustomer.customer.id;
}

async function apiInvoice(
  page: Page,
  slug: string,
  customerId: string,
  unitPrice: string,
  send: boolean,
): Promise<string> {
  const r = await gql<{ createInvoice: { invoice: { id: string } } }>(
    page.request,
    CREATE_INVOICE,
    {
      key: crypto.randomUUID(),
      input: {
        customerId,
        currency: 'USD',
        dueDate: '2099-01-01',
        lines: [{ description: 'Work', quantity: '1', unitPrice }],
      },
    },
    slug,
  );
  const id = r.createInvoice.invoice.id;
  if (send) await gql(page.request, SEND, { id, key: crypto.randomUUID() }, slug);
  return id;
}

const year = String(new Date().getUTCFullYear());

test('the Phase 4 gate: create a customer and an invoice, send it (numbered), and pay it', async ({
  page,
}) => {
  const { slug } = await signUp(page);

  // Customer, created inline: the list updates from Apollo's cache, without a reload.
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.getByText('Add customer').click();
  await page.getByLabel('Name').fill('Acme Ltd');
  await page.getByLabel('Email').fill('billing@acme.example');
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByRole('link', { name: 'Acme Ltd' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText(
    'Customer Acme Ltd created.',
  );

  // Invoice: two lines, live total computed with the domain's Money.
  await page.goto(`/en/o/${slug}/invoices/new`);
  await page.getByLabel('Description, line 1').fill('Consulting');
  await page.getByLabel('Quantity, line 1').fill('2');
  await page.getByLabel('Unit price, line 1').fill('150');
  await expect(page.getByText('Total: $300.00')).toBeVisible();
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Description, line 2').fill('Expenses');
  await page.getByLabel('Unit price, line 2').fill('25.50');
  await expect(page.getByText('Total: $325.50')).toBeVisible();
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Invoice Draft/ })).toBeVisible();

  // Send: the number is allocated now.
  await page.getByRole('button', { name: 'Send invoice' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(`Invoice INV-${year}-00001`) }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sent');

  // Manual payment, then the rest by (simulated) card.
  const manual = page.getByRole('form', { name: 'Record a payment' });
  await manual.getByLabel('Amount (USD)').fill('100');
  await manual.getByRole('button', { name: 'Record a payment' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Partly paid');
  await expect(page.getByRole('definition').filter({ hasText: '$225.50' })).toBeVisible();

  const card = page.getByRole('form', { name: 'Pay by card' });
  await expect(card.getByLabel('Amount (USD)')).toHaveValue('225.50');
  await card.getByRole('button', { name: 'Pay by card' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Paid');
  const rows = page.getByRole('table').filter({ hasText: 'Method' }).getByRole('row');
  await expect(rows).toHaveCount(3); // header + manual + card
  await expect(rows.nth(2)).toContainText('Card');
  await expectNoAxeViolations(page);
});

test('a double-submitted payment is recorded once', async ({ page }) => {
  const { slug } = await signUp(page);
  const invoiceId = await apiInvoice(
    page,
    slug,
    await apiCustomer(page, slug, 'Twice'),
    '50.00',
    true,
  );
  await page.goto(`/en/o/${slug}/invoices/${invoiceId}`);
  const form = page.getByRole('form', { name: 'Record a payment' });
  await form.getByLabel('Amount (USD)').fill('10');
  // Two submits in the same tick: faster than any button can disable itself.
  await form.evaluate((f: HTMLFormElement) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Partly paid');
  await page.reload();
  const rows = page.getByRole('table').filter({ hasText: 'Method' }).getByRole('row');
  await expect(rows).toHaveCount(2); // header + one payment
  await expect(page.getByRole('definition').filter({ hasText: '$40.00' })).toBeVisible();
});

test('plan limits: the sixth customer needs an upgrade; a declined card changes nothing', async ({
  page,
}) => {
  const { slug } = await signUp(page);
  for (let i = 1; i <= 5; i += 1) await apiCustomer(page, slug, `Customer ${String(i)}`);

  await page.goto(`/en/o/${slug}/customers`);
  await page.getByText('Add customer').click();
  await page.getByLabel('Name').fill('Number six');
  await page.getByRole('button', { name: 'Create customer' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Your plan’s limit is reached.' });
  await expect(alert).toBeVisible();
  await alert.getByRole('link', { name: 'See plans and upgrade' }).click();

  await expect(page.getByText('5 of 5 customers')).toBeVisible();
  await page.getByLabel('New plan').selectOption('PRO');
  await page.getByLabel('Test card').selectOption('pm_card_declined');
  await page.getByRole('button', { name: 'Upgrade to Pro' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'The card was declined.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your plan: Free' })).toBeVisible();

  await page.getByLabel('Test card').selectOption('pm_card_visa');
  await page.getByRole('button', { name: 'Upgrade to Pro' }).click();
  await expect(page.getByRole('heading', { name: 'Your plan: Pro' })).toBeVisible();
  await expect(page.getByText('5 of 500 customers')).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto(`/en/o/${slug}/customers`);
  await page.getByText('Add customer').click();
  await page.getByLabel('Name').fill('Number six');
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByRole('link', { name: 'Number six' })).toBeVisible();
});

test('invoice filters live in the URL and survive a reload', async ({ page }) => {
  const { slug } = await signUp(page);
  const alpha = await apiCustomer(page, slug, 'Alpha');
  const beta = await apiCustomer(page, slug, 'Beta');
  await apiInvoice(page, slug, alpha, '10.00', true);
  await apiInvoice(page, slug, beta, '20.00', false);

  await page.goto(`/en/o/${slug}/invoices`);
  const table = page.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(3);
  await page.getByLabel('Status').selectOption('SENT');
  await expect(page).toHaveURL(/\?status=SENT$/);
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('Alpha');

  await page.reload();
  await expect(page.getByLabel('Status')).toHaveValue('SENT');
  await page.getByLabel('Status').selectOption('');
  await page.getByLabel('Customer').selectOption({ label: 'Beta' });
  await expect(page).toHaveURL(new RegExp(`\\?customer=${beta}$`));
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('Draft');
  await expectNoAxeViolations(page);
});
