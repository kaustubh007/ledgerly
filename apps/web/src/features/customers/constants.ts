// Constants shared by Server and Client Components live in plain modules. Exported from a
// 'use client' module, a value reaches a Server Component as a client *reference*, not the value:
// `variables={{ first: CUSTOMER_PAGE_SIZE }}` silently became `{}` (DECISIONS.md, Phase 4).

export const CUSTOMER_PAGE_SIZE = 20;

/** Document locales offered in the form. Any BCP 47 tag is valid on the API side. */
export const DOCUMENT_LOCALES = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'ar-AE', 'ja-JP'] as const;
