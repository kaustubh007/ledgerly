import mongoose from 'mongoose';

// Inside connection.transaction(fn), every model operation picks up the session from
// AsyncLocalStorage. Without this, forgetting `{ session }` on one call silently runs that
// call outside the transaction.
mongoose.set('transactionAsyncLocalStorage', true);
// Unknown query filter keys are an error, not silently dropped (a typo would widen a query).
mongoose.set('strictQuery', 'throw');

export async function connect(uri: string): Promise<typeof mongoose> {
  return mongoose.connect(uri, {
    // int64 comes back as bigint instead of a BSON Long, including from .lean() and aggregate.
    useBigInt64: true,
    serverSelectionTimeoutMS: 10_000,
  });
}

export function isConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect();
}

/**
 * Runs `fn` in a multi-document transaction, retrying on transient errors such as write
 * conflicts. `fn` may run more than once, so it must not have side effects outside MongoDB
 * (emails go through the outbox, which is written in the same transaction).
 */
export async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return mongoose.connection.transaction(fn);
}

/** Creates every model's indexes. Called at boot and by tests. */
export async function syncIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
}

export async function dropDatabase(): Promise<void> {
  await mongoose.connection.dropDatabase();
}

export function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
}
