import type { CodegenConfig } from '@graphql-codegen/cli';

// Resolver types for the tenant and admin schemas. Mappers say what each GraphQL type's resolvers
// receive as their parent: the database record or domain object, never the GraphQL shape (§3.3).
const config: CodegenConfig = {
  generates: {
    'src/graphql/__generated__/resolvers.ts': {
      schema: '../../packages/graphql/schema/tenant/*.graphql',
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
    // The admin console's schema (ADR-0004): a separate Apollo Server, separate types.
    'src/admin/graphql/__generated__/resolvers.ts': {
      schema: '../../packages/graphql/schema/admin/*.graphql',
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        immutableTypes: true,
        avoidOptionals: { field: true, inputValue: false },
        contextType: '../../context.ts#AdminContext',
        useIndexSignature: false,
        scalars: { DateTime: 'Date', ID: 'string' },
        mappers: {
          Staff: '../../staff/staff.model.ts#StaffRecord',
          Organization: '../../../features/organizations/organization.model.ts#OrganizationRecord',
          Usage: '../../organizations/org-admin.types.ts#UsageParent',
          CurrencyTotal: '../../organizations/org-admin.types.ts#CurrencyTotalParent',
          Health: '../../organizations/org-admin.types.ts#HealthParent',
          Member: '../../organizations/org-admin.types.ts#MemberParent',
          Money: '@ledgerly/domain#Money as DomainMoney',
          AuditEntry: '../../audit/audit.model.ts#AuditEntryRecord',
        },
      },
    },
  },
};

export default config;
