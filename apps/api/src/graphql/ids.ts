import { Types } from 'mongoose';

/** Parses a client-supplied id. Malformed ids are treated as "not found", never as an error. */
export function objectId(id: string): Types.ObjectId | undefined {
  return Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id.toLowerCase()
    ? new Types.ObjectId(id)
    : undefined;
}
