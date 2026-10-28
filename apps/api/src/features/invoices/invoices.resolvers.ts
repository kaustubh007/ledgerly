import { requireTenant, type GraphQLContext } from '../../graphql/context.ts';
import { objectId } from '../../graphql/ids.ts';
import { money } from '../../graphql/money.ts';
import {
  afterCursor,
  decodeCursor,
  NEWEST_FIRST,
  pageSize,
  toConnection,
} from '../../graphql/pagination.ts';
import type { InvoiceStatus, Resolvers } from '../../graphql/__generated__/resolvers.ts';
import { todayIn } from '../../clock.ts';
import { idempotent, type Outcome } from '../idempotency/idempotency.ts';
import { Organization } from '../organizations/organization.model.ts';
import { countsByStatus, currencyTotals } from './dashboard.ts';
import { balanceOf, linesOf } from './invoice.mapper.ts';
import { Invoice } from './invoice.model.ts';
import {
  createInvoice,
  recordPayment,
  replaceLines,
  sendInvoice,
  voidInvoice,
} from './invoices.service.ts';

async function toPayload(outcome: Outcome) {
  if (!outcome.ok) return { invoice: null, userErrors: [...outcome.userErrors] };
  return { invoice: await Invoice.findById(outcome.id).lean().exec(), userErrors: [] };
}

async function orgTimeZone(orgId: string): Promise<string> {
  const org = await Organization.findById(orgId, { timeZone: 1 }).lean().exec();
  return org?.timeZone ?? 'UTC';
}

export const invoicesResolvers: Resolvers = {
  Query: {
    invoices: async (_, { first, after, status }) => {
      requireTenant('books:read');
      const size = pageSize(first);
      const cursor = after ? decodeCursor(after) : undefined;
      const rows = await Invoice.find({
        ...(status ? { status } : {}),
        ...(cursor ? afterCursor(cursor) : {}),
      })
        .sort(NEWEST_FIRST)
        .limit(size + 1)
        .lean()
        .exec();
      return toConnection(rows, size);
    },
    invoice: async (_, { id }) => {
      requireTenant('books:read');
      const _id = objectId(id);
      return _id ? Invoice.findById(_id).lean().exec() : null;
    },
    dashboard: async (_, __, ctx) => {
      const { orgId } = requireTenant('books:read');
      const [totals, counts] = await Promise.all([
        currencyTotals(await orgTimeZone(orgId), ctx.deps.clock),
        countsByStatus(),
      ]);
      return {
        totals,
        countsByStatus: counts.map((c) => ({ status: c.status as InvoiceStatus, count: c.count })),
      };
    },
  },
  Mutation: {
    createInvoice: async (_, { input, idempotencyKey }) => {
      const { userId } = requireTenant('invoices:write');
      return toPayload(
        await idempotent('createInvoice', idempotencyKey, userId, input, () =>
          createInvoice(input),
        ),
      );
    },
    replaceInvoiceLines: async (_, { id, lines }) => {
      requireTenant('invoices:write');
      return toPayload(await replaceLines(id, lines));
    },
    sendInvoice: async (_, { id, idempotencyKey }, ctx: GraphQLContext) => {
      const { userId } = requireTenant('invoices:write');
      return toPayload(
        await idempotent('sendInvoice', idempotencyKey, userId, { id }, () =>
          sendInvoice(id, ctx.deps.config.PUBLIC_ORIGIN, ctx.deps.clock),
        ),
      );
    },
    recordPayment: async (_, { input, idempotencyKey }) => {
      const { userId } = requireTenant('payments:record');
      return toPayload(
        await idempotent('recordPayment', idempotencyKey, userId, input, () =>
          recordPayment(input, userId),
        ),
      );
    },
    voidInvoice: async (_, { id }) => {
      requireTenant('invoices:write');
      return toPayload(await voidInvoice(id));
    },
  },
  Invoice: {
    id: (inv) => inv._id.toString(),
    number: (inv) => inv.number ?? null,
    status: (inv) => inv.status,
    currency: (inv) => inv.currency,
    dueDate: (inv) => inv.dueDate,
    customer: async (inv, _, ctx) => {
      const customer = await ctx.loaders.customer.load(inv.customerId.toString());
      if (!customer)
        throw new Error(`Invoice ${inv._id.toString()} references a missing customer.`);
      return customer;
    },
    lines: (inv) => linesOf(inv),
    total: (inv) => money(inv.totalMinor, inv.currency),
    paid: (inv) => money(inv.paidMinor, inv.currency),
    balance: (inv) => balanceOf(inv),
    overdue: async (inv, _, ctx) => {
      if (inv.status !== 'SENT' && inv.status !== 'PARTIALLY_PAID') return false;
      return inv.dueDate < todayIn(await orgTimeZone(inv.orgId.toString()), ctx.deps.clock);
    },
    payments: (inv, _, ctx) => ctx.loaders.paymentsByInvoice.load(inv._id.toString()),
    sentAt: (inv) => inv.sentAt ?? null,
    createdAt: (inv) => inv.createdAt,
  },
  Payment: {
    id: (p) => p._id.toString(),
    amount: (p) => money(p.amountMinor, p.currency),
    recordedAt: (p) => p.createdAt,
  },
  CurrencyTotals: {
    currency: (t) => t.currency,
    outstanding: (t) => t.outstanding,
    overdue: (t) => t.overdue,
  },
};
