'use client';

import { Walkthrough, type WalkthroughProps } from '@/components/lesson/Walkthrough';
import TranslationLesson from '@/content/lessons/translation.mdx';

/**
 * Guided mode's lesson text. Loaded on the client as its own chunk (`next/dynamic` in
 * TranslationView), so the lesson's prose stays out of the route's first-load JS: it is
 * only needed in Guided mode, after hydration has settled which mode the visitor is in.
 */
export default function GuidedLesson(props: Omit<WalkthroughProps, 'Content'>) {
  return <Walkthrough {...props} Content={TranslationLesson} />;
}
