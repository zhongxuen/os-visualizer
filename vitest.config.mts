import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkGfm from 'remark-gfm';
import { defineConfig } from 'vitest/config';

/**
 * Two projects, deliberately:
 *
 * - `core` runs in **node**: `src/core/**` and `tests/**` (fixtures, oracles, lint
 *   fixtures, determinism). The algorithms are framework-free, so their tests must not
 *   need a DOM. If a core test ever needs jsdom, a boundary rule has been broken.
 * - `ui` runs in **jsdom**: `src/components/**`, `src/modules/**` and `src/lib/**`.
 *
 * fast-check's global seed is fixed in tests/setup-core.ts so property tests are
 * reproducible; a failing run prints the seed and path to replay.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'core',
          environment: 'node',
          setupFiles: ['./tests/setup-core.ts'],
          include: ['src/core/**/*.test.ts', 'tests/**/*.test.ts'],
          // Loading the full ESLint config for the lint fixture tests takes a few
          // seconds on a cold cache.
          testTimeout: 60_000,
        },
      },
      {
        resolve: { tsconfigPaths: true },
        // `mdx()` before `react()`, and `enforce: 'pre'` so it claims `.mdx` before esbuild
        // reads a lesson as TypeScript. Next compiles lessons with `@next/mdx`; this
        // compiles the same files for the tests, with the same one remark plugin.
        plugins: [{ enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) }, react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['./tests/setup-core.ts', './tests/setup.ts'],
          include: ['src/{components,modules,lib,content}/**/*.test.{ts,tsx}'],
          // axe in jsdom (twice, light and dark) is CPU-bound; with both projects running
          // in parallel a single check can pass the 5 s default.
          testTimeout: 20_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/core/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['**/*.test.*', '**/index.ts'],
      reportOnFailure: true,
    },
  },
});
