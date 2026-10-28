import type { Types } from 'mongoose';
import type { Role } from '@ledgerly/domain';

/** What `Member` resolvers receive: a membership joined with its user. Kept apart from the
 * resolvers so generated types can import it without an import cycle. */
export interface MemberParent {
  readonly userId: Types.ObjectId;
  readonly role: Role;
  readonly joinedAt: Date;
  readonly name: string;
  readonly email: string;
}
