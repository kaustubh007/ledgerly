import { execFileSync } from 'node:child_process';

export const E2E_DATABASE = 'ledgerly_e2e';

/**
 * Every run starts from an empty database, so results never depend on earlier runs (rate-limit
 * counters, leftover users). The web app cannot import a MongoDB driver (dependency-cruiser), so
 * this goes through the compose service, which `make up` started.
 */
export default function globalSetup(): void {
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'mongo',
      'mongosh',
      '--quiet',
      E2E_DATABASE,
      '--eval',
      'db.dropDatabase()',
    ],
    {
      cwd: new URL('../../..', import.meta.url).pathname,
      stdio: 'inherit',
    },
  );
}
