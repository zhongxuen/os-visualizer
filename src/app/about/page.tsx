import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { DL_RULES } from '@/core/deadlock/rules';
import { REPL_RULES } from '@/core/replace/rules';
import { SCHED_RULES } from '@/core/sched/rules';
import { SYNC_RULES } from '@/core/sync/rules';
import { VM_RULES } from '@/core/vm/rules';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What OS Visualizer models, what it leaves out, and how every algorithm is checked: textbook worked examples, property tests and brute-force oracles.',
  alternates: { canonical: '/about' },
};

/*
 * The disclaimers are the ones in docs/implementation/09 step 3. The conventions are
 * read from each module's `rules.ts`, the same lists the Rules panels show, so this page
 * cannot disagree with them; docs/ACCURACY.md has the same lists with their sources.
 */

const CONVENTIONS: readonly {
  id: string;
  title: string;
  rules: readonly { id: string; text: string; detail?: string }[];
}[] = [
  { id: 'conventions-sched', title: 'CPU scheduling and Compare', rules: SCHED_RULES },
  { id: 'conventions-vm', title: 'Address translation', rules: VM_RULES },
  { id: 'conventions-repl', title: 'Page replacement', rules: REPL_RULES },
  { id: 'conventions-dl', title: 'Deadlock', rules: DL_RULES },
  { id: 'conventions-sync', title: 'Synchronisation', rules: SYNC_RULES },
];

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
          used panel. Every rule has a test named after it. Here they are in one place.
        </p>
        {CONVENTIONS.map((group) => (
          <details key={group.id} className="border-border rounded-lg border p-4">
            <summary className="text-fg cursor-pointer font-medium">
              {group.title} ({group.rules.length} rules)
            </summary>
            <ul className="text-small mt-3 list-disc space-y-2 pl-5">
              {group.rules.map((rule) => (
                <li key={rule.id}>
                  {rule.text}
                  {rule.detail ? (
                    <span className="text-fg-muted block">{rule.detail}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </Section>

      <Section id="sources" title="Sources">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau,{' '}
            <cite>Operating Systems: Three Easy Pieces</cite>, version 1.10 (OSTEP). The
            chapters are free at{' '}
            <a
              href="https://pages.cs.wisc.edu/~remzi/OSTEP/"
              className="text-accent underline"
            >
              pages.cs.wisc.edu/~remzi/OSTEP
            </a>
            .
          </li>
          <li>
            Abraham Silberschatz, Peter B. Galvin and Greg Gagne,{' '}
            <cite>Operating System Concepts</cite>, 10th edition (OSC10).
          </li>
        </ul>
        <p>
          Every step in every module names its chapter and section. The full list of
          citations, conventions and known simplifications is in{' '}
          <a
            href="https://github.com/zhongxuen/os-visualizer/blob/main/docs/ACCURACY.md"
            className="text-accent underline"
          >
            docs/ACCURACY.md
          </a>
          .
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
