import { existsSync, readFileSync } from 'node:fs';
import { LOG_DIR } from './paths';

/**
 * The Phase 3 retro's tripwire: a run where every test passes but a server logged an error is a
 * failed run. Next.js marks server errors with "⨯"; the API logs errors at pino level 50.
 */
export default function globalTeardown(): void {
  const problems: string[] = [];
  for (const [file, pattern] of [
    ['web.log', /⨯/],
    ['api.log', /"level":(50|60)/],
  ] as const) {
    const path = `${LOG_DIR}/${file}`;
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (pattern.test(line)) problems.push(`${file}: ${line.slice(0, 300)}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Servers logged errors during the E2E run:\n${problems.join('\n')}`);
  }
}
