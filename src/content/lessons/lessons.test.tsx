import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CheckpointSpec, LessonExample } from '@/components/lesson/types';
import * as compareLesson from '@/modules/compare/lesson';
import * as deadlockLesson from '@/modules/deadlock/lesson';
import * as replacementLesson from '@/modules/replacement/lesson';
import * as schedulingLesson from '@/modules/scheduling/lesson';
import * as translationLesson from '@/modules/translation/lesson';

import { LESSONS } from './catalog';

/**
 * The lessons and their checkpoints agree with each other and with the textbooks.
 *
 * Every checkpoint's answer is computed from a core run in the module's `lesson.ts`. The
 * expected answers below are the textbook's (or, for the model's own presets, worked out
 * by hand from the rules), written down independently, so a change to a scheduler that
 * moved an answer would fail here rather than silently change the lesson.
 */

const BY_MODULE: Record<
  string,
  { LESSON_EXAMPLES: readonly LessonExample[]; LESSON_CHECKPOINTS: readonly CheckpointSpec[] }
> = {
  scheduling: schedulingLesson,
  compare: compareLesson,
  translation: translationLesson,
  replacement: replacementLesson,
  deadlock: deadlockLesson,
};

function mdx(module: string): string {
  return readFileSync(join(process.cwd(), 'src/content/lessons', `${module}.mdx`), 'utf8');
}

function ids(source: string, tag: string): string[] {
  return [...source.matchAll(new RegExp(`<${tag}\\s+id="([^"]+)"`, 'g'))].map((m) => m[1]!);
}

describe('lesson catalogue', () => {
  it('has one lesson per module with a lesson.ts, unique ids', () => {
    expect(LESSONS.map((l) => l.module).sort()).toEqual(Object.keys(BY_MODULE).sort());
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  for (const lesson of LESSONS) {
    describe(lesson.id, () => {
      const source = mdx(lesson.module);
      const { LESSON_EXAMPLES, LESSON_CHECKPOINTS } = BY_MODULE[lesson.module]!;
      const exampleIds = new Set(LESSON_EXAMPLES.map((e) => e.id));

      it('has the declared number of parts, numbered 1..n in order', () => {
        const parts = [...source.matchAll(/<LessonStep n=\{(\d+)\}/g)].map((m) =>
          Number(m[1]),
        );
        expect(parts).toEqual(Array.from({ length: lesson.parts }, (_, i) => i + 1));
      });

      it('places every checkpoint exactly once, and only known ones', () => {
        expect(ids(source, 'Checkpoint').sort()).toEqual(
          LESSON_CHECKPOINTS.map((c) => c.id).sort(),
        );
      });

      it('has 2 to 4 checkpoints', () => {
        expect(LESSON_CHECKPOINTS.length).toBeGreaterThanOrEqual(2);
        expect(LESSON_CHECKPOINTS.length).toBeLessThanOrEqual(4);
      });

      it('names only known examples', () => {
        const named = [
          ...source.matchAll(/example="([^"]+)"/g),
          ...source.matchAll(/<Example id="([^"]+)"/g),
        ].map((m) => m[1]!);
        for (const id of named) expect(exampleIds, id).toContain(id);
        for (const c of LESSON_CHECKPOINTS) expect(exampleIds, c.id).toContain(c.example);
      });

      it('gives every checkpoint an answer among its options, a reason and a hold', () => {
        for (const c of LESSON_CHECKPOINTS) {
          expect(c.options.map((o) => o.value), c.id).toContain(c.answer);
          expect(new Set(c.options.map((o) => o.value)).size, c.id).toBe(c.options.length);
          expect(c.options.length, c.id).toBeGreaterThanOrEqual(2);
          expect(c.reason.length, c.id).toBeGreaterThan(10);
          expect(Number.isInteger(c.holdAt) && c.holdAt >= 0, c.id).toBe(true);
        }
      });

      it('ends with a Real systems box with sources', () => {
        if (lesson.module === 'compare') return;
        expect(source).toMatch(/<RealSystems sources=\{\[/);
      });
    });
  }
});

describe('checkpoint answers match the textbooks', () => {
  const answers = (list: readonly CheckpointSpec[]) =>
    Object.fromEntries(list.map((c) => [c.id, c.answer]));

  it('scheduling', () => {
    expect(answers(schedulingLesson.LESSON_CHECKPOINTS)).toEqual({
      // FCFS: P1 finishes at 16 and P2 is first in the queue.
      'convoy-16': 'P2',
      // OSC10 §5.3.2: P1 [0,1) P2 [1,5) P4 [5,10) P1 [10,17) P3 [17,26).
      'srtf-5': 'P4',
      // Aging takes P1 from 9 to 1 by t = 8, so at t = 9 it beats P5 (priority 2).
      'aging-9': 'P1',
      // OSTEP §8.4: the gamer returns from I/O into Q0 and preempts P1 in Q1.
      'mlfq-old-8': 'P2',
    });
  });

  it('compare', () => {
    expect(answers(compareLesson.LESSON_CHECKPOINTS)).toEqual({
      response: '1', // RR q=2
      turnaround: '0', // SJF
      switches: '3', // q = 8
    });
  });

  it('translation', () => {
    expect(answers(translationLesson.LESSON_CHECKPOINTS)).toEqual({
      'paging-pa': '117', // OSTEP §18.1: VA 21 → PA 117
      'array-miss': 'miss', // OSTEP §19.2: VA 112 starts page 7
      'two-level-refs': '3', // PDE, PTE, data
    });
  });

  it('replacement', () => {
    expect(answers(replacementLesson.LESSON_CHECKPOINTS)).toEqual({
      'fifo-evict': '0', // OSTEP Figure 22.2
      'opt-evict': '2', // OSTEP Figure 22.1
      'lru-hit': 'hit', // OSTEP Figure 22.5
      'clock-evict': '1', // hand clears frame 1's bit, frame 2 has use bit 0
    });
  });

  it('deadlock', () => {
    expect(answers(deadlockLesson.LESSON_CHECKPOINTS)).toEqual({
      'two-locks': 'deadlocked',
      'cycle-multi': 'not-deadlocked', // OSC10 Figure 8.6
      'bankers-safe': 'safe', // OSC10 §8.6.3.3
      'bankers-t0': 'refused', // OSC10 §8.6.3.3
    });
  });
});
