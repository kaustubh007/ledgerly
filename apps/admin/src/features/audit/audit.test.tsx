import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACME_ID } from '@admin/test/fakeAdminApi';
import { expectNoAxeViolations, renderApp } from '@admin/test/renderApp';

describe('audit log (lazy route)', () => {
  it('lists entries filtered by the URL, with the reason and a link to the organisation', async () => {
    const { container, fake } = renderApp('/audit?action=organization.suspend', (f) => {
      f.state.session = f.state.staff;
      f.state.audit = [
        { action: 'organization.suspend', reason: 'Chargeback dispute #4521', orgId: ACME_ID },
        { action: 'organization.view', reason: null, orgId: ACME_ID },
      ];
    });
    const table = await screen.findByRole('table', { name: 'Audit log' });
    expect(within(table).getAllByRole('row')).toHaveLength(2); // header + one entry
    expect(within(table).getByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      `/organizations/${ACME_ID}`,
    );
    expect(within(table).getByText('Chargeback dispute #4521')).toBeInTheDocument();
    expect(fake.state.received.find((r) => r.operation === 'AuditLog')?.variables).toMatchObject({
      filter: { action: 'organization.suspend' },
    });
    await expectNoAxeViolations(container);
  });
});
