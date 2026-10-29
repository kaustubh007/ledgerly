import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateCustomerMutation } from '@web/graphql/documents';
import { i18nNavigationMock, nextNavigationMock } from '@web/test/navigation-mocks';
import { expectNoAxeViolations, renderWithProviders, sessionState } from '@web/test/render';
import { CustomerForm } from './CustomerForm';

vi.mock('next/navigation', () => nextNavigationMock);
vi.mock('@web/i18n/navigation', () => i18nNavigationMock);

const limitReached: MockLink.MockedResponse = {
  request: {
    query: CreateCustomerMutation,
    // An empty optional field is sent as null, not "" (which the API would reject as an email).
    variables: (v) =>
      v['input'].name === 'Six' && v['input'].email === null && v['input'].billingAddress === null,
  },
  result: {
    data: {
      createCustomer: {
        __typename: 'CustomerPayload',
        customer: null,
        userErrors: [
          { __typename: 'UserError', code: 'PLAN_LIMIT_REACHED', message: 'limit', field: [] },
        ],
      },
    },
  },
};

describe('CustomerForm', () => {
  it('explains a plan limit and links to billing', async () => {
    const { container } = renderWithProviders(
      <MockedProvider mocks={[limitReached]}>
        <CustomerForm />
      </MockedProvider>,
      { preloadedState: { session: sessionState() } },
    );
    await userEvent.type(screen.getByLabelText('Name'), 'Six');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your plan’s limit is reached.');
    expect(screen.getByRole('link', { name: 'See plans and upgrade' })).toHaveAttribute(
      'href',
      '/en/o/acme/settings/billing',
    );
    await expectNoAxeViolations(container);
  });
});
