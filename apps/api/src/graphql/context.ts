import DataLoader from 'dataloader';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { can, type Permission, type Role } from '@ledgerly/domain';
import { currentContext } from '../context/request-context.ts';
import type { Deps } from '../deps.ts';
import { Customer, type CustomerRecord } from '../features/customers/customer.model.ts';
import { User, type UserRecord } from '../features/identity/user.model.ts';
import { Payment, type PaymentRecord } from '../features/invoices/payment.model.ts';
import { forbidden, unauthenticated } from './errors.ts';

/**
 * Per-request GraphQL context. Identity and tenant come from AsyncLocalStorage (set by the HTTP
 * layer); this adds the request/response (auth mutations set cookies) and request-scoped
 * DataLoaders, which batch N lookups into one query and cache them for this request only.
 */
export interface GraphQLContext {
  readonly deps: Deps;
  readonly req: Request;
  readonly res: Response;
  readonly loaders: Loaders;
}

export interface Loaders {
  readonly user: DataLoader<string, UserRecord | undefined>;
  readonly customer: DataLoader<string, CustomerRecord | undefined>;
  readonly paymentsByInvoice: DataLoader<string, PaymentRecord[]>;
}

const ids = (keys: readonly string[]) => keys.map((k) => new Types.ObjectId(k));

function byId<T extends { _id: Types.ObjectId }>(
  keys: readonly string[],
  rows: T[],
): (T | undefined)[] {
  const map = new Map(rows.map((row) => [row._id.toString(), row]));
  return keys.map((key) => map.get(key));
}

export function createLoaders(): Loaders {
  return {
    user: new DataLoader(async (keys) =>
      byId(
        keys,
        await User.find({ _id: { $in: ids(keys) } })
          .lean()
          .exec(),
      ),
    ),
    // Tenant-guarded: a customer id from another organisation simply resolves to undefined.
    customer: new DataLoader(async (keys) =>
      byId(
        keys,
        await Customer.find({ _id: { $in: ids(keys) } })
          .lean()
          .exec(),
      ),
    ),
    paymentsByInvoice: new DataLoader(async (keys) => {
      const rows = await Payment.find({ invoiceId: { $in: ids(keys) } })
        .sort({ createdAt: 1 })
        .lean()
        .exec();
      return keys.map((key) => rows.filter((row) => row.invoiceId.toString() === key));
    }),
  };
}

export interface Caller {
  readonly userId: string;
  readonly sessionId: string;
}

export function requireUser(): Caller {
  const user = currentContext()?.user;
  if (!user) throw unauthenticated();
  return user;
}

export interface TenantCaller extends Caller {
  readonly orgId: string;
  readonly role: Role;
}

/**
 * Signed in, a member of the organisation named by `x-org`, and (optionally) allowed to do
 * `permission` there. A missing org and an org you are not in look the same from outside.
 */
export function requireTenant(permission?: Permission): TenantCaller {
  const user = requireUser();
  const tenant = currentContext()?.tenant;
  if (!tenant) throw forbidden('Choose an organisation you are a member of.');
  if (permission !== undefined && !can(tenant.role, permission)) throw forbidden();
  return { ...user, ...tenant };
}
