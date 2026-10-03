import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

/**
 * The architecture boundary rules below are the mechanical half of CLAUDE.md. Structure
 * copied from Internet Visualizer and adapted to this repo.
 *
 *   1. src/core/** may not import a framework, UI, app or module code.
 *      The algorithms are judged by worked-example, property and oracle tests that run
 *      in plain node. If core needs React, the code is on the wrong side of the line.
 *   2. src/core/** may not call Math.random, Date.now, `new Date()` or performance.now.
 *      "Same input = the same run" (aim 3) is only true if nothing in core reads the
 *      clock or an unseeded source. Randomness goes through the vendored seeded rng.
 *   3. src/modules/<a>/** may not import src/modules/<b>/**. One exception: `compare`
 *      may import the scheduling module's public renderers from
 *      src/modules/scheduling/index.ts, and nothing else of it. Compare *is* several
 *      scheduling views side by side; duplicating the Gantt renderer would be worse.
 *   4. src/components/** may not import src/modules/**. Shared UI stays shared.
 *      src/modules/registry.ts is the exception: it is the manifest the home page and
 *      navigation read, not a module.
 *   5. @xyflow/react may only be imported under src/modules/deadlock/**, so React Flow
 *      can never end up in another route's bundle.
 *
 * Do not weaken these. If a rule is in the way, the code is in the wrong folder.
 * tests/lint-boundaries.test.ts proves rules 1, 2 and 5 fire.
 */

const XYFLOW_MESSAGE =
  '@xyflow/react is only for the deadlock graph. Import it under src/modules/deadlock/** so it stays out of every other route bundle.';

const CORE_MESSAGE =
  'src/core is framework-free algorithm code: it must run in node with no DOM. Move anything that needs React into src/components or the module that uses it.';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ---------------------------------------------------------------------------
  // Rule 5: React Flow is confined to the deadlock module.
  // Declared before rule 1 because flat config replaces a rule's options wholesale:
  // the core block below repeats the @xyflow ban in its own list.
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@xyflow/react', message: XYFLOW_MESSAGE }],
          patterns: [{ group: ['@xyflow/*'], message: XYFLOW_MESSAGE }],
        },
      ],
    },
  },
  {
    files: ['src/modules/deadlock/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // ---------------------------------------------------------------------------
  // Rules 1 and 2: src/core stays framework-free and deterministic.
  // ---------------------------------------------------------------------------
  {
    files: ['src/core/**/*.{ts,tsx}'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'next', 'motion', '@xyflow/react'].map(
            (name) => ({ name, message: CORE_MESSAGE }),
          ),
          patterns: [
            {
              group: ['react/*', 'react-dom/*', 'next/*', 'motion/*', '@xyflow/*'],
              message: CORE_MESSAGE,
            },
            {
              group: [
                '@/app/*',
                '@/components/*',
                '@/modules/*',
                '**/app/**',
                '**/components/**',
                '**/modules/**',
              ],
              message:
                'src/core must not depend on the app, UI components or any module. Dependencies point inward: app -> modules -> components -> core.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'src/core must be deterministic. Use the seeded rng in src/core/sim.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'src/core must not read the clock. Time is the simulation tick.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'src/core must not read the clock. Time is the simulation tick.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'src/core must not read the clock. Time is the simulation tick.',
        },
        {
          selector: "CallExpression[callee.name='Date']",
          message: 'src/core must not read the clock. Time is the simulation tick.',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Rules 3 and 4: module independence, enforced by path element type.
  // Elements are folders. Two single files need their own identity, so they are
  // classified with file descriptors (`boundaries/files`, eslint-plugin-boundaries v7):
  // the registry, and scheduling's public entry point for the Compare exception.
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mjs}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'core', pattern: 'src/core' },
        { type: 'components', pattern: 'src/components' },
        { type: 'lib', pattern: 'src/lib' },
        { type: 'module', pattern: 'src/modules/*', capture: ['moduleName'] },
      ],
      'boundaries/files': [
        { category: 'registry', pattern: 'src/modules/registry.ts' },
        { category: 'scheduling-entry', pattern: 'src/modules/scheduling/index.ts' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'core' } },
              disallow: {
                to: {
                  element: { types: { anyOf: ['app', 'components', 'module'] } },
                },
              },
              message:
                'src/core must stay framework-free: it may not import UI, app or module code.',
            },
            // Rule 4
            {
              from: { element: { type: 'components' } },
              disallow: { to: { element: { type: 'module' } } },
              message:
                'src/components are shared building blocks and may not depend on a specific module. If it needs module knowledge, it belongs in that module.',
            },
            // Rule 4, the registry exception. Later policies override earlier ones.
            {
              from: { element: { types: { anyOf: ['components', 'app'] } } },
              allow: { to: { file: { categories: 'registry' } } },
            },
            // Rule 3
            {
              from: { element: { type: 'module' } },
              disallow: {
                to: {
                  element: {
                    type: 'module',
                    captured: { moduleName: '!{{from.captured.moduleName}}' },
                  },
                },
              },
              message:
                'Modules are independent: this module may not import from "{{to.captured.moduleName}}". Share via src/core or src/components instead.',
            },
            // Rule 3, the Compare exception: `compare` may import scheduling's public
            // entry point (src/modules/scheduling/index.ts) and nothing else of it.
            {
              from: { element: { type: 'module', captured: { moduleName: 'compare' } } },
              allow: { to: { file: { categories: 'scheduling-entry' } } },
            },
          ],
        },
      ],
    },
  },

  // Tests and config files sit outside the architecture; exempt them.
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*', 'e2e/**/*', '*.config.{ts,mjs,mts,js}'],
    rules: {
      'boundaries/dependencies': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
