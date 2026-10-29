import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';

export function startTracing(): void {
  new NodeSDK({
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'ledgerly-web',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
  }).start();
}
