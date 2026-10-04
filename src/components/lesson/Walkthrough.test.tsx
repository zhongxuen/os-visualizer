import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

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
        <Checkpoint id="cp1" />
      </LessonStep>
      <LessonStep n={2} title="Part two">
        <p>Second part.</p>
      </LessonStep>
    </>
  );
}

function Harness({ store }: { store: ReturnType<typeof createPlaybackStore> }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <Walkthrough
      lesson={LESSON}
      Content={Content}
      store={store}
      unit="tick"
      examples={[{ id: 'ex', title: 'The example' }]}
      activeExample={active}
      onLoadExample={setActive}
      checkpoints={CHECKPOINTS}
    />
  );
}

function setup() {
  const store = createPlaybackStore(timelineFrom(buildTickRun()));
  render(<Harness store={store} />);
  return store;
}

beforeEach(() => {
  window.localStorage.removeItem(PROGRESS_KEY);
});

describe('Walkthrough', () => {
  it('shows one part at a time and moves between them', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Part one' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Part two' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next part' }));
    expect(screen.getByRole('heading', { name: 'Part two' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Part 2 of 2');
  });

  it('does not hold the timeline before the lesson is used', () => {
    const store = setup();
    act(() => store.getState().seek(5 * TICK_MS));
    expect(store.getState().virtualTime).toBe(5 * TICK_MS);
  });

  it('holds the timeline at an unanswered checkpoint once the example is loaded', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    expect(screen.getByText('(loaded)')).toBeInTheDocument();

    act(() => {
      store.getState().play();
      store.getState().seek(5 * TICK_MS);
    });
    expect(store.getState().virtualTime).toBe(2 * TICK_MS);
    expect(store.getState().status).not.toBe('playing');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Paused for a checkpoint: Which process runs from t = 3?',
    );

    // Before the hold point nothing is held.
    act(() => store.getState().seek(1 * TICK_MS));
    expect(store.getState().virtualTime).toBe(1 * TICK_MS);
  });

  it('meets a wrong answer with the right one and the core’s reason, then completes', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    const check = screen.getByRole('button', { name: 'Check answer' });
    expect(check).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'P1' }));
    fireEvent.click(check);
    expect(screen.getByText('Not quite. The answer is P2.')).toBeInTheDocument();
    expect(screen.getByText('P2 runs: shortest remaining time.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /P2/ })).toBeDisabled();

    // Answered: the timeline is free again, and the lesson is complete.
    act(() => store.getState().seek(5 * TICK_MS));
    expect(store.getState().virtualTime).toBe(5 * TICK_MS);
    expect(readProgress().completed).toContain('lesson.test');
    expect(screen.getByText(/1 of 1 checkpoints · complete/)).toBeInTheDocument();
  });

  it('“Show this moment” seeks to the checkpoint and starts holding there', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Load this example' }));
    act(() => store.getState().seek(1 * TICK_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Show this moment' }));
    expect(store.getState().virtualTime).toBe(2 * TICK_MS);
  });

  it('is axe clean', async () => {
    const { container } = render(
      <Harness store={createPlaybackStore(timelineFrom(buildTickRun()))} />,
    );
    await expectNoAxeViolations(container);
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
