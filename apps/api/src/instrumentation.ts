// Loaded with `node --import` before anything else, so the instrumentations can patch http,
// express, graphql and the MongoDB driver before they are first imported.
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { onShutdown } from './observability/shutdown.ts';

if (process.env['OTEL_SDK_DISABLED'] !== 'true') {
  const sdk = new NodeSDK({
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'ledgerly-api',
    // Endpoint from OTEL_EXPORTER_OTLP_ENDPOINT (default http://localhost:4318).
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => req.url === '/healthz' }),
      new ExpressInstrumentation(),
      // Resolver spans for every field would drown the trace; keep operation-level spans.
      new GraphQLInstrumentation({ ignoreTrivialResolveSpans: true, mergeItems: true }),
      // Statement text can contain emails and tokens; record the shape, not the values.
      new MongoDBInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });
  sdk.start();
  // Registered first, so it runs last: spans from the shutdown itself are still exported.
  onShutdown(() => sdk.shutdown());
}
