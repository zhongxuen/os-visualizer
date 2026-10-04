import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';

import { Checkpoint } from './Checkpoint';
import { ExampleBar, LessonStep } from './LessonStep';
import { RealSystems } from './RealSystems';

/**
 * The vocabulary a lesson may use without importing anything (the Internet Visualizer
 * pattern): MDX resolves a capitalised tag against the `components` prop, so this map is
 * what makes `<Checkpoint>` legal in a `.mdx` file. Plain Markdown elements get the
 * product's type styles here too.
 */
export const LESSON_COMPONENTS: MDXComponents = {
  Checkpoint,
  Example: ExampleBar,
  LessonStep,
  RealSystems,
  p: (props: ComponentProps<'p'>) => <p className="leading-relaxed" {...props} />,
  ul: (props: ComponentProps<'ul'>) => (
    <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />
  ),
  ol: (props: ComponentProps<'ol'>) => (
    <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />
  ),
  strong: (props: ComponentProps<'strong'>) => (
    <strong className="text-fg font-semibold" {...props} />
  ),
  code: (props: ComponentProps<'code'>) => (
    <code className="bg-surface-overlay rounded px-1 font-mono text-[0.9em]" {...props} />
  ),
  a: (props: ComponentProps<'a'>) => <a className="text-accent underline" {...props} />,
};
