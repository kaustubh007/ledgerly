import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogInMutation } from '@web/graphql/documents';
import { expectNoAxeViolations, renderWithProviders } from '@web/test/render';
import { i18nNavigationMock, nav, nextNavigationMock, router } from '@web/test/navigation-mocks';
import de from '@web/messages/de.json';
import { SignInForm } from './SignInForm';

vi.mock('next/navigation', () => nextNavigationMock);
vi.mock('@web/i18n/navigation', () => i18nNavigationMock);

const input = { email: 'ada@example.com', password: 'correct horse' };

function logIn(result: {
  viewer: { id: string } | null;
  userErrors: { code: string; message: string; field: string[] }[];
}): MockLink.MockedResponse {
  return {
    request: { query: LogInMutation, variables: { input } },
    result: {
      data: {
        logIn: {
          __typename: 'AuthPayload',
          ...result,
          viewer: result.viewer && { __typename: 'Viewer', ...result.viewer },
          userErrors: result.userErrors.map((e) => ({ __typename: 'UserError', ...e })),
        },
      },
    },
  };
}

function renderForm(mocks: MockLink.MockedResponse[], locale = 'en') {
  return renderWithProviders(
    <MockedProvider mocks={mocks}>
      <SignInForm />
    </MockedProvider>,
    locale === 'de' ? { locale, messages: de } : {},
  );
}

beforeEach(() => {
  router.replace.mockReset();
  nav.search = new URLSearchParams();
});

describe('SignInForm', () => {
  it('validates with the shared zod schema before calling the API, and links the error to the field', async () => {
    const { container } = renderForm([]);
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter a valid email address.');
    expect(email).toHaveFocus();
    await expectNoAxeViolations(container);
  });

  it('shows the server’s refusal, translated by code', async () => {
    renderForm(
      [
        logIn({
          viewer: null,
          userErrors: [
            { code: 'INVALID_CREDENTIALS', message: 'English text from the server', field: [] },
          ],
        }),
      ],
      'de',
    );
    await userEvent.type(screen.getByLabelText('E-Mail'), input.email);
    await userEvent.type(screen.getByLabelText('Passwort'), input.password);
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-Mail oder Passwort ist falsch.');
    expect(screen.queryByText('English text from the server')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('goes to a safe `next` after signing in, and ignores an unsafe one', async () => {
    nav.search = new URLSearchParams({ next: '/en/o/acme/customers' });
    renderForm([logIn({ viewer: { id: 'u1' }, userErrors: [] })]);
    await userEvent.type(screen.getByLabelText('Email'), input.email);
    await userEvent.type(screen.getByLabelText('Password'), input.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/o/acme/customers'));
  });

  it('refuses an open redirect', async () => {
    nav.search = new URLSearchParams({ next: '//evil.example' });
    renderForm([logIn({ viewer: { id: 'u1' }, userErrors: [] })]);
    await userEvent.type(screen.getByLabelText('Email'), input.email);
    await userEvent.type(screen.getByLabelText('Password'), input.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/o'));
  });
});
