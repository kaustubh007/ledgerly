import { Schema, Types, type PipelineStage, type SchemaDefinitionProperty } from 'mongoose';
import { currentOrgId } from '../context/request-context.ts';

/**
 * Tenant guard, layer 1 (PLAN §3.6). Applied to every schema that holds tenant data.
 *
 * - Requires the schema to declare `orgId: tenantOrgId` (explicit, so the field is in the
 *   inferred TypeScript types too).
 * - Every query is narrowed to the org in the request context, and refuses to run without one.
 * - Every aggregate gets a leading `$match` on the org, and its `$lookup` stages must be built
 *   with `tenantLookup()` (layer 2).
 * - New documents get the context org; a document for another org is refused.
 */
export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

const QUERY_OPERATIONS = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
] as const;

const FORBIDDEN_STAGES = ['$unionWith', '$graphLookup', '$out', '$merge', '$documents'];

function requireOrg(model: string): string {
  const orgId = currentOrgId();
  if (orgId === undefined) {
    throw new TenantScopeError(`${model} is tenant data and there is no organisation in context.`);
  }
  return orgId;
}

function sameOrg(value: unknown, orgId: string): boolean {
  return value instanceof Types.ObjectId ? value.equals(orgId) : String(value) === orgId;
}

function checkPipeline(stages: readonly PipelineStage[], orgId: string, model: string): void {
  for (const stage of stages) {
    for (const forbidden of FORBIDDEN_STAGES) {
      if (forbidden in stage)
        throw new TenantScopeError(`${forbidden} is not allowed on ${model}.`);
    }
    if ('$lookup' in stage) {
      const first = stage.$lookup.pipeline?.[0];
      const match = first !== undefined && '$match' in first ? first.$match : undefined;
      if (match === undefined || !sameOrg(match['orgId'], orgId)) {
        throw new TenantScopeError(`$lookup on ${model} must be built with tenantLookup().`);
      }
    }
    if ('$facet' in stage) {
      for (const sub of Object.values(stage.$facet)) checkPipeline(sub, orgId, model);
    }
  }
}

/** The `orgId` field every tenant schema declares. Immutable: a document never changes tenant. */
export const tenantOrgId = {
  type: Schema.Types.ObjectId,
  required: true,
  immutable: true,
  index: true,
} as const satisfies SchemaDefinitionProperty;

export function tenantGuard(schema: Schema): void {
  if (schema.pathType('orgId') !== 'real') {
    throw new Error('A tenant schema must declare `orgId: tenantOrgId`.');
  }

  for (const operation of QUERY_OPERATIONS) {
    schema.pre(operation, function () {
      const orgId = requireOrg(this.model.modelName);
      const filter = this.getFilter();
      if ('orgId' in filter && !sameOrg(filter['orgId'], orgId)) {
        throw new TenantScopeError(`Query on ${this.model.modelName} names another organisation.`);
      }
      this.where({ orgId });
    });
  }

  schema.pre('estimatedDocumentCount', function () {
    throw new TenantScopeError(
      `estimatedDocumentCount cannot be scoped to an organisation (${this.model.modelName}).`,
    );
  });

  schema.pre('aggregate', function () {
    const model = this.model().modelName;
    const orgId = requireOrg(model);
    checkPipeline(this.pipeline(), orgId, model);
    this.pipeline().unshift({ $match: { orgId: new Types.ObjectId(orgId) } });
  });

  schema.pre('validate', function () {
    const orgId = requireOrg((this.constructor as unknown as { modelName: string }).modelName);
    const current: unknown = this.get('orgId');
    if (current == null) this.set('orgId', orgId);
    else if (!sameOrg(current, orgId)) {
      throw new TenantScopeError('Document belongs to another organisation.');
    }
  });

  schema.pre('bulkWrite', function () {
    throw new TenantScopeError('bulkWrite bypasses the tenant guard; use model operations.');
  });
}

/**
 * Tenant guard, layer 2. The only way to write a `$lookup` that the guard accepts: the joined
 * collection is filtered to the same organisation before anything else happens.
 */
export function tenantLookup(stage: {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
}): PipelineStage.Lookup {
  const orgId = currentOrgId();
  if (orgId === undefined) throw new TenantScopeError('tenantLookup() needs an organisation.');
  return {
    $lookup: { ...stage, pipeline: [{ $match: { orgId: new Types.ObjectId(orgId) } }] },
  };
}
