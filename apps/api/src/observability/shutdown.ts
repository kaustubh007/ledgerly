// One place for "flush and close before exit", so the OTel SDK registered in instrumentation.ts
// and the HTTP server and database opened in main.ts shut down in a known order.
type Hook = () => Promise<void>;
const hooks: Hook[] = [];

/** Hooks run in reverse registration order: the last thing opened is the first closed. */
export function onShutdown(hook: Hook): void {
  hooks.unshift(hook);
}

export async function runShutdownHooks(): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook();
    } catch (error) {
      console.error('shutdown hook failed', error);
    }
  }
}
