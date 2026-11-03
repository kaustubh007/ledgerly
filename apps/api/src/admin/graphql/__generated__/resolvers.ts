import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { StaffRecord } from '../../staff/staff.model.ts';
import type { OrganizationRecord } from '../../../features/organizations/organization.model.ts';
import type { UsageParent, CurrencyTotalParent, HealthParent, MemberParent } from '../../organizations/org-admin.types.ts';
import type { Money as DomainMoney } from '@ledgerly/domain';
import type { AuditEntryRecord } from '../../audit/audit.model.ts';
import type { AdminContext } from '../../context.ts';
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
  /** An instant, ISO 8601 with offset. */
  DateTime: { input: Date; output: Date; }
};

export type AuditEntry = {
  readonly __typename?: 'AuditEntry';
  /** e.g. `organization.suspend`, `organization.view`, `staff.signIn`. */
  readonly action: Scalars['String']['output'];
  readonly at: Scalars['DateTime']['output'];
  readonly id: Scalars['ID']['output'];
  readonly organizationId: Maybe<Scalars['ID']['output']>;
  readonly organizationName: Maybe<Scalars['String']['output']>;
  readonly reason: Maybe<Scalars['String']['output']>;
  /** Null for a failed sign-in by an unknown email. */
  readonly staff: Maybe<Staff>;
  readonly targetUserId: Maybe<Scalars['ID']['output']>;
};

export type AuditEntryConnection = {
  readonly __typename?: 'AuditEntryConnection';
  readonly edges: ReadonlyArray<AuditEntryEdge>;
  readonly pageInfo: PageInfo;
};

export type AuditEntryEdge = {
  readonly __typename?: 'AuditEntryEdge';
  readonly cursor: Scalars['String']['output'];
  readonly node: AuditEntry;
};

export type AuditLogFilter = {
  /** Exact action, e.g. `organization.suspend`. */
  readonly action?: InputMaybe<Scalars['String']['input']>;
  readonly organizationId?: InputMaybe<Scalars['ID']['input']>;
  readonly staffId?: InputMaybe<Scalars['ID']['input']>;
};

export type ChangeOrganizationPlanInput = {
  readonly organizationId: Scalars['ID']['input'];
  readonly plan: PlanCode;
  readonly reason: Scalars['String']['input'];
};

export type CurrencyTotal = {
  readonly __typename?: 'CurrencyTotal';
  readonly amount: Money;
  readonly currency: Scalars['String']['output'];
  readonly invoices: Scalars['Int']['output'];
};

export type Health = {
  readonly __typename?: 'Health';
  /** The most recent use of any member's session. */
  readonly lastActiveAt: Maybe<Scalars['DateTime']['output']>;
  readonly overdueInvoices: Scalars['Int']['output'];
};

export type Member = {
  readonly __typename?: 'Member';
  readonly activeSessions: Scalars['Int']['output'];
  readonly email: Scalars['String']['output'];
  readonly name: Scalars['String']['output'];
  readonly role: Scalars['String']['output'];
  readonly userId: Scalars['ID']['output'];
};

export type MfaEnrolment = {
  readonly __typename?: 'MfaEnrolment';
  /** The same secret as an otpauth:// URI, for a QR code. */
  readonly otpauthUri: Scalars['String']['output'];
  /** Base32 secret, for typing into an authenticator app. */
  readonly secret: Scalars['String']['output'];
};

export type MfaStep =
  /** First sign-in: add the secret to an authenticator app, then enter a code. */
  | 'ENROL'
  /** Enter a code from the authenticator app (or a recovery code). */
  | 'VERIFY';

/** An exact amount: a decimal string and an ISO 4217 code. */
export type Money = {
  readonly __typename?: 'Money';
  readonly amount: Scalars['String']['output'];
  readonly currency: Scalars['String']['output'];
};

export type Mutation = {
  readonly __typename?: 'Mutation';
  /** OPS only. No charge or refund: a support change, recorded in the audit log. */
  readonly changeOrganizationPlan: OrganizationPayload;
  /** OPS only. Signs the user out everywhere, in every organisation. */
  readonly revokeUserSessions: RevokeUserSessionsPayload;
  /** Step 1: email and password. Sets the MFA challenge cookie. */
  readonly signIn: SignInPayload;
  readonly signOut: Scalars['Boolean']['output'];
  /** OPS only. */
  readonly suspendOrganization: OrganizationPayload;
  /** OPS only. */
  readonly unsuspendOrganization: OrganizationPayload;
  /** Step 2: the TOTP or recovery code. Sets the session cookie (8 h absolute, 30 min idle). */
  readonly verifyMfa: VerifyMfaPayload;
};


export type MutationChangeOrganizationPlanArgs = {
  input: ChangeOrganizationPlanInput;
};


export type MutationRevokeUserSessionsArgs = {
  input: RevokeUserSessionsInput;
};


export type MutationSignInArgs = {
  input: StaffSignInInput;
};


export type MutationSuspendOrganizationArgs = {
  input: OrganizationActionInput;
};


export type MutationUnsuspendOrganizationArgs = {
  input: OrganizationActionInput;
};


export type MutationVerifyMfaArgs = {
  input: VerifyMfaInput;
};

export type Organization = {
  readonly __typename?: 'Organization';
  readonly createdAt: Scalars['DateTime']['output'];
  readonly health: Health;
  readonly id: Scalars['ID']['output'];
  readonly memberCount: Scalars['Int']['output'];
  readonly members: ReadonlyArray<Member>;
  readonly name: Scalars['String']['output'];
  /** Outstanding (sent, not yet paid) per currency. Never summed across currencies. */
  readonly outstanding: ReadonlyArray<CurrencyTotal>;
  readonly plan: PlanCode;
  readonly slug: Scalars['String']['output'];
  readonly status: OrganizationStatus;
  readonly suspendedAt: Maybe<Scalars['DateTime']['output']>;
  /** Current consumption against the plan's limits. */
  readonly usage: Usage;
};

export type OrganizationActionInput = {
  readonly organizationId: Scalars['ID']['input'];
  /** Why: at least 10 characters. Written to the audit log. */
  readonly reason: Scalars['String']['input'];
};

export type OrganizationConnection = {
  readonly __typename?: 'OrganizationConnection';
  readonly edges: ReadonlyArray<OrganizationEdge>;
  readonly pageInfo: PageInfo;
};

export type OrganizationEdge = {
  readonly __typename?: 'OrganizationEdge';
  readonly cursor: Scalars['String']['output'];
  readonly node: Organization;
};

export type OrganizationPayload = {
  readonly __typename?: 'OrganizationPayload';
  readonly organization: Maybe<Organization>;
  readonly userErrors: ReadonlyArray<UserError>;
};

export type OrganizationStatus =
  | 'ACTIVE'
  /** Read-only for its members: every tenant mutation returns ORG_SUSPENDED. */
  | 'SUSPENDED';

export type PageInfo = {
  readonly __typename?: 'PageInfo';
  readonly endCursor: Maybe<Scalars['String']['output']>;
  readonly hasNextPage: Scalars['Boolean']['output'];
};

export type PlanCode =
  | 'BUSINESS'
  | 'FREE'
  | 'PRO';

export type Query = {
  readonly __typename?: 'Query';
  /** Newest first. */
  readonly auditLog: AuditEntryConnection;
  /** The signed-in staff member, or null. */
  readonly me: Maybe<Staff>;
  readonly organization: Maybe<Organization>;
  /** Newest first. `search` matches the start of the name or slug, case-insensitively. */
  readonly organizations: OrganizationConnection;
};


export type QueryAuditLogArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<AuditLogFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOrganizationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOrganizationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<OrganizationStatus>;
};

export type RevokeUserSessionsInput = {
  readonly organizationId: Scalars['ID']['input'];
  readonly reason: Scalars['String']['input'];
  /** Must be a member of the organisation. */
  readonly userId: Scalars['ID']['input'];
};

export type RevokeUserSessionsPayload = {
  readonly __typename?: 'RevokeUserSessionsPayload';
  readonly revoked: Scalars['Int']['output'];
  readonly userErrors: ReadonlyArray<UserError>;
};

export type SignInPayload = {
  readonly __typename?: 'SignInPayload';
  readonly enrolment: Maybe<MfaEnrolment>;
  /** Set when the password was right. The challenge itself is an HttpOnly cookie. */
  readonly next: Maybe<MfaStep>;
  readonly userErrors: ReadonlyArray<UserError>;
};

export type Staff = {
  readonly __typename?: 'Staff';
  readonly email: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly role: StaffRole;
};

export type StaffRole =
  /** Everything SUPPORT can do, plus suspend, change plan and revoke sessions. */
  | 'OPS'
  /** Reads: search organisations, view them, read the audit log. */
  | 'SUPPORT';

export type StaffSignInInput = {
  readonly email: Scalars['String']['input'];
  readonly password: Scalars['String']['input'];
};

export type Usage = {
  readonly __typename?: 'Usage';
  readonly customers: Scalars['Int']['output'];
  /** The plan's limits; null means unlimited. */
  readonly customersLimit: Maybe<Scalars['Int']['output']>;
  readonly invoicesPerMonthLimit: Maybe<Scalars['Int']['output']>;
  readonly invoicesThisMonth: Scalars['Int']['output'];
  /** Members plus open invitations. */
  readonly seats: Scalars['Int']['output'];
  readonly seatsLimit: Maybe<Scalars['Int']['output']>;
};

/**
 * A validation or business refusal, returned as data. GraphQL errors are reserved for
 * authentication (UNAUTHENTICATED), authorisation (FORBIDDEN), malformed requests and faults.
 */
export type UserError = {
  readonly __typename?: 'UserError';
  readonly code: Scalars['String']['output'];
  readonly field: Maybe<ReadonlyArray<Scalars['String']['output']>>;
  readonly message: Scalars['String']['output'];
};

export type VerifyMfaInput = {
  /** A 6-digit authenticator code, or a recovery code such as `k3m9-x2pq`. */
  readonly code: Scalars['String']['input'];
};

export type VerifyMfaPayload = {
  readonly __typename?: 'VerifyMfaPayload';
  /** Shown once, after enrolment. Each code signs in once in place of an authenticator code. */
  readonly recoveryCodes: Maybe<ReadonlyArray<Scalars['String']['output']>>;
  readonly staff: Maybe<Staff>;
  readonly userErrors: ReadonlyArray<UserError>;
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
  AuditEntry: ResolverTypeWrapper<AuditEntryRecord>;
  AuditEntryConnection: ResolverTypeWrapper<Omit<AuditEntryConnection, 'edges'> & { edges: ReadonlyArray<ResolversTypes['AuditEntryEdge']> }>;
  AuditEntryEdge: ResolverTypeWrapper<Omit<AuditEntryEdge, 'node'> & { node: ResolversTypes['AuditEntry'] }>;
  AuditLogFilter: AuditLogFilter;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  ChangeOrganizationPlanInput: ChangeOrganizationPlanInput;
  CurrencyTotal: ResolverTypeWrapper<CurrencyTotalParent>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Health: ResolverTypeWrapper<HealthParent>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Member: ResolverTypeWrapper<MemberParent>;
  MfaEnrolment: ResolverTypeWrapper<MfaEnrolment>;
  MfaStep: MfaStep;
  Money: ResolverTypeWrapper<DomainMoney>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Organization: ResolverTypeWrapper<OrganizationRecord>;
  OrganizationActionInput: OrganizationActionInput;
  OrganizationConnection: ResolverTypeWrapper<Omit<OrganizationConnection, 'edges'> & { edges: ReadonlyArray<ResolversTypes['OrganizationEdge']> }>;
  OrganizationEdge: ResolverTypeWrapper<Omit<OrganizationEdge, 'node'> & { node: ResolversTypes['Organization'] }>;
  OrganizationPayload: ResolverTypeWrapper<Omit<OrganizationPayload, 'organization'> & { organization?: Maybe<ResolversTypes['Organization']> }>;
  OrganizationStatus: OrganizationStatus;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  PlanCode: PlanCode;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RevokeUserSessionsInput: RevokeUserSessionsInput;
  RevokeUserSessionsPayload: ResolverTypeWrapper<RevokeUserSessionsPayload>;
  SignInPayload: ResolverTypeWrapper<SignInPayload>;
  Staff: ResolverTypeWrapper<StaffRecord>;
  StaffRole: StaffRole;
  StaffSignInInput: StaffSignInInput;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Usage: ResolverTypeWrapper<UsageParent>;
  UserError: ResolverTypeWrapper<UserError>;
  VerifyMfaInput: VerifyMfaInput;
  VerifyMfaPayload: ResolverTypeWrapper<Omit<VerifyMfaPayload, 'staff'> & { staff?: Maybe<ResolversTypes['Staff']> }>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AuditEntry: AuditEntryRecord;
  AuditEntryConnection: Omit<AuditEntryConnection, 'edges'> & { edges: ReadonlyArray<ResolversParentTypes['AuditEntryEdge']> };
  AuditEntryEdge: Omit<AuditEntryEdge, 'node'> & { node: ResolversParentTypes['AuditEntry'] };
  AuditLogFilter: AuditLogFilter;
  Boolean: Scalars['Boolean']['output'];
  ChangeOrganizationPlanInput: ChangeOrganizationPlanInput;
  CurrencyTotal: CurrencyTotalParent;
  DateTime: Scalars['DateTime']['output'];
  Health: HealthParent;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Member: MemberParent;
  MfaEnrolment: MfaEnrolment;
  Money: DomainMoney;
  Mutation: Record<PropertyKey, never>;
  Organization: OrganizationRecord;
  OrganizationActionInput: OrganizationActionInput;
  OrganizationConnection: Omit<OrganizationConnection, 'edges'> & { edges: ReadonlyArray<ResolversParentTypes['OrganizationEdge']> };
  OrganizationEdge: Omit<OrganizationEdge, 'node'> & { node: ResolversParentTypes['Organization'] };
  OrganizationPayload: Omit<OrganizationPayload, 'organization'> & { organization?: Maybe<ResolversParentTypes['Organization']> };
  PageInfo: PageInfo;
  Query: Record<PropertyKey, never>;
  RevokeUserSessionsInput: RevokeUserSessionsInput;
  RevokeUserSessionsPayload: RevokeUserSessionsPayload;
  SignInPayload: SignInPayload;
  Staff: StaffRecord;
  StaffSignInInput: StaffSignInInput;
  String: Scalars['String']['output'];
  Usage: UsageParent;
  UserError: UserError;
  VerifyMfaInput: VerifyMfaInput;
  VerifyMfaPayload: Omit<VerifyMfaPayload, 'staff'> & { staff?: Maybe<ResolversParentTypes['Staff']> };
};

export type AuditEntryResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['AuditEntry'] = ResolversParentTypes['AuditEntry']> = {
  action?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  at?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  organizationId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  organizationName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reason?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  staff?: Resolver<Maybe<ResolversTypes['Staff']>, ParentType, ContextType>;
  targetUserId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
};

export type AuditEntryConnectionResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['AuditEntryConnection'] = ResolversParentTypes['AuditEntryConnection']> = {
  edges?: Resolver<ReadonlyArray<ResolversTypes['AuditEntryEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type AuditEntryEdgeResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['AuditEntryEdge'] = ResolversParentTypes['AuditEntryEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['AuditEntry'], ParentType, ContextType>;
};

export type CurrencyTotalResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['CurrencyTotal'] = ResolversParentTypes['CurrencyTotal']> = {
  amount?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  invoices?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type HealthResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Health'] = ResolversParentTypes['Health']> = {
  lastActiveAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  overdueInvoices?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MemberResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Member'] = ResolversParentTypes['Member']> = {
  activeSessions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type MfaEnrolmentResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['MfaEnrolment'] = ResolversParentTypes['MfaEnrolment']> = {
  otpauthUri?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  secret?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type MoneyResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Money'] = ResolversParentTypes['Money']> = {
  amount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  changeOrganizationPlan?: Resolver<ResolversTypes['OrganizationPayload'], ParentType, ContextType, RequireFields<MutationChangeOrganizationPlanArgs, 'input'>>;
  revokeUserSessions?: Resolver<ResolversTypes['RevokeUserSessionsPayload'], ParentType, ContextType, RequireFields<MutationRevokeUserSessionsArgs, 'input'>>;
  signIn?: Resolver<ResolversTypes['SignInPayload'], ParentType, ContextType, RequireFields<MutationSignInArgs, 'input'>>;
  signOut?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  suspendOrganization?: Resolver<ResolversTypes['OrganizationPayload'], ParentType, ContextType, RequireFields<MutationSuspendOrganizationArgs, 'input'>>;
  unsuspendOrganization?: Resolver<ResolversTypes['OrganizationPayload'], ParentType, ContextType, RequireFields<MutationUnsuspendOrganizationArgs, 'input'>>;
  verifyMfa?: Resolver<ResolversTypes['VerifyMfaPayload'], ParentType, ContextType, RequireFields<MutationVerifyMfaArgs, 'input'>>;
};

export type OrganizationResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Organization'] = ResolversParentTypes['Organization']> = {
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  health?: Resolver<ResolversTypes['Health'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  memberCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  members?: Resolver<ReadonlyArray<ResolversTypes['Member']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  outstanding?: Resolver<ReadonlyArray<ResolversTypes['CurrencyTotal']>, ParentType, ContextType>;
  plan?: Resolver<ResolversTypes['PlanCode'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['OrganizationStatus'], ParentType, ContextType>;
  suspendedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  usage?: Resolver<ResolversTypes['Usage'], ParentType, ContextType>;
};

export type OrganizationConnectionResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['OrganizationConnection'] = ResolversParentTypes['OrganizationConnection']> = {
  edges?: Resolver<ReadonlyArray<ResolversTypes['OrganizationEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type OrganizationEdgeResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['OrganizationEdge'] = ResolversParentTypes['OrganizationEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Organization'], ParentType, ContextType>;
};

export type OrganizationPayloadResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['OrganizationPayload'] = ResolversParentTypes['OrganizationPayload']> = {
  organization?: Resolver<Maybe<ResolversTypes['Organization']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  auditLog?: Resolver<ResolversTypes['AuditEntryConnection'], ParentType, ContextType, Partial<QueryAuditLogArgs>>;
  me?: Resolver<Maybe<ResolversTypes['Staff']>, ParentType, ContextType>;
  organization?: Resolver<Maybe<ResolversTypes['Organization']>, ParentType, ContextType, RequireFields<QueryOrganizationArgs, 'id'>>;
  organizations?: Resolver<ResolversTypes['OrganizationConnection'], ParentType, ContextType, Partial<QueryOrganizationsArgs>>;
};

export type RevokeUserSessionsPayloadResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['RevokeUserSessionsPayload'] = ResolversParentTypes['RevokeUserSessionsPayload']> = {
  revoked?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type SignInPayloadResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['SignInPayload'] = ResolversParentTypes['SignInPayload']> = {
  enrolment?: Resolver<Maybe<ResolversTypes['MfaEnrolment']>, ParentType, ContextType>;
  next?: Resolver<Maybe<ResolversTypes['MfaStep']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type StaffResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Staff'] = ResolversParentTypes['Staff']> = {
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['StaffRole'], ParentType, ContextType>;
};

export type UsageResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['Usage'] = ResolversParentTypes['Usage']> = {
  customers?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  customersLimit?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  invoicesPerMonthLimit?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  invoicesThisMonth?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  seats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  seatsLimit?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type UserErrorResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['UserError'] = ResolversParentTypes['UserError']> = {
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  field?: Resolver<Maybe<ReadonlyArray<ResolversTypes['String']>>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type VerifyMfaPayloadResolvers<ContextType = AdminContext, ParentType extends ResolversParentTypes['VerifyMfaPayload'] = ResolversParentTypes['VerifyMfaPayload']> = {
  recoveryCodes?: Resolver<Maybe<ReadonlyArray<ResolversTypes['String']>>, ParentType, ContextType>;
  staff?: Resolver<Maybe<ResolversTypes['Staff']>, ParentType, ContextType>;
  userErrors?: Resolver<ReadonlyArray<ResolversTypes['UserError']>, ParentType, ContextType>;
};

export type Resolvers<ContextType = AdminContext> = {
  AuditEntry?: AuditEntryResolvers<ContextType>;
  AuditEntryConnection?: AuditEntryConnectionResolvers<ContextType>;
  AuditEntryEdge?: AuditEntryEdgeResolvers<ContextType>;
  CurrencyTotal?: CurrencyTotalResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Health?: HealthResolvers<ContextType>;
  Member?: MemberResolvers<ContextType>;
  MfaEnrolment?: MfaEnrolmentResolvers<ContextType>;
  Money?: MoneyResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Organization?: OrganizationResolvers<ContextType>;
  OrganizationConnection?: OrganizationConnectionResolvers<ContextType>;
  OrganizationEdge?: OrganizationEdgeResolvers<ContextType>;
  OrganizationPayload?: OrganizationPayloadResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RevokeUserSessionsPayload?: RevokeUserSessionsPayloadResolvers<ContextType>;
  SignInPayload?: SignInPayloadResolvers<ContextType>;
  Staff?: StaffResolvers<ContextType>;
  Usage?: UsageResolvers<ContextType>;
  UserError?: UserErrorResolvers<ContextType>;
  VerifyMfaPayload?: VerifyMfaPayloadResolvers<ContextType>;
};

