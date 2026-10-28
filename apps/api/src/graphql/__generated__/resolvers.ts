import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { UserRecord } from '../../features/identity/user.model.ts';
import type { SessionRecord } from '../../features/identity/session.model.ts';
import type { MembershipRecord } from '../../features/organizations/membership.model.ts';
import type { OrganizationRecord } from '../../features/organizations/organization.model.ts';
import type { MemberParent } from '../../features/organizations/member.types.ts';
import type { InvitationRecord } from '../../features/organizations/invitation.model.ts';
import type { CustomerRecord } from '../../features/customers/customer.model.ts';
import type { InvoiceRecord } from '../../features/invoices/invoice.model.ts';
import type { LineItem, Money as DomainMoney } from '@ledgerly/domain';
import type { PaymentRecord } from '../../features/invoices/payment.model.ts';
import type { CurrencyTotalsParent } from '../../features/invoices/dashboard.types.ts';
import type { GraphQLContext } from '../context.ts';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A signed 64-bit integer, serialised as a decimal string because JSON numbers cannot carry it. */
  BigInt: { input: bigint; output: bigint; }
  /** A calendar date with no time zone, `YYYY-MM-DD`. */
  Date: { input: string; output: string; }
  /** An instant, ISO 8601 with offset. */
  DateTime: { input: Date; output: Date; }
};

export type AuthPayload = {
  readonly __typename?: 'AuthPayload';
  readonly userErrors: ReadonlyArray<UserError>;
  readonly viewer: Maybe<Viewer>;
};

export type CreateInvoiceInput = {
  readonly currency: Scalars['String']['input'];
  readonly customerId: Scalars['ID']['input'];
  readonly dueDate: Scalars['Date']['input'];
  readonly lines: ReadonlyArray<InvoiceLineInput>;
};

export type CurrencyTotals = {
  readonly __typename?: 'CurrencyTotals';
  readonly currency: Scalars['String']['output'];
  readonly outstanding: Money;
  readonly overdue: Money;
};

export type Customer = {
  readonly __typename?: 'Customer';
  readonly billingAddress: Maybe<Scalars['String']['output']>;
  readonly createdAt: Scalars['DateTime']['output'];
  readonly defaultCurrency: Scalars['String']['output'];
  /** BCP 47 locale for documents sent to this customer, e.g. `de-DE`. */
  readonly documentLocale: Scalars['String']['output'];
  readonly email: Maybe<Scalars['String']['output']>;
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
};

export type CustomerConnection = {
  readonly __typename?: 'CustomerConnection';
  readonly edges: ReadonlyArray<CustomerEdge>;
  readonly pageInfo: PageInfo;
};

export type CustomerEdge = {
  readonly __typename?: 'CustomerEdge';
  readonly cursor: Scalars['String']['output'];
  readonly node: Customer;
};

export type CustomerInput = {
  readonly billingAddress?: InputMaybe<Scalars['String']['input']>;
  readonly defaultCurrency: Scalars['String']['input'];
  readonly documentLocale: Scalars['String']['input'];
  readonly email?: InputMaybe<Scalars['String']['input']>;
  readonly name: Scalars['String']['input'];
};

export type CustomerPayload = {
  readonly __typename?: 'CustomerPayload';
  readonly customer: Maybe<Customer>;
  readonly userErrors: ReadonlyArray<UserError>;
};

export type Dashboard = {
  readonly __typename?: 'Dashboard';
  readonly countsByStatus: ReadonlyArray<StatusCount>;
  /** One entry per currency. Amounts in different currencies are never added together. */
  readonly totals: ReadonlyArray<CurrencyTotals>;
};

export type Invitation = {
  readonly __typename?: 'Invitation';
  readonly email: Scalars['String']['output'];
  readonly expiresAt: Scalars['DateTime']['output'];
  readonly id: Scalars['ID']['output'];
  readonly role: Role;
};

export type InvitationPayload = {
  readonly __typename?: 'InvitationPayload';
  readonly invitation: Maybe<Invitation>;
  readonly userErrors: ReadonlyArray<UserError>;
};

export type Invoice = {
  readonly __typename?: 'Invoice';
  readonly balance: Money;
  readonly createdAt: Scalars['DateTime']['output'];
  readonly currency: Scalars['String']['output'];
  readonly customer: Customer;
  readonly dueDate: Scalars['Date']['output'];
  readonly id: Scalars['ID']['output'];
  readonly lines: ReadonlyArray<InvoiceLine>;
  /** Allocated when the invoice is sent; null for drafts. */
  readonly number: Maybe<Scalars['String']['output']>;
  readonly overdue: Scalars['Boolean']['output'];
  readonly paid: Money;
  readonly payments: ReadonlyArray<Payment>;
  readonly sentAt: Maybe<Scalars['DateTime']['output']>;
  readonly status: InvoiceStatus;
  readonly total: Money;
};

export type InvoiceConnection = {
  readonly __typename?: 'InvoiceConnection';
  readonly edges: ReadonlyArray<InvoiceEdge>;
  readonly pageInfo: PageInfo;
};

export type InvoiceEdge = {
  readonly __typename?: 'InvoiceEdge';
  readonly cursor: Scalars['String']['output'];
  readonly node: Invoice;
};

export type InvoiceLine = {
  readonly __typename?: 'InvoiceLine';
  readonly description: Scalars['String']['output'];
  /** Decimal string with up to three places, e.g. `"1.5"`. */
  readonly quantity: Scalars['String']['output'];
  readonly total: Money;
  readonly unitPrice: Money;
};

export type InvoiceLineInput = {
  readonly description: Scalars['String']['input'];
  readonly quantity: Scalars['String']['input'];
  /** In the invoice currency. */
  readonly unitPrice: Scalars['String']['input'];
};

export type InvoicePayload = {
  readonly __typename?: 'InvoicePayload';
  readonly invoice: Maybe<Invoice>;
  readonly userErrors: ReadonlyArray<UserError>;
};

export type InvoiceStatus =
  | 'DRAFT'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'SENT'
  | 'VOID';

export type LogInInput = {
  readonly email: Scalars['String']['input'];
  readonly password: Scalars['String']['input'];
};

export type Member = {
  readonly __typename?: 'Member';
  readonly email: Scalars['String']['output'];
  readonly joinedAt: Scalars['DateTime']['output'];
  readonly name: Scalars['String']['output'];
  readonly role: Role;
  readonly userId: Scalars['ID']['output'];
};

export type MemberPayload = {
  readonly __typename?: 'MemberPayload';
  readonly member: Maybe<Member>;
  readonly userErrors: ReadonlyArray<UserError>;
};

export type Membership = {
  readonly __typename?: 'Membership';
  readonly organization: OrganizationSummary;
  readonly role: Role;
};

export type Money = {
  readonly __typename?: 'Money';
  /** Exact decimal string, e.g. `"12.30"`. Format it with `Intl.NumberFormat`. */
  readonly amount: Scalars['String']['output'];
  /** Integer minor units (cents, fils, yen). */
  readonly amountMinor: Scalars['BigInt']['output'];
  /** ISO 4217 code. */
  readonly currency: Scalars['String']['output'];
};

export type MoneyInput = {
  /** Plain decimal string with no more decimals than the currency allows, e.g. `"12.30"`. */
  readonly amount: Scalars['String']['input'];
  readonly currency: Scalars['String']['input'];
};

export type Mutation = {
  readonly __typename?: 'Mutation';
  /** Accepted by the signed-in user whose email matches the invitation. */
  readonly acceptInvitation: OrganizationPayload;
  readonly changeMemberRole: MemberPayload;
  readonly createCustomer: CustomerPayload;
  readonly createInvoice: InvoicePayload;
  /** Creates another organisation with the viewer as OWNER. */
  readonly createOrganization: OrganizationPayload;
  readonly inviteMember: InvitationPayload;
  readonly logIn: AuthPayload;
  readonly recordPayment: InvoicePayload;
  readonly removeMember: OkPayload;
  readonly replaceInvoiceLines: InvoicePayload;
  /** Always succeeds, whether or not the email exists. */
  readonly requestPasswordReset: OkPayload;
  /** Sets a new password and revokes every session of the user. */
  readonly resetPassword: OkPayload;
  readonly revokeOtherSessions: OkPayload;
  readonly revokeSession: OkPayload;
  /** Allocates the invoice number and emails the customer. */
  readonly sendInvoice: InvoicePayload;
  /** Creates a user, their first organisation (as OWNER) and a session. */
  readonly signUp: AuthPayload;
  readonly updateCustomer: CustomerPayload;
  readonly verifyEmail: OkPayload;
  readonly voidInvoice: InvoicePayload;
};


export type MutationAcceptInvitationArgs = {
  token: Scalars['String']['input'];
};


export type MutationChangeMemberRoleArgs = {
  role: Role;
  userId: Scalars['ID']['input'];
};


export type MutationCreateCustomerArgs = {
  input: CustomerInput;
};


export type MutationCreateInvoiceArgs = {
  idempotencyKey: Scalars['ID']['input'];
  input: CreateInvoiceInput;
};


export type MutationCreateOrganizationArgs = {
  name: Scalars['String']['input'];
};


export type MutationInviteMemberArgs = {
  email: Scalars['String']['input'];
  role: Role;
};


export type MutationLogInArgs = {
  input: LogInInput;
};


export type MutationRecordPaymentArgs = {
  idempotencyKey: Scalars['ID']['input'];
  input: RecordPaymentInput;
};


export type MutationRemoveMemberArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationReplaceInvoiceLinesArgs = {
  id: Scalars['ID']['input'];
  lines: ReadonlyArray<InvoiceLineInput>;
};


export type MutationRequestPasswordResetArgs = {
  email: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  input: ResetPasswordInput;
};


export type MutationRevokeSessionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSendInvoiceArgs = {
  id: Scalars['ID']['input'];
  idempotencyKey: Scalars['ID']['input'];
};


export type MutationSignUpArgs = {
  input: SignUpInput;
};


export type MutationUpdateCustomerArgs = {
  id: Scalars['ID']['input'];
  input: CustomerInput;
};


export type MutationVerifyEmailArgs = {
  token: Scalars['String']['input'];
};


export type MutationVoidInvoiceArgs = {
  id: Scalars['ID']['input'];
};

export type OkPayload = {
  readonly __typename?: 'OkPayload';
  readonly ok: Scalars['Boolean']['output'];
  readonly userErrors: ReadonlyArray<UserError>;
};

/** The organisation selected by the `x-org` request header. */
export type Organization = {
  readonly __typename?: 'Organization';
  readonly id: Scalars['ID']['output'];
  /** Requires `members:manage`. */
  readonly invitations: ReadonlyArray<Invitation>;
  /** Requires `members:manage`. */
  readonly members: ReadonlyArray<Member>;
  readonly name: Scalars['String']['output'];
  readonly slug: Scalars['String']['output'];
  /** IANA time zone; decides what 'overdue' means for this organisation. */
  readonly timeZone: Scalars['String']['output'];
  readonly viewerRole: Role;
};

export type OrganizationPayload = {
  readonly __typename?: 'OrganizationPayload';
  readonly organization: Maybe<OrganizationSummary>;
  readonly userErrors: ReadonlyArray<UserError>;
};

export type OrganizationSummary = {
  readonly __typename?: 'OrganizationSummary';
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly slug: Scalars['String']['output'];
};

export type PageInfo = {
  readonly __typename?: 'PageInfo';
  readonly endCursor: Maybe<Scalars['String']['output']>;
  readonly hasNextPage: Scalars['Boolean']['output'];
};

export type Payment = {
  readonly __typename?: 'Payment';
  readonly amount: Money;
  readonly id: Scalars['ID']['output'];
  readonly recordedAt: Scalars['DateTime']['output'];
};

export type Query = {
  readonly __typename?: 'Query';
  readonly customer: Maybe<Customer>;
  readonly customers: CustomerConnection;
  readonly dashboard: Dashboard;
  readonly invoice: Maybe<Invoice>;
  readonly invoices: InvoiceConnection;
  readonly organization: Maybe<Organization>;
  /** The signed-in user, or null. */
  readonly viewer: Maybe<Viewer>;
};


export type QueryCustomerArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCustomersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryInvoiceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryInvoicesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<InvoiceStatus>;
};

export type RecordPaymentInput = {
  readonly amount: MoneyInput;
  readonly invoiceId: Scalars['ID']['input'];
};

export type ResetPasswordInput = {
  readonly password: Scalars['String']['input'];
  readonly token: Scalars['String']['input'];
};

export type Role =
  | 'ACCOUNTANT'
  | 'ADMIN'
  | 'OWNER'
  | 'VIEWER';

export type Session = {
  readonly __typename?: 'Session';
  readonly createdAt: Scalars['DateTime']['output'];
  readonly current: Scalars['Boolean']['output'];
  readonly id: Scalars['ID']['output'];
  readonly lastUsedAt: Scalars['DateTime']['output'];
  readonly userAgent: Maybe<Scalars['String']['output']>;
};

export type SignUpInput = {
  readonly email: Scalars['String']['input'];
  readonly name: Scalars['String']['input'];
  readonly organizationName: Scalars['String']['input'];
  readonly password: Scalars['String']['input'];
};

export type StatusCount = {
  readonly __typename?: 'StatusCount';
  readonly count: Scalars['Int']['output'];
  readonly status: InvoiceStatus;
};

/**
 * A domain or validation refusal. Mutations return these as data; GraphQL errors are reserved for
 * authentication, authorisation, malformed requests and server faults.
 */
export type UserError = {
  readonly __typename?: 'UserError';
  /** Stable, machine-readable, e.g. `OVERPAYMENT`. */
  readonly code: Scalars['String']['output'];
  /** Path to the offending input field, e.g. `["input", "lines", "2", "unitPrice"]`. */
  readonly field: Maybe<ReadonlyArray<Scalars['String']['output']>>;
  readonly message: Scalars['String']['output'];
};

export type Viewer = {
  readonly __typename?: 'Viewer';
  readonly email: Scalars['String']['output'];
  readonly emailVerified: Scalars['Boolean']['output'];
  readonly id: Scalars['ID']['output'];
  readonly memberships: ReadonlyArray<Membership>;
  readonly name: Scalars['String']['output'];
  readonly sessions: ReadonlyArray<Session>;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AuthPayload: ResolverTypeWrapper<Omit<AuthPayload, 'viewer'> & { viewer?: Maybe<ResolversTypes['Viewer']> }>;
  BigInt: ResolverTypeWrapper<Scalars['BigInt']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CreateInvoiceInput: CreateInvoiceInput;
  CurrencyTotals: ResolverTypeWrapper<CurrencyTotalsParent>;
  Customer: ResolverTypeWrapper<CustomerRecord>;
  CustomerConnection: ResolverTypeWrapper<Omit<CustomerConnection, 'edges'> & { edges: ReadonlyArray<ResolversTypes['CustomerEdge']> }>;
  CustomerEdge: ResolverTypeWrapper<Omit<CustomerEdge, 'node'> & { node: ResolversTypes['Customer'] }>;
  CustomerInput: CustomerInput;
  CustomerPayload: ResolverTypeWrapper<Omit<CustomerPayload, 'customer'> & { customer?: Maybe<ResolversTypes['Customer']> }>;
  Dashboard: ResolverTypeWrapper<Omit<Dashboard, 'totals'> & { totals: ReadonlyArray<ResolversTypes['CurrencyTotals']> }>;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Invitation: ResolverTypeWrapper<InvitationRecord>;
  InvitationPayload: ResolverTypeWrapper<Omit<InvitationPayload, 'invitation'> & { invitation?: Maybe<ResolversTypes['Invitation']> }>;
  Invoice: ResolverTypeWrapper<InvoiceRecord>;
  InvoiceConnection: ResolverTypeWrapper<Omit<InvoiceConnection, 'edges'> & { edges: ReadonlyArray<ResolversTypes['InvoiceEdge']> }>;
  InvoiceEdge: ResolverTypeWrapper<Omit<InvoiceEdge, 'node'> & { node: ResolversTypes['Invoice'] }>;
  InvoiceLine: ResolverTypeWrapper<LineItem>;
  InvoiceLineInput: InvoiceLineInput;
  InvoicePayload: ResolverTypeWrapper<Omit<InvoicePayload, 'invoice'> & { invoice?: Maybe<ResolversTypes['Invoice']> }>;
  InvoiceStatus: InvoiceStatus;
  LogInInput: LogInInput;
  Member: ResolverTypeWrapper<MemberParent>;
  MemberPayload: ResolverTypeWrapper<Omit<MemberPayload, 'member'> & { member?: Maybe<ResolversTypes['Member']> }>;
  Membership: ResolverTypeWrapper<MembershipRecord>;
  Money: ResolverTypeWrapper<DomainMoney>;
  MoneyInput: MoneyInput;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  OkPayload: ResolverTypeWrapper<OkPayload>;
  Organization: ResolverTypeWrapper<OrganizationRecord>;
  OrganizationPayload: ResolverTypeWrapper<Omit<OrganizationPayload, 'organization'> & { organization?: Maybe<ResolversTypes['OrganizationSummary']> }>;
  OrganizationSummary: ResolverTypeWrapper<OrganizationRecord>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Payment: ResolverTypeWrapper<PaymentRecord>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RecordPaymentInput: RecordPaymentInput;
  ResetPasswordInput: ResetPasswordInput;
  Role: Role;
  Session: ResolverTypeWrapper<SessionRecord>;
  SignUpInput: SignUpInput;
  StatusCount: ResolverTypeWrapper<StatusCount>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  UserError: ResolverTypeWrapper<UserError>;
  Viewer: ResolverTypeWrapper<UserRecord>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AuthPayload: Omit<AuthPayload, 'viewer'> & { viewer?: Maybe<ResolversParentTypes['Viewer']> };
  BigInt: Scalars['BigInt']['output'];
  Boolean: Scalars['Boolean']['output'];
  CreateInvoiceInput: CreateInvoiceInput;
  CurrencyTotals: CurrencyTotalsParent;
  Customer: CustomerRecord;
  CustomerConnection: Omit<CustomerConnection, 'edges'> & { edges: ReadonlyArray<ResolversParentTypes['CustomerEdge']> };
  CustomerEdge: Omit<CustomerEdge, 'node'> & { node: ResolversParentTypes['Customer'] };
  CustomerInput: CustomerInput;
  CustomerPayload: Omit<CustomerPayload, 'customer'> & { customer?: Maybe<ResolversParentTypes['Customer']> };
  Dashboard: Omit<Dashboard, 'totals'> & { totals: ReadonlyArray<ResolversParentTypes['CurrencyTotals']> };
  Date: Scalars['Date']['output'];
  DateTime: Scalars['DateTime']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Invitation: InvitationRecord;
  InvitationPayload: Omit<InvitationPayload, 'invitation'> & { invitation?: Maybe<ResolversParentTypes['Invitation']> };
  Invoice: InvoiceRecord;
  InvoiceConnection: Omit<InvoiceConnection, 'edges'> & { edges: ReadonlyArray<ResolversParentTypes['InvoiceEdge']> };
  InvoiceEdge: Omit<InvoiceEdge, 'node'> & { node: ResolversParentTypes['Invoice'] };
  InvoiceLine: LineItem;
  InvoiceLineInput: InvoiceLineInput;
  InvoicePayload: Omit<InvoicePayload, 'invoice'> & { invoice?: Maybe<ResolversParentTypes['Invoice']> };
  LogInInput: LogInInput;
  Member: MemberParent;
  MemberPayload: Omit<MemberPayload, 'member'> & { member?: Maybe<ResolversParentTypes['Member']> };
  Membership: MembershipRecord;
  Money: DomainMoney;
  MoneyInput: MoneyInput;
  Mutation: Record<PropertyKey, never>;
  OkPayload: OkPayload;
  Organization: OrganizationRecord;
  OrganizationPayload: Omit<OrganizationPayload, 'organization'> & { organization?: Maybe<ResolversParentTypes['OrganizationSummary']> };
  OrganizationSummary: OrganizationRecord;
  PageInfo: PageInfo;
  Payment: PaymentRecord;
  Query: Record<PropertyKey, never>;
  RecordPaymentInput: RecordPaymentInput;
  ResetPasswordInput: ResetPasswordInput;
  Session: SessionRecord;
  SignUpInput: SignUpInput;
  StatusCount: StatusCount;
  String: Scalars['String']['output'];
  UserError: UserError;
  Viewer: UserRecord;
};

export type AuthPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AuthPayload'] = ResolversParentTypes['AuthPayload']> = {
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
  viewer?: Resolver<Maybe<ResolversTypes['Viewer']>, ParentType, ContextType>;
};

export interface BigIntScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['BigInt'], any> {
  name: 'BigInt';
}

export type CurrencyTotalsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CurrencyTotals'] = ResolversParentTypes['CurrencyTotals']> = {
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  outstanding?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  overdue?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
};

export type CustomerResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Customer'] = ResolversParentTypes['Customer']> = {
  billingAddress?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  defaultCurrency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  documentLocale?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type CustomerConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CustomerConnection'] = ResolversParentTypes['CustomerConnection']> = {
  edges?: Resolver<ReadonlyArray<ResolversTypes['CustomerEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type CustomerEdgeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CustomerEdge'] = ResolversParentTypes['CustomerEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Customer'], ParentType, ContextType>;
};

export type CustomerPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CustomerPayload'] = ResolversParentTypes['CustomerPayload']> = {
  customer?: Resolver<Maybe<ResolversTypes['Customer']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type DashboardResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Dashboard'] = ResolversParentTypes['Dashboard']> = {
  countsByStatus?: Resolver<ReadonlyArray<ResolversTypes['StatusCount']>, ParentType, ContextType>;
  totals?: Resolver<ReadonlyArray<ResolversTypes['CurrencyTotals']>, ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type InvitationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Invitation'] = ResolversParentTypes['Invitation']> = {
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  expiresAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
};

export type InvitationPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['InvitationPayload'] = ResolversParentTypes['InvitationPayload']> = {
  invitation?: Resolver<Maybe<ResolversTypes['Invitation']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type InvoiceResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Invoice'] = ResolversParentTypes['Invoice']> = {
  balance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  customer?: Resolver<ResolversTypes['Customer'], ParentType, ContextType>;
  dueDate?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lines?: Resolver<ReadonlyArray<ResolversTypes['InvoiceLine']>, ParentType, ContextType>;
  number?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  overdue?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  paid?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  payments?: Resolver<ReadonlyArray<ResolversTypes['Payment']>, ParentType, ContextType>;
  sentAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['InvoiceStatus'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
};

export type InvoiceConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['InvoiceConnection'] = ResolversParentTypes['InvoiceConnection']> = {
  edges?: Resolver<ReadonlyArray<ResolversTypes['InvoiceEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type InvoiceEdgeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['InvoiceEdge'] = ResolversParentTypes['InvoiceEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Invoice'], ParentType, ContextType>;
};

export type InvoiceLineResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['InvoiceLine'] = ResolversParentTypes['InvoiceLine']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  quantity?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  unitPrice?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
};

export type InvoicePayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['InvoicePayload'] = ResolversParentTypes['InvoicePayload']> = {
  invoice?: Resolver<Maybe<ResolversTypes['Invoice']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type MemberResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Member'] = ResolversParentTypes['Member']> = {
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  joinedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type MemberPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['MemberPayload'] = ResolversParentTypes['MemberPayload']> = {
  member?: Resolver<Maybe<ResolversTypes['Member']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type MembershipResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Membership'] = ResolversParentTypes['Membership']> = {
  organization?: Resolver<ResolversTypes['OrganizationSummary'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
};

export type MoneyResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Money'] = ResolversParentTypes['Money']> = {
  amount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  amountMinor?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  acceptInvitation?: Resolver<ResolversTypes['OrganizationPayload'], ParentType, ContextType, RequireFields<MutationAcceptInvitationArgs, 'token'>>;
  changeMemberRole?: Resolver<ResolversTypes['MemberPayload'], ParentType, ContextType, RequireFields<MutationChangeMemberRoleArgs, 'role' | 'userId'>>;
  createCustomer?: Resolver<ResolversTypes['CustomerPayload'], ParentType, ContextType, RequireFields<MutationCreateCustomerArgs, 'input'>>;
  createInvoice?: Resolver<ResolversTypes['InvoicePayload'], ParentType, ContextType, RequireFields<MutationCreateInvoiceArgs, 'idempotencyKey' | 'input'>>;
  createOrganization?: Resolver<ResolversTypes['OrganizationPayload'], ParentType, ContextType, RequireFields<MutationCreateOrganizationArgs, 'name'>>;
  inviteMember?: Resolver<ResolversTypes['InvitationPayload'], ParentType, ContextType, RequireFields<MutationInviteMemberArgs, 'email' | 'role'>>;
  logIn?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationLogInArgs, 'input'>>;
  recordPayment?: Resolver<ResolversTypes['InvoicePayload'], ParentType, ContextType, RequireFields<MutationRecordPaymentArgs, 'idempotencyKey' | 'input'>>;
  removeMember?: Resolver<ResolversTypes['OkPayload'], ParentType, ContextType, RequireFields<MutationRemoveMemberArgs, 'userId'>>;
  replaceInvoiceLines?: Resolver<ResolversTypes['InvoicePayload'], ParentType, ContextType, RequireFields<MutationReplaceInvoiceLinesArgs, 'id' | 'lines'>>;
  requestPasswordReset?: Resolver<ResolversTypes['OkPayload'], ParentType, ContextType, RequireFields<MutationRequestPasswordResetArgs, 'email'>>;
  resetPassword?: Resolver<ResolversTypes['OkPayload'], ParentType, ContextType, RequireFields<MutationResetPasswordArgs, 'input'>>;
  revokeOtherSessions?: Resolver<ResolversTypes['OkPayload'], ParentType, ContextType>;
  revokeSession?: Resolver<ResolversTypes['OkPayload'], ParentType, ContextType, RequireFields<MutationRevokeSessionArgs, 'id'>>;
  sendInvoice?: Resolver<ResolversTypes['InvoicePayload'], ParentType, ContextType, RequireFields<MutationSendInvoiceArgs, 'id' | 'idempotencyKey'>>;
  signUp?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationSignUpArgs, 'input'>>;
  updateCustomer?: Resolver<ResolversTypes['CustomerPayload'], ParentType, ContextType, RequireFields<MutationUpdateCustomerArgs, 'id' | 'input'>>;
  verifyEmail?: Resolver<ResolversTypes['OkPayload'], ParentType, ContextType, RequireFields<MutationVerifyEmailArgs, 'token'>>;
  voidInvoice?: Resolver<ResolversTypes['InvoicePayload'], ParentType, ContextType, RequireFields<MutationVoidInvoiceArgs, 'id'>>;
};

export type OkPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['OkPayload'] = ResolversParentTypes['OkPayload']> = {
  ok?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type OrganizationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Organization'] = ResolversParentTypes['Organization']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  invitations?: Resolver<ReadonlyArray<ResolversTypes['Invitation']>, ParentType, ContextType>;
  members?: Resolver<ReadonlyArray<ResolversTypes['Member']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timeZone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  viewerRole?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
};

export type OrganizationPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['OrganizationPayload'] = ResolversParentTypes['OrganizationPayload']> = {
  organization?: Resolver<Maybe<ResolversTypes['OrganizationSummary']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type OrganizationSummaryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['OrganizationSummary'] = ResolversParentTypes['OrganizationSummary']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type PaymentResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Payment'] = ResolversParentTypes['Payment']> = {
  amount?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  recordedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  customer?: Resolver<Maybe<ResolversTypes['Customer']>, ParentType, ContextType, RequireFields<QueryCustomerArgs, 'id'>>;
  customers?: Resolver<ResolversTypes['CustomerConnection'], ParentType, ContextType, RequireFields<QueryCustomersArgs, 'first'>>;
  dashboard?: Resolver<ResolversTypes['Dashboard'], ParentType, ContextType>;
  invoice?: Resolver<Maybe<ResolversTypes['Invoice']>, ParentType, ContextType, RequireFields<QueryInvoiceArgs, 'id'>>;
  invoices?: Resolver<ResolversTypes['InvoiceConnection'], ParentType, ContextType, RequireFields<QueryInvoicesArgs, 'first'>>;
  organization?: Resolver<Maybe<ResolversTypes['Organization']>, ParentType, ContextType>;
  viewer?: Resolver<Maybe<ResolversTypes['Viewer']>, ParentType, ContextType>;
};

export type SessionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = {
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  current?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastUsedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  userAgent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type StatusCountResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['StatusCount'] = ResolversParentTypes['StatusCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['InvoiceStatus'], ParentType, ContextType>;
};

export type UserErrorResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['UserError'] = ResolversParentTypes['UserError']> = {
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  field?: Resolver<Maybe<ReadonlyArray<ResolversTypes['String']>>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ViewerResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Viewer'] = ResolversParentTypes['Viewer']> = {
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  emailVerified?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  memberships?: Resolver<ReadonlyArray<ResolversTypes['Membership']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sessions?: Resolver<ReadonlyArray<ResolversTypes['Session']>, ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  AuthPayload?: AuthPayloadResolvers<ContextType>;
  BigInt?: GraphQLScalarType;
  CurrencyTotals?: CurrencyTotalsResolvers<ContextType>;
  Customer?: CustomerResolvers<ContextType>;
  CustomerConnection?: CustomerConnectionResolvers<ContextType>;
  CustomerEdge?: CustomerEdgeResolvers<ContextType>;
  CustomerPayload?: CustomerPayloadResolvers<ContextType>;
  Dashboard?: DashboardResolvers<ContextType>;
  Date?: GraphQLScalarType;
  DateTime?: GraphQLScalarType;
  Invitation?: InvitationResolvers<ContextType>;
  InvitationPayload?: InvitationPayloadResolvers<ContextType>;
  Invoice?: InvoiceResolvers<ContextType>;
  InvoiceConnection?: InvoiceConnectionResolvers<ContextType>;
  InvoiceEdge?: InvoiceEdgeResolvers<ContextType>;
  InvoiceLine?: InvoiceLineResolvers<ContextType>;
  InvoicePayload?: InvoicePayloadResolvers<ContextType>;
  Member?: MemberResolvers<ContextType>;
  MemberPayload?: MemberPayloadResolvers<ContextType>;
  Membership?: MembershipResolvers<ContextType>;
  Money?: MoneyResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  OkPayload?: OkPayloadResolvers<ContextType>;
  Organization?: OrganizationResolvers<ContextType>;
  OrganizationPayload?: OrganizationPayloadResolvers<ContextType>;
  OrganizationSummary?: OrganizationSummaryResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Payment?: PaymentResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  StatusCount?: StatusCountResolvers<ContextType>;
  UserError?: UserErrorResolvers<ContextType>;
  Viewer?: ViewerResolvers<ContextType>;
};

