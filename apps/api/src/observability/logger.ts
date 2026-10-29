import { trace } from '@opentelemetry/api';
import { pino, type Logger } from 'pino';
import { currentContext } from '../context/request-context.ts';

export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'ledgerly-api' },
    // Every line carries who and which trace, without anyone passing them in.
    mixin() {
      const ctx = currentContext();
      const span = trace.getActiveSpan()?.spanContext();
      return {
        requestId: ctx?.requestId,
        userId: ctx?.user?.userId,
        orgId: ctx?.tenant?.orgId,
        traceId: span?.traceId,
      };
    },
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.email',
        'variables.input.password',
        'variables.token',
        'variables.input.token',
        'variables.email',
        'variables.input.email',
      ],
      censor: '[redacted]',
    },
  });
}
