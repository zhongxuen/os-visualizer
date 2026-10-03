import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What OS Visualizer models, what it leaves out, and how every algorithm is checked: textbook worked examples, property tests and brute-force oracles.',
};

/*
 * Skeleton (phase 03). The disclaimers are the ones in docs/implementation/09 step 3;
 * phase 09 adds the per-module conventions and the source list from docs/ACCURACY.md.
 */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="text-fg-secondary mt-3 space-y-3">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6"
    >
      <h1 className="text-title font-bold tracking-tight">About OS Visualizer</h1>
      <p className="text-fg-secondary text-lead mt-3">
        Operating system algorithms you can step through one tick or one step at a time,
        forwards and backwards, with the reason for every decision shown.
      </p>

      <Section id="disclaimers" title="What this is, and what it is not">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            It models the textbook algorithms, not a real kernel. There are no interrupts,
            no multicore and no real hardware timings. I/O is a fixed wait with no device
            queue, and context switches cost a fixed, configurable number of ticks.
          </li>
          <li>
            Where textbooks disagree on a small rule (tie-breaks, when a preempted process
            re-queues, the Clock hand after a load), one rule is chosen and shown in each
            module&rsquo;s <strong>Rules used</strong> panel. Another book&rsquo;s worked
            example may differ by that rule.
          </li>
          <li>
            MLFQ follows the rules as OSTEP states them. Real schedulers (Linux EEVDF,
            Windows) are described in lessons, not simulated.
          </li>
          <li>
            The TLB is fully associative with no ASIDs, and belongs to one process. Page
            faults stop the translation; loading the page is shown in the Page Replacement
            module.
          </li>
          <li>Banker&rsquo;s algorithm shows one safe sequence; there may be others.</li>
        </ul>
      </Section>

      <Section id="accuracy" title="How accuracy is checked">
        <p>Every algorithm is pure TypeScript with no UI, and is checked three ways.</p>
        <dl className="space-y-3">
          <div>
            <dt className="text-fg font-medium">Worked-example tests</dt>
            <dd>
              The numbers from the textbooks&rsquo; own worked examples, each recorded
              with its book, edition, chapter and section (OSTEP v1.10; Silberschatz,{' '}
              <cite>Operating System Concepts</cite>, 10th edition).
            </dd>
          </div>
          <div>
            <dt className="text-fg font-medium">Property tests</dt>
            <dd>
              Invariants checked over thousands of generated inputs with a fixed seed: for
              example, total runtime equals CPU bursts plus idle ticks plus context-switch
              ticks, and LRU and OPT never fault more with more frames.
            </dd>
          </div>
          <div>
            <dt className="text-fg font-medium">Brute-force oracles</dt>
            <dd>
              Where exhaustive search is feasible it plays the reference implementation:
              the minimum faults on short strings must equal OPT, every ordering is tried
              to confirm Banker&rsquo;s safe sequence, and address translation is redone
              with plain arithmetic.
            </dd>
          </div>
          <div>
            <dt className="text-fg font-medium">Determinism and citations</dt>
            <dd>
              Every preset runs twice and must give identical results, and every step
              cites a source that resolves. The same input always gives the same run,
              which is what makes a shared link reproduce exactly what you saw.
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="conventions" title="Conventions">
        <p>
          Each module lists the rules it uses, including every tie-break, in its Rules
          used panel. They are collected here as the modules are released.
        </p>
      </Section>

      <p className="mt-10">
        <Link href="/" className="text-accent font-medium underline">
          Back to the modules
        </Link>
      </p>
    </main>
  );
}
