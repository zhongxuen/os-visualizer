'use client';

import { createContext, useContext } from 'react';

import type { RunUnit } from '@/core/events/builder';

import type { PlaybackStore } from '../timeline/hooks/usePlayback';
import type { CheckpointSpec, LessonExample } from './types';

/**
 * What the lesson components inside an MDX walkthrough read: the module's playback store,
 * its examples and checkpoints, and the walkthrough's own progress. Provided by
 * `Walkthrough`; MDX content is handed no props, so this is how `<Checkpoint id>` finds
 * its question.
 */
export interface LessonContextValue {
  store: PlaybackStore;
  unit: RunUnit;
  /** 1-based part on screen. */
  part: number;
  parts: number;
  examples: readonly LessonExample[];
  /** The example the module's input matches, or `null` after an edit. */
  activeExample: string | null;
  loadExample(id: string): void;
  /** Start holding the timeline at checkpoints (loading an example does this too). */
  engage(): void;
  checkpoints: readonly CheckpointSpec[];
  /** The option chosen for each checkpoint answered in this visit. */
  answers: Readonly<Record<string, string>>;
  answer(id: string, value: string): void;
  /** Answered in this visit or an earlier one (kept in `osv:v1`). */
  isDone(id: string): boolean;
  /** A checkpoint on screen tells the walkthrough, so only those hold the timeline. */
  mount(id: string): () => void;
  /** The checkpoint the timeline is being held for, if any. */
  pending: string | null;
  /** Scroll the module's picture into view (see `reveal.ts`). */
  reveal(): void;
  /**
   * A part came on screen: load its example if the walkthrough may (Q1). Called by
   * `LessonStep`; once per opening of a part.
   */
  openPart(n: number, example: string | undefined): void;
}

export const LessonContext = createContext<LessonContextValue | null>(null);

export function useLesson(): LessonContextValue {
  const value = useContext(LessonContext);
  if (!value) throw new Error('Lesson components must be rendered inside <Walkthrough>');
  return value;
}
