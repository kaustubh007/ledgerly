// Shared by Server and Client Components: a plain module, never 'use client' (see
// features/customers/constants.ts).

export const STATUSES = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID'] as const;

export const INVOICE_PAGE_SIZE = 20;

/** The simulator's test cards (README, "Simulations"). A real gateway's card form goes here. */
export const TEST_CARDS = [
  'pm_card_visa',
  'pm_card_mastercard',
  'pm_card_declined',
  'pm_card_insufficient_funds',
] as const;
