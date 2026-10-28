import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithProviders, sessionState } from '@web/test/render';
import { i18nNavigationMock, nav, nextNavigationMock } from '@web/test/navigation-mocks';
import { toastAdded } from '@web/store/slices/toasts';
import { useAppDispatch } from '@web/store/hooks';
import { AppShell } from './AppShell';
import { hrefInOrg, OrgSwitcher } from './OrgSwitcher';
import { TOAST_TIMEOUT_MS, Toaster } from './Toaster';

vi.mock('next/navigation', () => nextNavigationMock);
vi.mock('@web/i18n/navigation', () => i18nNavigationMock);

beforeEach(() => {
  nav.pathname = '/en/o/acme/customers';
});

describe('hrefInOrg', () => {
  it('keeps the page and the locale, swapping the organisation', () => {
    expect(hrefInOrg('/en/o/acme/customers', 'en', 'globex')).toBe('/en/o/globex/customers');
    expect(hrefInOrg('/de/o/acme', 'de', 'globex')).toBe('/de/o/globex');
  });
});

describe('OrgSwitcher', () => {
  it('shows the current org and role, and links to the same page in the others', async () => {
    const { container } = renderWithProviders(<OrgSwitcher />, {
      preloadedState: { session: sessionState() },
    });
    const summary = screen.getByText('Acme (Owner)');
    await userEvent.click(summary);
    const link = screen.getByRole('link', { name: /Globex/ });
    // A plain link, so switching org is a full page load (no cache carried across orgs).
    expect(link).toHaveAttribute('href', '/en/o/globex/customers');
    expect(link).toHaveAccessibleName('Globex (Viewer)');
    await expectNoAxeViolations(container);
  });

  it('is plain text when there is no other organisation', async () => {
    const { container } = renderWithProviders(<OrgSwitcher />, {
      preloadedState: {
        session: sessionState({ memberships: [{ slug: 'acme', name: 'Acme', role: 'OWNER' }] }),
      },
    });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Acme (Owner)')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

function AddToast({ message }: { message: string }) {
  const dispatch = useAppDispatch();
  return (
    <button type="button" onClick={() => dispatch(toastAdded({ tone: 'success', message }))}>
      add
    </button>
  );
}

describe('Toaster', () => {
  it('announces toasts politely, dismisses on request and after a timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const { container } = renderWithProviders(
      <>
        <AddToast message="Saved" />
        <Toaster />
      </>,
    );
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(within(region).getByRole('list')).toHaveAttribute('aria-live', 'polite');

    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(within(region).getByText('Saved')).toBeInTheDocument();
    await user.click(within(region).getByRole('button', { name: 'Dismiss' }));
    expect(within(region).queryByText('Saved')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'add' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS);
    });
    expect(within(region).queryByText('Saved')).toBeNull();
    await expectNoAxeViolations(container);
    vi.useRealTimers();
  });
});

describe('AppShell', () => {
  it('has landmarks, a skip link, and marks the current page', async () => {
    const { container } = renderWithProviders(<AppShell>content</AppShell>, {
      preloadedState: { session: sessionState() },
    });
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#content',
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(navigation).getByRole('link', { name: 'Customers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
    await expectNoAxeViolations(container);
  });

  it('toggles the navigation with an expanded state', async () => {
    renderWithProviders(<AppShell>x</AppShell>, { preloadedState: { session: sessionState() } });
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('switches theme through Redux (the listener persists it)', async () => {
    renderWithProviders(<AppShell>x</AppShell>, { preloadedState: { session: sessionState() } });
    const select = screen.getByRole('combobox', { name: 'Theme' });
    await userEvent.selectOptions(select, 'Dark');
    expect(select).toHaveValue('dark');
  });

  it('renders nothing without an active organisation', () => {
    const { container } = renderWithProviders(<AppShell>x</AppShell>);
    expect(container).toBeEmptyDOMElement();
  });
});
