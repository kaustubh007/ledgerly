import { createApi, type TypedMutationOnQueryStarted } from '@reduxjs/toolkit/query/react';
import type {
  AuditLogQuery,
  AuditLogQueryVariables,
  ChangeOrganizationPlanInput,
  ChangeOrganizationPlanMutation,
  MeQuery,
  OrganizationActionInput,
  OrganizationQuery,
  OrganizationsQuery,
  OrganizationsQueryVariables,
  OrganizationStatus,
  RevokeUserSessionsInput,
  RevokeUserSessionsMutation,
  SignInMutation,
  StaffSignInInput,
  SuspendOrganizationMutation,
  VerifyMfaInput,
  VerifyMfaMutation,
} from '@admin/graphql/__generated__/graphql';
import {
  AuditLogQuery as AuditLogDocument,
  ChangeOrganizationPlanMutation as ChangePlanDocument,
  MeQuery as MeDocument,
  OrganizationQuery as OrganizationDocument,
  OrganizationsQuery as OrganizationsDocument,
  RevokeUserSessionsMutation as RevokeDocument,
  SignInMutation as SignInDocument,
  SignOutMutation as SignOutDocument,
  SuspendOrganizationMutation as SuspendDocument,
  UnsuspendOrganizationMutation as UnsuspendDocument,
  VerifyMfaMutation as VerifyMfaDocument,
} from '@admin/graphql/documents';
import { graphqlBaseQuery } from './baseQuery';

export type Staff = NonNullable<MeQuery['me']>;
export type OrganizationList = OrganizationsQuery['organizations'];
export type OrganizationDetail = NonNullable<OrganizationQuery['organization']>;
export type AuditLog = AuditLogQuery['auditLog'];
export type OrgPayload = SuspendOrganizationMutation['suspendOrganization'];

/**
 * The admin console's server state lives here, in Redux, through RTK Query (PLAN §3.8: the
 * opposite choice to the tenant app's Apollo cache, on purpose). Cache entries are keyed by
 * endpoint and arguments; tags say which mutations make which entries stale.
 */
export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: graphqlBaseQuery,
  tagTypes: ['Me', 'Organization', 'OrganizationList', 'AuditLog'],
  endpoints: (build) => ({
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- RTK Query's "no argument"
    me: build.query<Staff | null, void>({
      query: () => ({ document: MeDocument }),
      transformResponse: (data: MeQuery) => data.me ?? null,
      providesTags: ['Me'],
    }),
    signIn: build.mutation<SignInMutation['signIn'], StaffSignInInput>({
      query: (input) => ({ document: SignInDocument, variables: { input } }),
      transformResponse: (data: SignInMutation) => data.signIn,
    }),
    verifyMfa: build.mutation<VerifyMfaMutation['verifyMfa'], VerifyMfaInput>({
      query: (input) => ({ document: VerifyMfaDocument, variables: { input } }),
      transformResponse: (data: VerifyMfaMutation) => data.verifyMfa,
      // Signed in: `me` is now known without asking again.
      async onQueryStarted(_input, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (data.staff) await dispatch(adminApi.util.upsertQueryData('me', undefined, data.staff));
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- RTK Query's "no argument"
    signOut: build.mutation<boolean, void>({
      query: () => ({ document: SignOutDocument }),
      transformResponse: () => true,
    }),

    organizations: build.query<OrganizationList, OrganizationsQueryVariables>({
      query: (variables) => ({ document: OrganizationsDocument, variables }),
      transformResponse: (data: OrganizationsQuery) => data.organizations,
      providesTags: ['OrganizationList'],
    }),
    organization: build.query<OrganizationDetail | null, string>({
      query: (id) => ({ document: OrganizationDocument, variables: { id } }),
      transformResponse: (data: OrganizationQuery) => data.organization ?? null,
      providesTags: (_result, _error, id) => [{ type: 'Organization', id }],
    }),
    auditLog: build.query<AuditLog, AuditLogQueryVariables>({
      query: (variables) => ({ document: AuditLogDocument, variables }),
      transformResponse: (data: AuditLogQuery) => data.auditLog,
      providesTags: ['AuditLog'],
    }),

    suspendOrganization: build.mutation<OrgPayload, OrganizationActionInput>({
      query: (input) => ({ document: SuspendDocument, variables: { input } }),
      transformResponse: (data: SuspendOrganizationMutation) => data.suspendOrganization,
      onQueryStarted: optimisticStatus('SUSPENDED'),
      invalidatesTags: ['AuditLog'],
    }),
    unsuspendOrganization: build.mutation<OrgPayload, OrganizationActionInput>({
      query: (input) => ({ document: UnsuspendDocument, variables: { input } }),
      transformResponse: (data: { unsuspendOrganization: OrgPayload }) =>
        data.unsuspendOrganization,
      onQueryStarted: optimisticStatus('ACTIVE'),
      invalidatesTags: ['AuditLog'],
    }),
    changeOrganizationPlan: build.mutation<
      ChangeOrganizationPlanMutation['changeOrganizationPlan'],
      ChangeOrganizationPlanInput
    >({
      query: (input) => ({ document: ChangePlanDocument, variables: { input } }),
      transformResponse: (data: ChangeOrganizationPlanMutation) => data.changeOrganizationPlan,
      // Pessimistic: a plan change shows once the server confirms it.
      async onQueryStarted(input, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        const plan = data.organization?.plan;
        if (plan) {
          dispatch(
            adminApi.util.updateQueryData('organization', input.organizationId, (draft) => {
              if (draft) draft.plan = plan;
            }),
          );
        }
      },
      invalidatesTags: ['AuditLog', 'OrganizationList'],
    }),
    revokeUserSessions: build.mutation<
      RevokeUserSessionsMutation['revokeUserSessions'],
      RevokeUserSessionsInput
    >({
      query: (input) => ({ document: RevokeDocument, variables: { input } }),
      transformResponse: (data: RevokeUserSessionsMutation) => data.revokeUserSessions,
      async onQueryStarted(input, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (data.userErrors.length > 0) return;
        dispatch(
          adminApi.util.updateQueryData('organization', input.organizationId, (draft) => {
            const member = draft?.members.find((m) => m.userId === input.userId);
            if (member) member.activeSessions = 0;
          }),
        );
      },
      invalidatesTags: ['AuditLog'],
    }),
  }),
});

/**
 * Optimistic status change (PLAN E10-4): the org shows its new status at once, in its detail
 * and in every cached list page. If the server refuses (a GraphQL error or a userError), every
 * patch is undone; the error middleware turns a thrown error into a toast.
 */
function optimisticStatus(
  status: OrganizationStatus,
): NonNullable<
  TypedMutationOnQueryStarted<
    OrgPayload,
    OrganizationActionInput,
    typeof graphqlBaseQuery,
    'adminApi'
  >
> {
  return async (input, api) => {
    const { dispatch, queryFulfilled } = api;
    const id = input.organizationId;
    const patches = [
      dispatch(
        adminApi.util.updateQueryData('organization', id, (draft) => {
          if (draft) draft.status = status;
        }),
      ),
      ...adminApi.util
        .selectCachedArgsForQuery(api.getState() as AdminApiState, 'organizations')
        .map((args) =>
          dispatch(
            adminApi.util.updateQueryData('organizations', args, (draft) => {
              const row = draft.edges.find((edge) => edge.node.id === id);
              if (row) row.node.status = status;
            }),
          ),
        ),
    ];
    const undo = () => {
      for (const patch of patches) patch.undo();
    };
    try {
      const { data } = await queryFulfilled;
      if (data.userErrors.length > 0) undo();
    } catch {
      undo();
    }
  };
}

type AdminApiState = Record<typeof adminApi.reducerPath, ReturnType<typeof adminApi.reducer>>;

export const {
  useMeQuery,
  useOrganizationsQuery,
  useOrganizationQuery,
  useAuditLogQuery,
  useSuspendOrganizationMutation,
  useUnsuspendOrganizationMutation,
  useChangeOrganizationPlanMutation,
  useRevokeUserSessionsMutation,
} = adminApi;
