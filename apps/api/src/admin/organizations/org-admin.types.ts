import type { Types } from 'mongoose';
import type { Money, PlanCode } from '@ledgerly/domain';

// Parents of the admin schema's organisation types (codegen mappers): what the field resolvers
// receive. Counts, totals and metadata only (ADR-0004: data minimisation).

export interface UsageParent {
  readonly plan: PlanCode;
  readonly customers: number;
  readonly invoicesThisMonth: number;
  readonly seats: number;
}

export interface CurrencyTotalParent {
  readonly currency: string;
  readonly amount: Money;
  readonly invoices: number;
}

export interface HealthParent {
  readonly lastActiveAt: Date | null;
  readonly overdueInvoices: number;
}

export interface MemberParent {
  readonly userId: Types.ObjectId;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly activeSessions: number;
}
