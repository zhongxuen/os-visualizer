import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TICK_MS } from '@/core/events/builder';
import { timelineFrom } from '@/core/sim/playback';

import { PROGRESS_KEY } from '../state/progress';
import { readProgress } from '../state/useProgress';
import { expectNoAxeViolations } from '../testing/axe';
import { createPlaybackStore } from '../timeline/hooks/usePlayback';
import { buildTickRun } from '../timeline/testing';
import { Checkpoint } from './Checkpoint';
import { canonicalJson, matchExample } from './examples';
import { LessonStep } from './LessonStep';
import { checkpointKey, checkpointsDone } from './progress';
import { findVisual } from './reveal';
import { TryIt, tryItLabel } from './TryIt';
import type { CheckpointSpec, LessonMeta } from './types';
import { Walkthrough } from './Walkthrough';

const LESSON: LessonMeta = {
  id: 'lesson.test',
  module: 'test',
  route: '/test',
  title: 'Testing',
  summary: 'A lesson for the tests.',
  parts: 2,
};

const CHECKPOINTS: CheckpointSpec[] = [
  {
    id: 'cp1',
    example: 'ex',
    question: 'Which process runs from t = 3?',
    options: [
      { value: 'P1', label: 'P1' },
      { value: 'P2', label: 'P2' },
    ],
    answer: 'P2',
    reason: 'P2 runs: shortest remaining time.',
    holdAt: 2,
  },
];

function Content() {
  return (
    <>
      <LessonStep n={1} title="Part one" example="ex">
        <p>First part.</p>
        <TryIt at={1}>watch P1 start.</TryIt>
        <Checkpoint id="cp1" />
      </LessonStep>
      <LessonStep n={2} title="Part two">
        <p>Second part.</p>
      </LessonStep>
    </>
  );
}

function Harness({
  store,
  autoLoad = false,
}: {
  store: ReturnType<typeof createPlaybackStore>;
  autoLoad?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [loads, setLoads] = useState(0);
  return (
    <>
      <p data-testid="loads">{loads}</p>
      <button type="button" onClick={() => setActive(null)}>
        Edit the input
      </button>
      <Walkthrough
        lesson={LESSON}
        Content={Content}
        store={store}
        unit="tick"
        examples={[{ id: 'ex', title: 'The example' }]}
        activeExample={active}
        onLoadExample={(id) => {
          setActive(id);
          setLoads((n) => n + 1);
        }}
        checkpoints={CHECKPOINTS}
        autoLoad={autoLoad}
      />
    </>
  );
}

/**
 * Most tests drive the lesson by hand, as it works when it may not load examples itself
 * (a `?s=` link or saved Sandbox work: `lessonMayLoad`). `autoLoad` is Guided mode's
 * usual case, where opening a part loads its example (Q1).
 */
function setup({ autoLoad = false }: { autoLoad?: boolean } = {}) {
  const store = createPlaybackStore(timelineFrom(buildTickRun()));
  render(<Harness store={store} autoLoad={autoLoad} />);
  return store;
}

function card() {
  return document.querySelector('[data-checkpoint="cp1"]');
}

beforeEach(() => {
  window.localStorage.removeItem(PROGRESS_KEY);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

describe('Walkthrough', () => {
  it('shows one part at a time and moves between them', () => {
    setup();
    expect(screen.getByRole('heading', { name: /Part one$/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Part two$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next part' }));
    expect(screen.getByRole('heading', { name: /Part two$/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Part 2 of 2');
    expect(screen.getByText(/^Part 2 of 2 ·/)).toBeInTheDocument();
  });

  it('without auto-load, neither loads nor holds before the lesson is used', () => {
    const store = setup();
    expect(screen.getByRole('button', { name: 'Load this example' })).toBeInTheDocument();
    expect(screen.getByText(/The picture shows a different input/)).toBeInTheDocument();
    expect(screen.getByTestId('loads')).toHaveTextContent('0');
    act(() => store.getState().seek(5 * TICK_MS));
    expect(store.getState().virtualTime).toBe(5 * TICK_MS);
  });

  it('holds the timeline at an unanswered checkpoint once the example is loaded', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    expect(screen.getByText('(loaded)')).toBeInTheDocument();
    expect(card()).toHaveAttribute('data-state', 'asking');

    act(() => {
      store.getState().play();
      store.getState().seek(5 * TICK_MS);
    });
    expect(store.getState().virtualTime).toBe(2 * TICK_MS);
    expect(store.getState().status).not.toBe('playing');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Paused for a checkpoint: Which process runs from t = 3?',
    );
    // The card says so (docs/UIUX.md §7.3).
    expect(screen.getByText('Paused for this question')).toBeInTheDocument();
    expect(card()).toHaveAttribute('data-state', 'held');

    // Before the hold point nothing is held.
    act(() => store.getState().seek(1 * TICK_MS));
    expect(store.getState().virtualTime).toBe(1 * TICK_MS);
    expect(screen.queryByText('Paused for this question')).toBeNull();
  });

  it('without auto-load, asks with answer buttons that wait for the example', () => {
    setup();
    expect(card()).toHaveAttribute('data-state', 'idle');
    expect(screen.getByRole('button', { name: 'P2' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Load it' }));
    expect(screen.getByRole('button', { name: 'P2' })).toBeEnabled();
  });

  it('meets a right answer with a tick, the reason, and focus on the result', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    fireEvent.click(screen.getByRole('button', { name: 'P2' }));
    expect(screen.getByText('Correct.')).toHaveFocus();
    expect(screen.getByText('P2 runs: shortest remaining time.')).toBeInTheDocument();
    expect(card()).toHaveAttribute('data-state', 'correct');
    expect(readProgress().completed).toContain(checkpointKey('lesson.test', 'cp1'));
  });

  it('meets a wrong answer with the right one and the core’s reason, then completes', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    fireEvent.click(screen.getByRole('button', { name: 'P1' }));
    expect(screen.getByText('Not quite. The answer is P2.')).toHaveFocus();
    expect(screen.getByText('P2 runs: shortest remaining time.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^P2/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^P1/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(card()).toHaveAttribute('data-state', 'wrong');

    // Answered: the timeline is free again, and the lesson is complete.
    act(() => store.getState().seek(5 * TICK_MS));
    expect(store.getState().virtualTime).toBe(5 * TICK_MS);
    expect(readProgress().completed).toContain('lesson.test');
    expect(screen.getByText(/1 of 1 checkpoints · complete/)).toBeInTheDocument();
  });

  it('“Show the next step” moves one step past the question', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    fireEvent.click(screen.getByRole('button', { name: 'P2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show the next step' }));
    expect(store.getState().virtualTime).toBe(3 * TICK_MS);
  });

  it('“Show this moment” seeks to the checkpoint and starts holding there', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    act(() => store.getState().seek(1 * TICK_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Show this moment' }));
    expect(store.getState().virtualTime).toBe(2 * TICK_MS);
  });

  it('counts checkpoints answered on an earlier visit', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ v: 1, completed: [checkpointKey('lesson.test', 'cp1')] }),
    );
    setup();
    expect(screen.getByText(/1 of 1 checkpoints/)).toBeInTheDocument();
    expect(screen.getByText('Answered on an earlier visit')).toBeInTheDocument();
  });

  it('“Try it” loads the part’s example, then goes to its moment, paused', async () => {
    const store = setup();
    act(() => store.getState().seek(4 * TICK_MS));
    fireEvent.click(screen.getByRole('button', { name: tryItLabel(1, 'tick') }));
    expect(screen.getByText('(loaded)')).toBeInTheDocument();
    await waitFor(() => expect(store.getState().virtualTime).toBe(1 * TICK_MS));
    expect(store.getState().status).not.toBe('playing');
  });

  it('is axe clean', async () => {
    const { container } = render(
      <Harness store={createPlaybackStore(timelineFrom(buildTickRun()))} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('Walkthrough in Guided mode (auto-load, Q1 and Q2)', () => {
  it('loads the part’s example as the part opens, and holds at its checkpoint', () => {
    const store = setup({ autoLoad: true });
    expect(screen.getByText('(loaded)')).toBeInTheDocument();
    expect(screen.queryByText(/The picture shows a different input/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reload this example' }),
    ).toBeInTheDocument();
    expect(card()).toHaveAttribute('data-state', 'asking');
    act(() => store.getState().seek(5 * TICK_MS));
    expect(store.getState().virtualTime).toBe(2 * TICK_MS);
  });

  it('loads once per opening, so the learner’s own change is not undone', () => {
    setup({ autoLoad: true });
    expect(screen.getByTestId('loads')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Edit the input' }));
    expect(screen.queryByText('(loaded)')).toBeNull();
    expect(screen.getByTestId('loads')).toHaveTextContent('1');
    // Opening the part again is the learner acting: it loads again.
    fireEvent.click(screen.getByRole('button', { name: 'Next part' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous part' }));
    expect(screen.getByTestId('loads')).toHaveTextContent('2');
    expect(screen.getByText('(loaded)')).toBeInTheDocument();
  });

  it('brings the picture into view on the first Play only', () => {
    const store = setup({ autoLoad: true });
    const scroll = vi.mocked(window.scrollTo);
    scroll.mockClear();
    act(() => store.getState().play());
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.calls[0]![0]).toMatchObject({ behavior: 'smooth' });
    act(() => {
      store.getState().pause();
      store.getState().seek(0);
      store.getState().play();
    });
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('jumps rather than glides under reduced motion', () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    try {
      const store = setup({ autoLoad: true });
      const scroll = vi.mocked(window.scrollTo);
      scroll.mockClear();
      act(() => store.getState().play());
      expect(scroll.mock.calls[0]![0]).toMatchObject({ behavior: 'auto' });
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});

describe('tryItLabel', () => {
  it('names the moment in the run’s own unit', () => {
    expect(tryItLabel(3, 'tick')).toBe('Go to t = 3');
    expect(tryItLabel(3, 'step')).toBe('Go to step 3');
    expect(tryItLabel('end', 'tick')).toBe('Go to the end');
    expect(tryItLabel('start', 'step')).toBe('Go to the start');
  });
});

describe('checkpointsDone', () => {
  it('counts kept checkpoints, and a completed lesson as all of them', () => {
    const ids = ['a', 'b', 'c'];
    expect(checkpointsDone([], 'lesson.x', ids)).toBe(0);
    expect(checkpointsDone([checkpointKey('lesson.x', 'b')], 'lesson.x', ids)).toBe(1);
    expect(checkpointsDone([checkpointKey('lesson.y', 'b')], 'lesson.x', ids)).toBe(0);
    expect(checkpointsDone(['lesson.x'], 'lesson.x', ids)).toBe(3);
  });
});

describe('findVisual', () => {
  it('prefers a picture the module marked', () => {
    const root = document.createElement('div');
    root.setAttribute('data-workspace', '');
    root.innerHTML =
      '<section id="lesson"></section><p id="next">caption</p><div id="marked" data-lesson-visual></div>';
    document.body.append(root);
    expect(findVisual(document.getElementById('lesson')!)?.id).toBe('marked');
    root.remove();
  });
});

describe('matchExample', () => {
  it('ignores object key order', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }),
    );
    const examples = [{ id: 'x', input: { a: 1, b: 2 } }];
    expect(matchExample(examples, { b: 2, a: 1 })).toBe('x');
    expect(matchExample(examples, { b: 3, a: 1 })).toBeNull();
  });
});
