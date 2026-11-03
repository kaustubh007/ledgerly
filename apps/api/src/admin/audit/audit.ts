import { Types } from 'mongoose';
import { currentContext } from '../../context/request-context.ts';
import { AuditEntry } from './audit.model.ts';

export interface AuditRecord {
  readonly action: string;
  readonly staffId?: string | Types.ObjectId | null;
  readonly orgId?: string | Types.ObjectId | null;
  readonly targetUserId?: string | Types.ObjectId | null;
  readonly reason?: string | null;
  readonly details?: Readonly<Record<string, unknown>> | null;
}

const toId = (id: string | Types.ObjectId | null | undefined) =>
  id == null ? null : new Types.ObjectId(id);

/**
 * Appends one audit entry. Inside a transaction it joins it, so a write and its audit entry
 * commit together. The staff id defaults to the signed-in staff member.
 */
export async function audit(record: AuditRecord): Promise<void> {
  const context = currentContext();
  await AuditEntry.create([
    {
      action: record.action,
      staffId: toId(record.staffId === undefined ? context?.staff?.staffId : record.staffId),
      orgId: toId(record.orgId),
      targetUserId: toId(record.targetUserId),
      reason: record.reason ?? null,
      details: record.details ?? null,
      requestId: context?.requestId ?? null,
    },
  ]);
}
