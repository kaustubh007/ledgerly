import { isAction, type Middleware } from '@reduxjs/toolkit';

/** What leaves the app. Deliberately small: an event name and when; no payloads, no PII. */
export interface AnalyticsEvent {
  readonly type: string;
  readonly at: number;
}

export interface AnalyticsSink {
  send(event: AnalyticsEvent): void;
}

/** Actions worth counting. Everything else (including every payload) stays in the browser. */
export const TRACKED_ACTIONS: ReadonlySet<string> = new Set([
  'ui/themeChanged',
  'ui/navToggled',
  'session/signedOut',
]);

/**
 * A custom Redux middleware: it sees every action on its way to the reducers, forwards the
 * tracked ones to a sink, and always passes the action on unchanged.
 */
export function analyticsMiddleware(sink: AnalyticsSink, now: () => number = Date.now): Middleware {
  return () => (next) => (action) => {
    if (isAction(action) && TRACKED_ACTIONS.has(action.type)) {
      try {
        sink.send({ type: action.type, at: now() });
      } catch {
        // Analytics must never break the app.
      }
    }
    return next(action);
  };
}

/** No analytics backend is in scope for this project; in development, events go to the console. */
export const consoleSink: AnalyticsSink = {
  send(event) {
    console.debug('[analytics]', event.type);
  },
};

export const discardSink: AnalyticsSink = {
  send() {
    // Production has no analytics backend in this project's scope: events are dropped.
  },
};
