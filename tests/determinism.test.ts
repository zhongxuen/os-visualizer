import { describe, expect, it } from 'vitest';

import { scenarios, type Scenario } from '@/core/scenarios';

/**
 * Every scenario in the catalogue is deterministic and plain JSON.
 *
 * - Two runs of the same scenario are `toStrictEqual`: same input, same run.
 * - A run survives `JSON.stringify` → `JSON.parse` unchanged. `toStrictEqual` sees a key
 *   whose value is `undefined` (dropped by JSON), a `Map` or `Set` (becomes `{}`) and a
 *   class instance (loses its prototype), so none of them can hide in an event snapshot
 *   and break the share path.
 *
 * Passes on an empty catalogue and gains a test per scenario as modules land.
 */

function expectDeterministic(scenario: Scenario) {
  expect(scenario.run()).toStrictEqual(scenario.run());
}

function expectJsonSafe(scenario: Scenario) {
  const result = scenario.run();
  expect(JSON.parse(JSON.stringify(result))).toStrictEqual(result);
}

describe('the scenario catalogue', () => {
  it('has unique scenario ids', () => {
    const ids = scenarios.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const scenario of scenarios) {
    describe(scenario.id, () => {
      it('gives the same result when run twice', () => expectDeterministic(scenario));
      it('survives a JSON round-trip', () => expectJsonSafe(scenario));
    });
  }
});

describe('the checks catch what they claim to', () => {
  const base = { at: 0, id: 'x.0', label: 'x', citation: 'ostep.4' };

  function scenarioOf(event: object): Scenario {
    return {
      id: 'probe',
      title: 'probe',
      run: () => ({ events: [event] as never, phases: [], durationMs: 0 }),
    };
  }

  it('a run that differs between calls fails', () => {
    let calls = 0;
    const scenario = scenarioOf({});
    scenario.run = () => ({
      events: [{ ...base, n: (calls += 1) }] as never,
      phases: [],
      durationMs: 0,
    });
    expect(() => expectDeterministic(scenario)).toThrow();
  });

  it.each([
    ['an undefined value', { ...base, detail: undefined }],
    ['a Map', { ...base, state: new Map([[1, 2]]) }],
    ['a class instance', { ...base, state: new (class Snapshot {})() }],
  ])('%s fails the JSON round-trip', (_name, event) => {
    expect(() => expectJsonSafe(scenarioOf(event))).toThrow();
  });

  it('a plain event passes both', () => {
    const scenario = scenarioOf({ ...base, state: { queue: [1, 2], cpu: null } });
    expectDeterministic(scenario);
    expectJsonSafe(scenario);
  });
});
