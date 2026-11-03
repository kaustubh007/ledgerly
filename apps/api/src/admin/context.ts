import DataLoader from 'dataloader';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { currentContext, type StaffRole } from '../context/request-context.ts';
import type { Deps } from '../deps.ts';
import { Organization } from '../features/organizations/organization.model.ts';
import { forbidden, unauthenticated } from '../graphql/errors.ts';
import { Staff, type StaffRecord } from './staff/staff.model.ts';

/** Per-request context of the admin Apollo Server. Identity comes from AsyncLocalStorage. */
export interface AdminContext {
  readonly deps: Deps;
  readonly req: Request;
  readonly res: Response;
  readonly loaders: AdminLoaders;
}

export interface AdminLoaders {
  readonly staff: DataLoader<string, StaffRecord | undefined>;
  readonly orgName: DataLoader<string, string | undefined>;
}

export function createAdminLoaders(): AdminLoaders {
  const ids = (keys: readonly string[]) => keys.map((k) => new Types.ObjectId(k));
  return {
    staff: new DataLoader(async (keys) => {
      const rows = await Staff.find({ _id: { $in: ids(keys) } })
        .lean()
        .exec();
      const byId = new Map(rows.map((row) => [row._id.toString(), row]));
      return keys.map((key) => byId.get(key));
    }),
    orgName: new DataLoader(async (keys) => {
      const rows = await Organization.find({ _id: { $in: ids(keys) } }, { name: 1 })
        .lean()
        .exec();
      const byId = new Map(rows.map((row) => [row._id.toString(), row.name]));
      return keys.map((key) => byId.get(key));
    }),
  };
}

export interface StaffCaller {
  readonly staffId: string;
  readonly sessionId: string;
  readonly role: StaffRole;
}

/** The signed-in staff member; `OPS` also requires that role (SUPPORT gets FORBIDDEN). */
export function requireStaff(role?: 'OPS'): StaffCaller {
  const staff = currentContext()?.staff;
  if (!staff) throw unauthenticated();
  if (role === 'OPS' && staff.role !== 'OPS') throw forbidden('This needs the OPS role.');
  return staff;
}
