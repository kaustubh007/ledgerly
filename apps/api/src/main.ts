import { createServer } from 'node:http';
import { systemClock } from './clock.ts';
import { loadConfig } from './config.ts';
import { connect, disconnect, syncIndexes } from './data/connection.ts';
import type { Deps } from './deps.ts';
import { importAccessTokenKeys } from './features/identity/tokens.ts';
import { createApp } from './http/app.ts';
import { createLogger } from './observability/logger.ts';
import { onShutdown, runShutdownHooks } from './observability/shutdown.ts';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);

const deps: Deps = {
  config,
  clock: systemClock,
  logger,
  accessKeys: await importAccessTokenKeys(
    config.ACCESS_TOKEN_PRIVATE_JWK,
    config.ACCESS_TOKEN_PUBLIC_JWK,
  ),
  graceKey: Buffer.from(config.REFRESH_GRACE_KEY, 'base64url'),
};

await connect(config.MONGODB_URI);
onShutdown(disconnect);
await syncIndexes();

const { app, apollo } = await createApp(deps);
const server = createServer(app);
server.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'api listening');
});
onShutdown(async () => {
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  await apollo.stop();
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    void runShutdownHooks().finally(() => process.exit(0));
  });
}
