import { PLANS, type Plan } from '@ledgerly/domain';
import { requireTenant } from '../../graphql/context.ts';
import type { Resolvers } from '../../graphql/__generated__/resolvers.ts';
import { Organization } from '../organizations/organization.model.ts';
import { changePlan } from './billing.service.ts';
import { usageOf } from './limits.ts';

export const billingResolvers: Resolvers = {
  Query: {
    plans: (): Plan[] => Object.values(PLANS),
  },
  Mutation: {
    changePlan: async (_, { input, idempotencyKey }, ctx) => {
      const caller = requireTenant('organization:manage');
      const outcome = await changePlan(ctx.deps, caller, input, idempotencyKey);
      if (!outcome.ok) return { organization: null, userErrors: [...outcome.userErrors] };
      return {
        organization: await Organization.findById(caller.orgId).lean().exec(),
        userErrors: [],
      };
    },
  },
  // Merged by graphql-tools into the Organization resolvers of the organizations feature: each
  // feature owns the fields it adds.
  Organization: {
    plan: (org) => PLANS[org.plan],
    usage: async (_, __, ctx) => {
      requireTenant('books:read');
      const usage = await usageOf(ctx.deps.clock);
      return {
        customers: usage.customers,
        invoicesThisMonth: usage.invoicesPerMonth,
        seats: usage.seats,
      };
    },
  },
  Plan: {
    code: (plan) => plan.code,
    monthlyPrice: (plan) => plan.monthlyPrice,
    limits: (plan) => plan.limits,
    features: (plan) => plan.features,
  },
};
