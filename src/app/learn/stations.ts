import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CheckpointSpec } from '@/components/lesson/types';
import { LEARNING_ORDER } from '@/components/home/moduleMeta';
import { LESSONS } from '@/content/lessons/catalog';
import { LESSON_CHECKPOINTS as COMPARE } from '@/modules/compare/lesson';
import { LESSON_CHECKPOINTS as DEADLOCK } from '@/modules/deadlock/lesson';
import { moduleBySlug } from '@/modules/registry';
import { LESSON_CHECKPOINTS as REPLACEMENT } from '@/modules/replacement/lesson';
import { LESSON_CHECKPOINTS as SCHEDULING } from '@/modules/scheduling/lesson';
import { LESSON_CHECKPOINTS as SYNC } from '@/modules/sync/lesson';
import { LESSON_CHECKPOINTS as TRANSLATION } from '@/modules/translation/lesson';

/**
 * The stations on `/learn`, worked out at build time: each lesson in course order, with
 * its checkpoint ids (from the module's `lesson.ts`, which runs the core) and a reading
 * time from the MDX. Only plain data crosses to the client.
 */

const CHECKPOINTS: Record<string, readonly CheckpointSpec[]> = {
  scheduling: SCHEDULING,
  compare: COMPARE,
  translation: TRANSLATION,
  replacement: REPLACEMENT,
  deadlock: DEADLOCK,
  sync: SYNC,
};

/** Why each station comes where it does; the home page's learning order, plus Sync. */
const WHY: Record<string, string> = {
  ...Object.fromEntries(LEARNING_ORDER.map((o) => [o.slug, o.why])),
  sync: 'After that: two threads race on shared data, and a lock puts it right.',
};

/** Words a minute for the reading-time estimate: slow, because there is a picture too. */
const WORDS_PER_MINUTE = 160;

export interface Station {
  lessonId: string;
  slug: string;
  route: string;
  /** The module's title, as the header and home page name it. */
  title: string;
  why: string;
  summary: string;
  parts: number;
  minutes: number;
  checkpointIds: readonly string[];
  /** In the suggested order (1–5), or after it (Sync). */
  core: boolean;
}

function readingMinutes(slug: string): number {
  try {
    const source = readFileSync(
      join(process.cwd(), 'src/content/lessons', `${slug}.mdx`),
      'utf8',
    );
    const prose = source
      .replace(/<RealSystems[\s\S]*?\]\}>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[*`#]/g, ' ');
    const words = prose.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  } catch {
    return 0;
  }
}

export function learnStations(): Station[] {
  const order = new Set(LEARNING_ORDER.map((o) => o.slug));
  return LESSONS.map((lesson) => {
    const entry = moduleBySlug(lesson.module);
    return {
      lessonId: lesson.id,
      slug: lesson.module,
      route: lesson.route,
      title: entry.title,
      why: WHY[lesson.module] ?? entry.blurb,
      summary: lesson.summary,
      parts: lesson.parts,
      minutes: readingMinutes(lesson.module),
      checkpointIds: (CHECKPOINTS[lesson.module] ?? []).map((c) => c.id),
      core: order.has(lesson.module),
    };
  });
}
