import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb';
import type { TestProject } from 'vitest/node';

let container: StartedMongoDBContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  // The same image as compose.yaml. The module starts it as a single-node replica set, which
  // multi-document transactions require (ADR-0002).
  container = await new MongoDBContainer('mongo:9.0.4').start();
  project.provide('mongoUri', container.getConnectionString());
}

export async function teardown(): Promise<void> {
  await container?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
