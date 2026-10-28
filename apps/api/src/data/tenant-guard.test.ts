import mongoose, { Schema, Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runInTenant } from '../context/request-context.ts';
import { connect, disconnect, inTransaction } from './connection.ts';
import { tenantGuard, tenantLookup, tenantOrgId, TenantScopeError } from './tenant-guard.ts';

const thingSchema = new Schema({
  orgId: tenantOrgId,
  name: { type: String, required: true },
  n: Number,
});
thingSchema.plugin(tenantGuard);
const Thing = mongoose.model('GuardThing', thingSchema);

const tagSchema = new Schema({ orgId: tenantOrgId, thingName: String, tag: String });
tagSchema.plugin(tenantGuard);
const Tag = mongoose.model('GuardTag', tagSchema);

const orgA = new Types.ObjectId().toString();
const orgB = new Types.ObjectId().toString();
// Mongoose queries are lazy thenables: they execute when awaited. The await must therefore
// happen *inside* the context, or the query runs with no organisation at all.
const asA = <T>(fn: () => PromiseLike<T>): Promise<T> =>
  runInTenant(orgA, 'OWNER', async () => await fn());
const asB = <T>(fn: () => PromiseLike<T>): Promise<T> =>
  runInTenant(orgB, 'OWNER', async () => await fn());

beforeAll(async () => {
  await connect(process.env['MONGODB_URI'] ?? '');
  await Thing.createIndexes();
  await Tag.createIndexes();
});
afterAll(disconnect);

beforeEach(async () => {
  await asA(() => Thing.deleteMany({}));
  await asB(() => Thing.deleteMany({}));
  await asA(() =>
    Thing.create([
      { name: 'a1', n: 1 },
      { name: 'a2', n: 2 },
    ]),
  );
  await asB(() => Thing.create({ name: 'b1', n: 10 }));
});

describe('tenant guard: no organisation in context', () => {
  it.each([
    ['find', () => Thing.find()],
    ['findOne', () => Thing.findOne()],
    ['findById', () => Thing.findById(new Types.ObjectId())],
    ['countDocuments', () => Thing.countDocuments()],
    ['estimatedDocumentCount', () => Thing.estimatedDocumentCount()],
    ['distinct', () => Thing.distinct('name')],
    ['updateMany', () => Thing.updateMany({}, { n: 0 })],
    ['deleteMany', () => Thing.deleteMany({})],
    ['aggregate', () => Thing.aggregate([{ $match: {} }])],
    ['create', () => Thing.create({ name: 'x' })],
    ['insertMany', () => Thing.insertMany([{ name: 'x' }])],
    ['exists', () => Thing.exists({ name: 'a1' })],
  ])('%s throws', async (_, op) => {
    await expect(op()).rejects.toThrow(TenantScopeError);
  });
});

describe('tenant guard: scoping', () => {
  it('scopes reads, counts, distinct and exists', async () => {
    expect((await asA(() => Thing.find().lean())).map((t) => t.name).sort()).toEqual(['a1', 'a2']);
    expect(await asB(() => Thing.countDocuments())).toBe(1);
    expect(await asA(() => Thing.distinct('name'))).toEqual(['a1', 'a2']);
    expect(await asA(() => Thing.exists({ name: 'b1' }))).toBeNull();
  });

  it('cannot read another org by id', async () => {
    const b1 = await asB(() => Thing.findOne({ name: 'b1' }).orFail());
    expect(await asA(() => Thing.findById(b1._id))).toBeNull();
  });

  it('refuses a filter that names another org', async () => {
    await expect(asA(() => Thing.find({ orgId: orgB }))).rejects.toThrow(/another organisation/);
  });

  it('scopes writes', async () => {
    await asA(() => Thing.updateMany({}, { n: 0 }));
    await asA(() => Thing.deleteMany({ name: 'b1' }));
    const b1 = await asB(() => Thing.findOne({ name: 'b1' }).lean().orFail());
    expect(b1.n).toBe(10);
  });

  it('stamps new documents and refuses documents for another org', async () => {
    const created = await asA(() => Thing.create({ name: 'a3' }));
    expect(created.orgId.toString()).toBe(orgA);
    await expect(asA(() => Thing.create({ name: 'x', orgId: orgB }))).rejects.toThrow(
      TenantScopeError,
    );
    const many = await asA(() => Thing.insertMany([{ name: 'a4' }, { name: 'a5' }]));
    expect(many.every((d) => d.orgId.toString() === orgA)).toBe(true);
  });

  it('upserts into the context org', async () => {
    await asA(() => Thing.updateOne({ name: 'new' }, { $set: { n: 5 } }, { upsert: true }));
    expect(await asB(() => Thing.exists({ name: 'new' }))).toBeNull();
    expect(await asA(() => Thing.exists({ name: 'new' }))).not.toBeNull();
  });

  it('refuses bulkWrite', async () => {
    await expect(
      asA(() => Thing.bulkWrite([{ insertOne: { document: { name: 'x' } } }])),
    ).rejects.toThrow(TenantScopeError);
  });

  it('cannot move a document to another org', async () => {
    await asA(() => Thing.updateOne({ name: 'a1' }, { $set: { orgId: new Types.ObjectId(orgB) } }));
    expect(await asB(() => Thing.exists({ name: 'a1' }))).toBeNull();
  });
});

describe('tenant guard: aggregation', () => {
  it('prepends a $match on the org', async () => {
    const totals = await asA(() =>
      Thing.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$n' } } }]),
    );
    expect(totals[0]?.total).toBe(3);
  });

  it('accepts tenantLookup and only joins the same org', async () => {
    await asA(() => Tag.create({ thingName: 'a1', tag: 'mine' }));
    await asB(() => Tag.create({ thingName: 'a1', tag: 'theirs' }));
    const rows = await asA(() =>
      Thing.aggregate<{ name: string; tags: { tag: string }[] }>([
        { $match: { name: 'a1' } },
        tenantLookup({
          from: 'guardtags',
          localField: 'name',
          foreignField: 'thingName',
          as: 'tags',
        }),
      ]),
    );
    expect(rows[0]?.tags.map((t) => t.tag)).toEqual(['mine']);
  });

  it.each([
    [
      'a raw $lookup',
      { $lookup: { from: 'guardtags', localField: 'name', foreignField: 'thingName', as: 't' } },
    ],
    [
      'a $lookup scoped to another org',
      {
        $lookup: {
          from: 'guardtags',
          as: 't',
          pipeline: [{ $match: { orgId: new Types.ObjectId(orgB) } }],
        },
      },
    ],
    ['$unionWith', { $unionWith: { coll: 'guardtags' } }],
    [
      '$graphLookup',
      {
        $graphLookup: {
          from: 'guardtags',
          startWith: '$name',
          connectFromField: 'a',
          connectToField: 'b',
          as: 'g',
        },
      },
    ],
    ['$out', { $out: 'stolen' }],
    ['$merge', { $merge: { into: 'stolen' } }],
    [
      'a raw $lookup inside $facet',
      {
        $facet: {
          x: [
            {
              $lookup: {
                from: 'guardtags',
                localField: 'name',
                foreignField: 'thingName',
                as: 't',
              },
            },
          ],
        },
      },
    ],
  ])('refuses %s', async (_, stage) => {
    await expect(asA(() => Thing.aggregate([stage as never]))).rejects.toThrow(TenantScopeError);
  });

  it('tenantLookup needs an org', () => {
    expect(() => tenantLookup({ from: 'x', localField: 'a', foreignField: 'b', as: 'c' })).toThrow(
      TenantScopeError,
    );
  });
});

describe('tenant guard: setup', () => {
  it('refuses a schema that does not declare orgId', () => {
    expect(() => new Schema({ name: String }).plugin(tenantGuard)).toThrow(/tenantOrgId/);
  });
});

describe('transactions', () => {
  it('commit together and pick up the session from AsyncLocalStorage', async () => {
    await asA(() =>
      inTransaction(async () => {
        await Thing.create({ name: 'tx1' });
        await Thing.updateOne({ name: 'a1' }, { n: 100 });
      }),
    );
    expect(await asA(() => Thing.countDocuments({ name: 'tx1' }))).toBe(1);
  });

  it('roll back together', async () => {
    await expect(
      asA(() =>
        inTransaction(async () => {
          await Thing.create({ name: 'tx2' });
          throw new Error('boom');
        }),
      ),
    ).rejects.toThrow('boom');
    expect(await asA(() => Thing.countDocuments({ name: 'tx2' }))).toBe(0);
  });
});
