import type { LessonMeta } from '@/components/lesson/types';

/**
 * Every walkthrough, in course order. `/learn` lists them with completion; each module's
 * Walkthrough mode renders its own. `parts` is the number of `<LessonStep>`s in the MDX,
 * which the lesson tests check.
 */
export const LESSONS: readonly LessonMeta[] = [
  {
    id: 'lesson.scheduling',
    module: 'scheduling',
    route: '/scheduling',
    title: 'CPU scheduling',
    summary:
      'FCFS and the convoy effect, SJF and SRTF, Round Robin and response time, priority with starvation and aging, and MLFQ’s rules.',
    parts: 5,
  },
  {
    id: 'lesson.compare',
    module: 'compare',
    route: '/compare',
    title: 'Comparing schedulers',
    summary:
      'Turnaround against response time, the quantum trade-off, and why no policy wins every metric.',
    parts: 3,
  },
  {
    id: 'lesson.translation',
    module: 'translation',
    route: '/translation',
    title: 'Address translation',
    summary:
      'Split an address into page number and offset, hit and miss in the TLB, locality in an array walk, and why page tables have two levels.',
    parts: 4,
  },
  {
    id: 'lesson.replacement',
    module: 'replacement',
    route: '/replacement',
    title: 'Page replacement',
    summary:
      'FIFO, OPT as the best possible, LRU, Clock as a cheap LRU, and Belady’s anomaly.',
    parts: 5,
  },
  {
    id: 'lesson.deadlock',
    module: 'deadlock',
    route: '/deadlock',
    title: 'Deadlock',
    summary:
      'The four conditions, cycles in the graph, multi-instance resources, Banker’s algorithm, and recovery.',
    parts: 5,
  },
  {
    id: 'lesson.sync',
    module: 'sync',
    route: '/sync',
    title: 'Synchronisation',
    summary:
      'A race on a shared counter, counting every interleaving, a test-and-set mutex, locks gone wrong, and producer/consumer with semaphores.',
    parts: 5,
  },
];

export function lessonFor(module: string): LessonMeta {
  const lesson = LESSONS.find((l) => l.module === module);
  if (!lesson) throw new Error(`No lesson for module "${module}"`);
  return lesson;
}
