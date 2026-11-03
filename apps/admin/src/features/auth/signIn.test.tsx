import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderApp } from '@admin/test/renderApp';

describe('sign-in (route actions)', () => {
  it('sends an anonymous visitor to sign-in, remembering where they were going', async () => {
    const { router, container } = renderApp('/organizations?q=acme');
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Ledgerly Admin' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/organizations?q=acme')}`,
    );
    await expectNoAxeViolations(container);
  });

  it('refuses a wrong password with a translated, announced error', async () => {
    const { user } = renderApp('/sign-in');
    await user.type(await screen.findByLabelText('Email'), 'ops@ledgerly.example');
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
  });
});

describe('sign-in with mandatory TOTP', () => {
  it('enrols on the first sign-in, shows recovery codes once, then returns to the page asked for', async () => {
    const { user, router, store } = renderApp('/organizations?q=acme');
    await user.type(await screen.findByLabelText('Email'), 'ops@ledgerly.example');
    await user.type(screen.getByLabelText('Password'), 'correct password');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Enrolment: the secret to add to an authenticator app, then its code.
    expect(
      await screen.findByRole('heading', { name: 'Two-step verification' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('totp-secret')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    await user.type(screen.getByLabelText('Code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('That code is not valid.')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true');

    await user.clear(screen.getByLabelText('Code'));
    await user.type(screen.getByLabelText('Code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(
      await screen.findByRole('heading', { name: 'Save your recovery codes' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'k3m9-x2pq',
      'a7c4-r8tw',
    ]);

    await user.click(screen.getByRole('link', { name: 'I have saved them, continue' }));
    expect(await screen.findByRole('heading', { name: 'Organisations' })).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/organizations?q=acme',
    );
    // The codes and the secret are gone from memory.
    expect(store.getState().authFlow).toEqual({ enrolment: null, recoveryCodes: null });
  });

  it('asks a returning staff member for a code only, and goes straight on', async () => {
    const { user, router } = renderApp('/sign-in?next=%2Faudit', (fake) => {
      fake.state.enrolled = true;
    });
    await user.type(await screen.findByLabelText('Email'), 'ops@ledgerly.example');
    await user.type(screen.getByLabelText('Password'), 'correct password');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/Enter the 6-digit code/)).toBeInTheDocument();
    expect(screen.queryByTestId('totp-secret')).toBeNull();
    await user.type(screen.getByLabelText('Code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/audit');
  });

  it('never follows a `next` to another site', async () => {
    const { user, router } = renderApp('/sign-in?next=%2F%2Fevil.example', (fake) => {
      fake.state.enrolled = true;
    });
    await user.type(await screen.findByLabelText('Email'), 'ops@ledgerly.example');
    await user.type(screen.getByLabelText('Password'), 'correct password');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText('Code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('heading', { name: 'Organisations' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/organizations');
  });
});
