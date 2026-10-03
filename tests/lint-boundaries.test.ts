import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Lint fixtures: prove the boundary rules in eslint.config.mjs actually fire.
 *
 * Each case lints a snippet as if it lived at `filePath`. The file does not need to
 * exist; ESLint matches config blocks against the path. A rule that silently stopped
 * matching (a renamed folder, a glob typo) fails here instead of in review.
 */
const eslint = new ESLint({ cwd: process.cwd() });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId ?? '(none)');
}

describe('src/core determinism rules', () => {
  const file = 'src/core/__lint_fixture__.ts';

  it('bans Math.random', async () => {
    expect(await ruleIds('export const x = Math.random();\n', file)).toContain(
      'no-restricted-properties',
    );
  });

  it('bans Date.now', async () => {
    expect(await ruleIds('export const x = Date.now();\n', file)).toContain(
      'no-restricted-properties',
    );
  });

  it('bans new Date()', async () => {
    expect(await ruleIds('export const x = new Date();\n', file)).toContain(
      'no-restricted-syntax',
    );
  });

  it('bans performance.now', async () => {
    expect(await ruleIds('export const x = performance.now();\n', file)).toContain(
      'no-restricted-properties',
    );
  });

  it('allows the same calls outside src/core', async () => {
    const ids = await ruleIds(
      'export const x = Math.random() + Date.now();\n',
      'src/lib/x.ts',
    );
    expect(ids).not.toContain('no-restricted-properties');
  });
});

describe('src/core import rules', () => {
  const file = 'src/core/__lint_fixture__.ts';

  it.each(['react', 'react-dom', 'next', 'next/link', 'motion', '@xyflow/react'])(
    'bans importing %s',
    async (pkg) => {
      expect(await ruleIds(`import x from '${pkg}';\nexport { x };\n`, file)).toContain(
        'no-restricted-imports',
      );
    },
  );

  it('bans importing components, modules and app code', async () => {
    for (const path of ['@/components/x', '@/modules/registry', '@/app/page']) {
      expect(await ruleIds(`import x from '${path}';\nexport { x };\n`, file)).toContain(
        'no-restricted-imports',
      );
    }
  });
});

describe('@xyflow/react confinement', () => {
  const code = "import { ReactFlow } from '@xyflow/react';\nexport { ReactFlow };\n";

  it('fails in the scheduling module', async () => {
    expect(await ruleIds(code, 'src/modules/scheduling/Gantt.tsx')).toContain(
      'no-restricted-imports',
    );
  });

  it('fails in shared components', async () => {
    expect(await ruleIds(code, 'src/components/Graph.tsx')).toContain(
      'no-restricted-imports',
    );
  });

  it('is allowed in the deadlock module', async () => {
    expect(await ruleIds(code, 'src/modules/deadlock/Graph.tsx')).not.toContain(
      'no-restricted-imports',
    );
  });
});
