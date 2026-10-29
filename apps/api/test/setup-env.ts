import { randomUUID } from 'node:crypto';
import { inject } from 'vitest';

// A database per test file, so files can run in parallel without seeing each other's data.
const base = inject('mongoUri');
const url = new URL(base);
url.pathname = `/test_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('directConnection', 'true');
process.env['MONGODB_URI'] = url.toString();
process.env['OTEL_SDK_DISABLED'] = 'true';
