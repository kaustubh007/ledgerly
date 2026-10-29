import type { CodegenConfig } from '@graphql-codegen/cli';

// Resolver types for the tenant schema. Mappers say what each GraphQL type's resolvers receive
// as their parent: the database record or domain object, never the GraphQL shape (PLAN §3.3).
const config: CodegenConfig = {
  schema: '../../packages/graphql/schema/tenant/*.graphql',
  generates: {
    'src/graphql/__generated__/resolvers.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        immutableTypes: true,
        avoidOptionals: { field: true, inputValue: false },
        contextType: '../context.ts#GraphQLContext',
        useIndexSignature: false,
        scalars: {
          BigInt: 'bigint',
          Date: 'string',
          DateTime: 'Date',
          ID: 'string',
        },
        mappers: {
          Viewer: '../../features/identity/user.model.ts#UserRecord',
          Session: '../../features/identity/session.model.ts#SessionRecord',
          Membership: '../../features/organizations/membership.model.ts#MembershipRecord',
          OrganizationSummary:
            '../../features/organizations/organization.model.ts#OrganizationRecord',
          Organization: '../../features/organizations/organization.model.ts#OrganizationRecord',
          Member: '../../features/organizations/member.types.ts#MemberParent',
          Invitation: '../../features/organizations/invitation.model.ts#InvitationRecord',
          Customer: '../../features/customers/customer.model.ts#CustomerRecord',
          Invoice: '../../features/invoices/invoice.model.ts#InvoiceRecord',
          InvoiceLine: '@ledgerly/domain#LineItem',
          Payment: '../../features/invoices/payment.model.ts#PaymentRecord',
          Money: '@ledgerly/domain#Money as DomainMoney',
          Plan: '@ledgerly/domain#Plan as DomainPlan',
          CurrencyTotals: '../../features/invoices/dashboard.types.ts#CurrencyTotalsParent',
        },
      },
    },
  },
};

export default config;
