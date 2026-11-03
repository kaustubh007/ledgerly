import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@admin/test/renderApp';

describe('session', () => {
  it('sends the staff member to sign-in when the API says the session has ended', async () => {
    const { user, fake, router, store } = renderApp('/organizations', (f) => {
      f.state.session = f.state.staff;
    });
    expect(await screen.findByRole('heading', { name: 'Organisations' })).toBeInTheDocument();
    fake.state.session = null; // 30 minutes idle, or revoked
    await user.click(screen.getByRole('link', { name: 'Audit log' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Ledgerly Admin' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    // Nothing cached from the old session survives.
    expect(store.getState().adminApi.queries).toEqual({});
    // No toast for this: the sign-in page is the message.
    expect(store.getState().toasts.ids).toEqual([]);
  });

  it('signs out', async () => {
    const { user, fake } = renderApp('/organizations', (f) => {
      f.state.session = f.state.staff;
    });
    expect(await screen.findByText('Signed in as Olu Ops (OPS)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Ledgerly Admin' }),
    ).toBeInTheDocument();
    expect(fake.state.session).toBeNull();
  });
});
