import { allowPlatformReads } from '../data/platform-access.ts';

// The only tenant data the admin console may read (ADR-0004), all of it counts and totals, one
// organisation per query. Every other tenant model, and every write to tenant data, still throws
// under runAsPlatform(). Adding a line here widens the platform scope: it needs a reason in
// DECISIONS.md and a test.
allowPlatformReads('Customer', ['countDocuments']);
allowPlatformReads('Invoice', ['countDocuments', 'aggregate']);
allowPlatformReads('Invitation', ['countDocuments']);
