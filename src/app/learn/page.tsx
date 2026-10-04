import type { Metadata } from 'next';

import { LessonList } from './LessonList';

export const metadata: Metadata = {
  title: 'Learn',
  description:
    'Guided walkthroughs for every module: short explanations, a worked example to step through, and checkpoints that ask you to predict the next step.',
  alternates: { canonical: '/learn' },
};

export default function LearnPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6"
    >
      <h1 className="text-title font-bold tracking-tight">Learn</h1>
      <p className="text-fg-secondary text-lead mt-3">
        Each lesson runs inside its module, in Walkthrough mode. It loads an example,
        explains it a part at a time, and stops at checkpoints that ask you to predict the
        next step. Every answer comes from the same algorithm the module runs.
      </p>
      <LessonList />
    </main>
  );
}
