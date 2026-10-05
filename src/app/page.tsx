import type { Metadata } from 'next';
import Link from 'next/link';

import { HeroGantt } from '@/components/home/HeroGantt';
import { HowItWorks } from '@/components/home/HowItWorks';
import { LearningOrder } from '@/components/home/LearningOrder';
import { ModuleGrid } from '@/components/home/ModuleGrid';
import { buttonClasses } from '@/components/timeline/ui/Button';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * The home page (docs/UIUX.md §4.1). A Server Component throughout: the only client
 * code on the route is the header's theme toggle. The hero's Gantt chart is computed by
 * the real scheduler at build time and animated with CSS keyframes.
 */
export default function Home() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16"
    >
      <section
        aria-labelledby="hero-title"
        className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]"
      >
        <div>
          <h1 id="hero-title" className="text-hero">
            {SITE_NAME}
          </h1>
          <p className="text-story text-fg mt-4 max-w-xl">
            Step through the algorithms from your OS course, one tick at a time.
          </p>
          <p className="text-fg-secondary measure mt-3">
            Who gets the CPU next, where an address really points, which page gets thrown
            out, and why processes get stuck. Each step shows what changed and the rule
            that decided it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/scheduling" className={buttonClasses()}>
              Start with CPU scheduling
            </Link>
            <Link href="/learn" className={buttonClasses({ variant: 'secondary' })}>
              See all lessons
            </Link>
          </div>
        </div>
        <HeroGantt />
      </section>

      <div aria-hidden="true" className="rule-ticks mt-16" />

      <section aria-labelledby="how-title" className="mt-12">
        <h2 id="how-title" className="text-title font-semibold">
          How it works
        </h2>
        <HowItWorks />
      </section>

      <div aria-hidden="true" className="rule-ticks mt-16" />

      <section aria-labelledby="modules-title" className="mt-12">
        <h2 id="modules-title" className="text-title font-semibold">
          Modules
        </h2>
        <p className="text-fg-secondary measure mt-2">
          Each one covers a chapter of the course, with the textbook&rsquo;s own examples
          as presets.
        </p>
        <ModuleGrid />
      </section>

      <div aria-hidden="true" className="rule-ticks mt-16" />

      <section aria-labelledby="order-title" className="mt-12">
        <h2 id="order-title" className="text-title font-semibold">
          Where to start
        </h2>
        <p className="text-fg-secondary measure mt-2">
          New to operating systems? Take the modules in this order; each one builds on the
          one before.
        </p>
        <LearningOrder />
      </section>

      <p className="text-small text-fg-secondary border-rule mt-16 border-t pt-6">
        These are the textbook algorithms, not a real kernel, so the numbers match your
        textbook and homework rather than what your laptop does.{' '}
        <Link href="/about#disclaimers" className="text-accent underline">
          What that means
        </Link>
      </p>
    </main>
  );
}
