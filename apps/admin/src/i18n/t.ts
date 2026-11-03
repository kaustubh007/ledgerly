// English only (PLAN §3.14: an internal tool), but every visible string goes through t(), so
// adding a locale later means adding a dictionary, not hunting for literals.

const en = {
  'app.title': 'Ledgerly Admin',
  'a11y.skipToContent': 'Skip to content',
  'a11y.mainNavigation': 'Main navigation',
  'a11y.loading': 'Loading…',
  'nav.organizations': 'Organisations',
  'nav.audit': 'Audit log',
  'nav.recent': 'Recently viewed',
  'nav.signOut': 'Sign out',
  'nav.signedInAs': 'Signed in as {name} ({role})',

  'signIn.title': 'Sign in to Ledgerly Admin',
  'signIn.email': 'Email',
  'signIn.password': 'Password',
  'signIn.submit': 'Continue',
  'signIn.submitting': 'Checking…',
  'verify.title': 'Two-step verification',
  'verify.enrolIntro':
    'Add Ledgerly Admin to your authenticator app. Enter this key, then type the 6-digit code it shows.',
  'verify.secret': 'Setup key',
  'verify.uri': 'Or use this setup link in an app that accepts one',
  'verify.prompt': 'Enter the 6-digit code from your authenticator app, or a recovery code.',
  'verify.code': 'Code',
  'verify.submit': 'Verify',
  'verify.submitting': 'Verifying…',
  'verify.restart': 'Start again',
  'recovery.title': 'Save your recovery codes',
  'recovery.intro':
    'Each code signs you in once if you lose your authenticator. They are shown only now: store them somewhere safe.',
  'recovery.continue': 'I have saved them, continue',

  'orgs.title': 'Organisations',
  'orgs.search': 'Name or slug starts with',
  'orgs.status': 'Status',
  'orgs.anyStatus': 'Any status',
  'orgs.apply': 'Search',
  'orgs.empty': 'No organisations match.',
  'orgs.name': 'Name',
  'orgs.plan': 'Plan',
  'orgs.members': 'Members',
  'orgs.created': 'Created',
  'orgs.next': 'Next page',
  'orgs.first': 'First page',
  'status.ACTIVE': 'Active',
  'status.SUSPENDED': 'Suspended',

  'org.notFound': 'No such organisation.',
  'org.summary': 'Summary',
  'org.slug': 'Slug',
  'org.suspendedAt': 'Suspended since',
  'org.usage': 'Usage this month',
  'org.resource': 'Resource',
  'org.used': 'Used',
  'org.limit': 'Limit',
  'org.unlimited': 'Unlimited',
  'org.customers': 'Customers',
  'org.invoicesThisMonth': 'Invoices this month',
  'org.seats': 'Seats (members and open invitations)',
  'org.outstanding': 'Outstanding by currency',
  'org.noOutstanding': 'Nothing outstanding.',
  'org.currency': 'Currency',
  'org.amount': 'Amount',
  'org.invoices': 'Invoices',
  'org.health': 'Health',
  'org.lastActive': 'Last activity',
  'org.never': 'Never',
  'org.overdue': 'Overdue invoices',
  'org.membersTitle': 'Members',
  'org.email': 'Email',
  'org.role': 'Role',
  'org.sessions': 'Active sessions',
  'org.actions': 'Actions',
  'org.opsOnly': 'Changes need the OPS role.',

  'action.reason': 'Reason (written to the audit log)',
  'action.reasonHint': 'At least 10 characters, for example a ticket number and what happened.',
  'action.cancel': 'Cancel',
  'action.suspend': 'Suspend organisation',
  'action.suspendConfirm': 'Suspend',
  'action.unsuspend': 'Unsuspend organisation',
  'action.unsuspendConfirm': 'Unsuspend',
  'action.changePlan': 'Change plan',
  'action.newPlan': 'New plan',
  'action.changePlanConfirm': 'Change plan',
  'action.revoke': 'Sign out everywhere',
  'action.revokeFor': 'Sign {name} out everywhere',
  'action.revokeConfirm': 'Sign out of all sessions',
  'action.working': 'Working…',
  'toast.suspended': '{name} is suspended.',
  'toast.unsuspended': '{name} is active again.',
  'toast.planChanged': '{name} is now on {plan}.',
  'toast.revoked': 'Signed out of {count} sessions.',
  'toast.dismiss': 'Dismiss',
  'toast.region': 'Notifications',

  'audit.title': 'Audit log',
  'audit.organizationId': 'Organisation id',
  'audit.action': 'Action',
  'audit.anyAction': 'Any action',
  'audit.at': 'When',
  'audit.staff': 'Staff',
  'audit.organization': 'Organisation',
  'audit.reason': 'Reason',
  'audit.empty': 'No entries match.',
  'audit.system': '(unknown)',

  'error.title': 'Something went wrong',
  'error.notFound': 'Page not found',
  'error.back': 'Back to organisations',

  'errors.generic': 'Something went wrong. Please try again.',
  'errors.NETWORK': 'The server could not be reached. Check your connection and try again.',
  'errors.INVALID_CREDENTIALS': 'Wrong email or password.',
  'errors.RATE_LIMITED': 'Too many attempts. Try again in 15 minutes.',
  'errors.MFA_EXPIRED': 'This sign-in has expired. Enter your email and password again.',
  'errors.INVALID_CODE': 'That code is not valid.',
  'errors.INVALID_EMAIL': 'Enter a valid email address.',
  'errors.TOO_SMALL': 'Give a reason of at least 10 characters.',
  'errors.TOO_BIG': 'This is too long.',
  'errors.NOT_FOUND': 'It no longer exists.',
  'errors.ALREADY_SUSPENDED': 'The organisation is already suspended.',
  'errors.NOT_SUSPENDED': 'The organisation is not suspended.',
  'errors.PLAN_UNCHANGED': 'The organisation is already on that plan.',
  'errors.FORBIDDEN': 'This needs the OPS role.',
  'errors.UNAUTHENTICATED': 'Your session has ended. Sign in again.',
} as const;

export type MessageKey = keyof typeof en;

/** `t('toast.suspended', { name })`. Unknown `errors.*` codes fall back to the generic one. */
export function t(key: MessageKey, vars: Readonly<Record<string, string | number>> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function errorMessage(code: string): string {
  const key = `errors.${code}`;
  return key in en ? t(key as MessageKey) : t('errors.generic');
}

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso)) + ' UTC';

/** Exact: Intl formats the decimal string itself, never a float (CLAUDE.md, money rules). */
export const formatMoney = (amount: string, currency: string): string =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
    amount as Intl.StringNumericLiteral,
  );
