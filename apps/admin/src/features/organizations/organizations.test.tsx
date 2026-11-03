import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACME_ID, GLOBEX_ID, type createFakeAdminApi } from '@admin/test/fakeAdminApi';
import { expectNoAxeViolations, renderApp } from '@admin/test/renderApp';

type Fake = ReturnType<typeof createFakeAdminApi>;
const asOps = (fake: Fake) => {
  fake.state.session = fake.state.staff;
};
const asSupport = (fake: Fake) => {
  fake.state.staff = { ...fake.state.staff, role: 'SUPPORT' };
  fake.state.session = fake.state.staff;
};

describe('organisation list', () => {
  it('is driven by the URL: the loader fetches what the search params say, before rendering', async () => {
    const { container, fake } = renderApp('/organizations?status=SUSPENDED', asOps);
    const table = await screen.findByRole('table', { name: 'Organisations' });
    expect(
      within(table)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Globex']);
    expect(fake.state.received.filter((r) => r.operation === 'Organizations')).toHaveLength(1);
    expect(fake.state.received[0]?.variables).toMatchObject({ status: 'SUSPENDED', search: null });
    expect(screen.getByLabelText('Status')).toHaveValue('SUSPENDED');
    await expectNoAxeViolations(container);
  });

  it('searches by submitting the form, which rewrites the URL', async () => {
    const { user, router } = renderApp('/organizations', asOps);
    await user.type(await screen.findByLabelText('Name or slug starts with'), 'acm');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=acm&status='));
    const table = await screen.findByRole('table', { name: 'Organisations' });
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole('link')
          .map((a) => a.textContent),
      ).toEqual(['Acme']),
    );
  });
});

describe('organisation detail (lazy route)', () => {
  it('shows counts, limits and per-currency totals, and SUPPORT staff get no actions', async () => {
    const { container } = renderApp(`/organizations/${ACME_ID}`, asSupport);
    expect(await screen.findByRole('heading', { level: 1, name: /Acme/ })).toBeInTheDocument();
    const usage = screen.getByRole('table', { name: /Usage/ });
    expect(within(usage).getByRole('row', { name: /Customers 3 5/ })).toBeInTheDocument();
    const outstanding = screen.getByRole('table', { name: /Outstanding/ });
    expect(within(outstanding).getByText('US$1,234.50')).toBeInTheDocument();
    expect(within(outstanding).getByText('€80.00')).toBeInTheDocument();
    expect(screen.getByText('Changes need the OPS role.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Suspend/ })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('shows the 404 errorElement inside the layout for an unknown organisation', async () => {
    renderApp('/organizations/a00000000000000000000099', asOps);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('No such organisation.')).toBeInTheDocument();
    // The layout (and its navigation) is still there: the error is the child route's.
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('remembers opened organisations under "Recently viewed"', async () => {
    const { user } = renderApp(`/organizations/${GLOBEX_ID}`, asOps);
    await screen.findByRole('heading', { level: 1, name: /Globex/ });
    await user.click(screen.getByRole('link', { name: 'Organisations' }));
    await user.click(await screen.findByRole('link', { name: 'Acme' }));
    await screen.findByRole('heading', { level: 1, name: /Acme/ });
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('heading', { name: 'Recently viewed' })).toBeInTheDocument();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Organisations', 'Audit log', 'Acme', 'Globex']);
  });
});

describe('OPS actions', () => {
  it('needs a reason of 10 characters before asking the API', async () => {
    const { user, fake } = renderApp(`/organizations/${ACME_ID}`, asOps);
    await user.click(await screen.findByRole('button', { name: 'Suspend organisation' }));
    await user.type(screen.getByLabelText('Reason (written to the audit log)'), 'because');
    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(screen.getByText('Give a reason of at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason (written to the audit log)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(fake.state.audit).toEqual([]);
  });

  it('suspends, showing the new status at once, and records the reason', async () => {
    const { user, fake } = renderApp(`/organizations/${ACME_ID}`, asOps);
    await user.click(await screen.findByRole('button', { name: 'Suspend organisation' }));
    await user.type(
      screen.getByLabelText('Reason (written to the audit log)'),
      'Chargeback dispute #4521',
    );
    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText('Acme is suspended.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Suspended');
    expect(screen.getByRole('button', { name: 'Unsuspend organisation' })).toBeInTheDocument();
    expect(fake.state.audit[0]).toMatchObject({
      action: 'suspendOrganization',
      reason: 'Chargeback dispute #4521',
    });
  });

  it('rolls the optimistic status back, with a toast, when the server refuses', async () => {
    const { user } = renderApp(`/organizations/${ACME_ID}`, (fake) => {
      asOps(fake);
      fake.state.failSuspendWith = 'FORBIDDEN';
    });
    await user.click(await screen.findByRole('button', { name: 'Suspend organisation' }));
    await user.type(
      screen.getByLabelText('Reason (written to the audit log)'),
      'Chargeback dispute #4521',
    );
    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    // Optimistic: before the server's (delayed, 200 ms) answer.
    await waitFor(
      () => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Suspended'),
      {
        interval: 10,
      },
    );
    // Refused: the error middleware explains why, and the patch is undone.
    expect(
      await screen.findByText('This needs the OPS role.', { selector: 'li span' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Active'),
    );
  });

  it('changes the plan once the server confirms it', async () => {
    const { user } = renderApp(`/organizations/${ACME_ID}`, asOps);
    await user.click(await screen.findByRole('button', { name: 'Change plan' }));
    await user.selectOptions(screen.getByLabelText('New plan'), 'BUSINESS');
    await user.type(
      screen.getByLabelText('Reason (written to the audit log)'),
      'Enterprise trial, ticket #77',
    );
    await user.click(screen.getByRole('button', { name: 'Change plan' }));
    expect(await screen.findByText('Acme is now on BUSINESS.')).toBeInTheDocument();
    expect(screen.getByText('BUSINESS', { selector: 'dd' })).toBeInTheDocument();
  });

  it('signs one member out everywhere', async () => {
    const { user, fake } = renderApp(`/organizations/${ACME_ID}`, asOps);
    // The visible text is the same in every row; the hidden name tells them apart.
    await user.click(await screen.findByRole('button', { name: /Sign out everywhere.*Ada Owner/ }));
    await user.type(
      screen.getByLabelText('Reason (written to the audit log)'),
      'Reported stolen laptop',
    );
    await user.click(screen.getByRole('button', { name: 'Sign out of all sessions' }));
    expect(await screen.findByText('Signed out of 2 sessions.')).toBeInTheDocument();
    const members = screen.getByRole('table', { name: 'Members' });
    const row = within(members).getByRole('row', { name: /Ada Owner/ });
    expect(within(row).getByText('0')).toBeInTheDocument();
    expect(fake.state.audit[0]).toMatchObject({
      action: 'user.revokeSessions',
      reason: 'Reported stolen laptop',
    });
  });
});
