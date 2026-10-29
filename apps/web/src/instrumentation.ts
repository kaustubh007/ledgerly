// Next.js calls register() once per server process. Tracing the web server's fetches to the API
// joins its spans to the API's (traceparent is propagated by the undici instrumentation), so one
// trace covers web → api → MongoDB (PLAN §3.10).
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs' || process.env['OTEL_SDK_DISABLED'] === 'true')
    return;
  const { startTracing } = await import('./instrumentation.node');
  startTracing();
}
