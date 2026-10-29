import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// A Server Component that imports a *value* from a 'use client' module receives a client
// reference, not the value, and nothing fails loudly: `{ first: PAGE_SIZE }` just becomes `{}`
// on its way to the browser. This happened twice in Phase 4. Client modules therefore export
// only components, hooks and types; shared values live in plain modules (constants.ts).

// Vitest runs from the package root (import.meta.url is a Vite URL here, not a file path).
const SRC = join(process.cwd(), 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__generated__' ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("'use client' modules", () => {
  it('export no constants (only components, hooks, functions and types)', () => {
    const offenders = files(SRC)
      .filter((path) => readFileSync(path, 'utf8').startsWith("'use client'"))
      .flatMap((path) =>
        [
          ...readFileSync(path, 'utf8').matchAll(
            /^export const (\w+)\s*(?::[^=]+)?=\s*(?!\(|async\s*\(|function)/gm,
          ),
        ]
          .map((m) => `${relative(SRC, path)}: ${m[1] ?? ''}`)
          // Hooks and components written as arrow functions are fine.
          .filter((entry) => !/: (use[A-Z]|[A-Z][a-z])/.test(entry)),
      );
    expect(offenders).toEqual([]);
  });
});
