import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/mini';

import { defineShareState } from '@/core/state/schema';
import {
  SHARE_PARAM,
  shareStateFromSearch,
  shareStateToSearch,
} from '@/core/state/shareState';
import { expectNoAxeViolations } from '@/components/testing/axe';
import { parsePrefs, sharedPrefsStore } from '@/components/shell/prefs';

import { migrateProgress, parseProgress, PROGRESS_KEY } from './progress';
import { useProgress } from './useProgress';
import { shareStateFor, useShareState } from './useShareState';

describe('progress migration', () => {
  it('reads v1 field by field, keeping prefs untouched', () => {
    expect(
      migrateProgress({
        v: 1,
        completed: ['sched', 'sched', 3],
        saved: { sched: [{ a: 1 }], bad: 'x' },
        prefs: { theme: 'dark' },
      }),
    ).toEqual({
      v: 1,
      completed: ['sched'],
      saved: { sched: [{ a: 1 }] },
      prefs: { theme: 'dark' },
    });
  });

  it('upgrades the unversioned shapes', () => {
    expect(migrateProgress(['sched', 'vm']).completed).toEqual(['sched', 'vm']);
    expect(migrateProgress({ completed: ['vm'] }).completed).toEqual(['vm']);
  });

  it.each([null, 42, 'x', { v: 2, completed: ['a'] }])('empties %j', (raw) => {
    expect(migrateProgress(raw)).toEqual({ v: 1, completed: [], saved: {}, prefs: {} });
  });

  it('never throws on bad JSON', () => {
    expect(parseProgress('{oops').completed).toEqual([]);
    expect(parseProgress(null).completed).toEqual([]);
  });
});

describe('useProgress', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('marks completion and saves inputs under osv:v1, keeping the prefs', () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ v: 1, prefs: { theme: 'dark' } }),
    );
    const { result } = renderHook(() => useProgress());

    act(() => result.current.markComplete('sched'));
    act(() => result.current.markComplete('sched'));
    act(() => result.current.saveInput('sched', { procs: [1, 2] }));
    act(() => result.current.saveInput('sched', { procs: [3] }));
    act(() => result.current.removeSaved('sched', 0));

    expect(result.current.isComplete('sched')).toBe(true);
    expect(result.current.savedFor('sched')).toEqual([{ procs: [3] }]);
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual({
      v: 1,
      completed: ['sched'],
      saved: { sched: [{ procs: [3] }] },
      prefs: { theme: 'dark' },
    });

    act(() => result.current.reset());
    expect(result.current.progress.completed).toEqual([]);
    expect(parsePrefs(localStorage.getItem(PROGRESS_KEY)).theme).toBe('dark');
  });

  it('shares the key with the shell prefs: neither write loses the other', () => {
    const { result } = renderHook(() => useProgress());
    act(() => result.current.markComplete('vm'));
    sharedPrefsStore().set('pauseAtSteps', true);
    act(() => result.current.markComplete('replace'));
    const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY)!);
    expect(stored.completed).toEqual(['vm', 'replace']);
    expect(stored.prefs.pauseAtSteps).toBe(true);
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useProgress());
    act(() => result.current.markComplete('deadlock'));
    expect(result.current.isComplete('deadlock')).toBe(true);
  });

  it('follows another tab through the storage event', () => {
    const { result } = renderHook(() => useProgress());
    act(() => {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, completed: ['vm'] }));
      window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_KEY }));
    });
    expect(result.current.isComplete('vm')).toBe(true);
  });
});

const DEMO = defineShareState({
  m: 'demo',
  v: 1,
  input: z.object({ n: z.int() }),
  defaults: { step: 0, input: { n: 1 } },
});

describe('useShareState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/demo');
  });
  afterEach(() => vi.useRealTimers());

  it('looks a module up by key, and refuses an unknown one', () => {
    expect(shareStateFor('sched').m).toBe('sched');
    expect(() => shareStateFor('nope')).toThrow('nope');
  });

  it('reads the link after mount, then writes back debounced with replaceState', () => {
    const search = shareStateToSearch(DEMO, {
      m: 'demo',
      v: 1,
      step: 4,
      input: { n: 7 },
    })!;
    window.history.replaceState(null, '', `/demo${search}`);
    const replace = vi.spyOn(window.history, 'replaceState');
    const push = vi.spyOn(window.history, 'pushState');

    const { result } = renderHook(() => useShareState(DEMO, { delayMs: 200 }));
    expect(result.current.ready).toBe(true);
    expect(result.current.state.input.n).toBe(7);
    expect(result.current.linked?.step).toBe(4);

    act(() => result.current.setState((s) => ({ ...s, step: 5 })));
    act(() => result.current.setState((s) => ({ ...s, step: 6 })));
    replace.mockClear();
    act(() => vi.advanceTimersByTime(199));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(shareStateFromSearch(DEMO, window.location.search).step).toBe(6);
  });

  it('keeps the URL clean at the defaults and falls back on a bad link', () => {
    window.history.replaceState(null, '', `/demo?${SHARE_PARAM}=not-valid`);
    const { result } = renderHook(() => useShareState('sched'));
    expect(result.current.state).toEqual(shareStateFor('sched').defaults);
    act(() => vi.advanceTimersByTime(300));
    expect(window.location.search).toBe('');
    expect(result.current.link()).toBe(`${window.location.origin}/demo`);
  });

  it('link() writes at once and returns the URL', () => {
    const { result } = renderHook(() => useShareState(DEMO));
    act(() => result.current.setState((s) => ({ ...s, input: { n: 3 } })));
    const link = result.current.link()!;
    expect(new URL(link).searchParams.get(SHARE_PARAM)).not.toBeNull();
    expect(window.location.href).toBe(link);
  });

  it('a component using both hooks renders axe clean', async () => {
    vi.useRealTimers();
    function Probe() {
      const { state } = useShareState(DEMO);
      const { progress } = useProgress();
      return (
        <p>
          Step {state.step}, {progress.completed.length} done
        </p>
      );
    }
    const { container } = render(<Probe />);
    await expectNoAxeViolations(container);
  });
});
