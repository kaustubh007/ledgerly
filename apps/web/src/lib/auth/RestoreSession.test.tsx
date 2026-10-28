import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@web/test/render';
import { nav, nextNavigationMock, router } from '@web/test/navigation-mocks';
import { getRefresher } from './refresh';
import { RestoreSession } from './RestoreSession';

vi.mock('next/navigation', () => nextNavigationMock);
vi.mock('./refresh', () => {
  const refresher = { refresh: vi.fn(), announceSignedOut: vi.fn(), onSignedOut: vi.fn() };
  return { getRefresher: () => refresher };
});

beforeEach(() => {
  router.refresh.mockReset();
  router.replace.mockReset();
});

describe('RestoreSession', () => {
  it('refreshes the session and re-renders the page from the server', async () => {
    nav.pathname = '/en/o/acme';
    vi.mocked(getRefresher().refresh).mockResolvedValue(true);
    renderWithProviders(<RestoreSession />);
    expect(screen.getByRole('status')).toHaveTextContent('Restoring your session…');
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sends the user to sign-in, coming back afterwards, when the session is over', async () => {
    nav.pathname = '/de/o/acme/customers';
    vi.mocked(getRefresher().refresh).mockResolvedValue(false);
    renderWithProviders(<RestoreSession />);
    await vi.waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/de/sign-in?next=%2Fde%2Fo%2Facme%2Fcustomers'),
    );
  });

  it('does not loop: if the server still sees no session after a refresh, go to sign-in', async () => {
    nav.pathname = '/en/o/loop';
    vi.mocked(getRefresher().refresh).mockResolvedValue(true);
    const first = renderWithProviders(<RestoreSession />);
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    first.unmount();
    renderWithProviders(<RestoreSession />);
    await vi.waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/en/sign-in?next=%2Fen%2Fo%2Floop'),
    );
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
