import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CSRF_HEADER, getRefresher } from '@web/lib/auth/refresh';
import { expectNoAxeViolations, renderWithProviders, sessionState } from '@web/test/render';
import { LOGOUT_URL } from './constants';
import { UserMenu } from './UserMenu';

vi.mock('@web/lib/auth/refresh', () => {
  const refresher = { refresh: vi.fn(), announceSignedOut: vi.fn(), onSignedOut: vi.fn() };
  return { CSRF_HEADER: 'x-ledgerly-csrf', getRefresher: () => refresher };
});

describe('UserMenu', () => {
  it('signs out on the server, tells the other tabs, then leaves', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const leave = vi.fn();
    const { container } = renderWithProviders(<UserMenu onSignedOut={leave} />, {
      preloadedState: { session: sessionState() },
    });
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByText('Ada'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(fetch).toHaveBeenCalledWith(
      LOGOUT_URL,
      expect.objectContaining({ method: 'POST', headers: { [CSRF_HEADER]: '1' } }),
    );
    expect(getRefresher().announceSignedOut).toHaveBeenCalled();
    expect(leave).toHaveBeenCalledWith('/en/sign-in');
    fetch.mockRestore();
  });

  it('still signs out locally if the network call fails', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const leave = vi.fn();
    renderWithProviders(<UserMenu onSignedOut={leave} />, {
      preloadedState: { session: sessionState() },
    });
    await userEvent.click(screen.getByText('Ada'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await vi.waitFor(() => expect(leave).toHaveBeenCalled());
    fetch.mockRestore();
  });
});
