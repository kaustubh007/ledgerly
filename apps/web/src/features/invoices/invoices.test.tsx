import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecordPaymentMutation } from '@web/graphql/documents';
import { useIdempotencyKey } from '@web/lib/hooks/useIdempotencyKey';
import { expectNoAxeViolations, renderWithProviders, sessionState } from '@web/test/render';
import { InvoiceActions } from './InvoiceActions';
import { RecordPaymentForm } from './PaymentForms';

const asRole = (role: 'OWNER' | 'ACCOUNTANT' | 'VIEWER') => ({
  preloadedState: { session: sessionState({ activeOrg: { slug: 'acme', name: 'Acme', role } }) },
});

describe('useIdempotencyKey', () => {
  it('keeps one key across renders and changes it only when renewed', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const first = result.current[0];
    rerender();
    expect(result.current[0]).toBe(first);
    act(() => result.current[1]());
    expect(result.current[0]).not.toBe(first);
  });
});

describe('InvoiceActions', () => {
  const render = (status: 'DRAFT' | 'SENT' | 'PAID', role: 'OWNER' | 'ACCOUNTANT' | 'VIEWER') =>
    renderWithProviders(
      <MockedProvider mocks={[]}>
        <InvoiceActions id="i1" status={status} />
      </MockedProvider>,
      asRole(role),
    );

  it('offers what the state machine allows: Send and Void for a draft', async () => {
    const { container } = render('DRAFT', 'ACCOUNTANT');
    expect(screen.getByRole('button', { name: 'Send invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Void' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('asks for confirmation before voiding', async () => {
    render('SENT', 'OWNER');
    expect(screen.queryByRole('button', { name: 'Send invoice' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Void' }));
    expect(screen.getByRole('button', { name: 'Yes, void this invoice' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Void' })).toBeInTheDocument();
  });

  it('offers nothing for a paid invoice, or to a VIEWER', () => {
    const paid = render('PAID', 'OWNER');
    expect(paid.container).toBeEmptyDOMElement();
    paid.unmount();
    const viewer = render('DRAFT', 'VIEWER');
    expect(viewer.container).toBeEmptyDOMElement();
  });
});

describe('RecordPaymentForm', () => {
  const props = { invoiceId: 'i1', currency: 'USD', balance: '50.00', addOptimistic: vi.fn() };

  function paymentMock(
    amount: string,
    userErrors: { code: string; message: string; field: string[] }[] = [],
  ): MockLink.MockedResponse {
    return {
      request: {
        query: RecordPaymentMutation,
        variables: (v) => v['input'].amount.amount === amount,
      },
      result: {
        data: {
          recordPayment: {
            __typename: 'InvoicePayload',
            invoice: null,
            userErrors: userErrors.map((e) => ({ __typename: 'UserError', ...e })),
          },
        },
      },
    };
  }

  it('validates locally before sending anything, and links the error to the field', async () => {
    const { container } = renderWithProviders(
      <MockedProvider mocks={[]}>
        <RecordPaymentForm {...props} />
      </MockedProvider>,
    );
    const amount = screen.getByLabelText('Amount (USD)');
    expect(amount).toHaveValue('50.00');
    await userEvent.clear(amount);
    await userEvent.type(amount, '12,50');
    await userEvent.click(screen.getByRole('button', { name: 'Record a payment' }));
    expect(await screen.findByText(/Enter an amount such as 12.30/)).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(props.addOptimistic).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it('shows the payment optimistically, then the server’s refusal, translated', async () => {
    renderWithProviders(
      <MockedProvider
        mocks={[
          paymentMock('60', [
            { code: 'OVERPAYMENT', message: 'server text', field: ['input', 'amount'] },
          ]),
        ]}
      >
        <RecordPaymentForm {...props} />
      </MockedProvider>,
    );
    const amount = screen.getByLabelText('Amount (USD)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Record a payment' }));
    expect(props.addOptimistic).toHaveBeenCalledWith('60', 'MANUAL');
    expect(await screen.findByText('The amount is more than the balance due.')).toBeInTheDocument();
    expect(screen.queryByText('server text')).toBeNull();
  });
});
