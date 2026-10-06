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
    'What OS Visualizer means for your course, what it models and leaves out, how every algorithm is checked (textbook worked examples, property tests and brute-force oracles), sources and credits.',
  alternates: { canonical: '/about' },
};

/*
 * A long read (docs/UIUX.md §4.1, A1): what this means for you first, then the model,
 * how accuracy is checked, sources and credits, with a sticky table of contents on wide
 * screens. `#model` is what the workspace header's "What that means" links to.
 *
 * The conventions are read from each module's `rules.ts`, the same lists the Rules
 * panels show, so this page cannot disagree with them; docs/ACCURACY.md has the same
 * lists with their sources.
 */

interface ConventionRule {
  id: string;
  text: string;
  detail?: string;
  plain?: string;
  whyItMatters?: string;
}

const CONVENTIONS: readonly {
  id: string;
  title: string;
  rules: readonly ConventionRule[];
}[] = [
  { id: 'conventions-sched', title: 'CPU scheduling and Compare', rules: SCHED_RULES },
  { id: 'conventions-vm', title: 'Address translation', rules: VM_RULES },
  { id: 'conventions-repl', title: 'Page replacement', rules: REPL_RULES },
  { id: 'conventions-dl', title: 'Deadlock', rules: DL_RULES },
  { id: 'conventions-sync', title: 'Synchronisation', rules: SYNC_RULES },
];

const TOC: readonly {
  id: string;
  title: string;
  children?: readonly { id: string; title: string }[];
}[] = [
  { id: 'for-you', title: 'What this means for you' },
  {
    id: 'model',
    title: 'The model',
    children: [
      { id: 'left-out', title: 'What is left out' },
      { id: 'conventions', title: 'Conventions' },
    ],
  },
  { id: 'accuracy', title: 'How accuracy is checked' },
  { id: 'sources', title: 'Sources' },
  { id: 'credits', title: 'Credits' },
];

const prose = 'text-fg-secondary measure mt-3 space-y-3';
const inlineLink = 'text-fg underline underline-offset-2';

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
    <section
      aria-labelledby={id}
      className="border-rule mt-12 border-t pt-8 first:mt-0 first:border-t-0 first:pt-0"
    >
      <h2 id={id} className="text-title scroll-mt-24 font-semibold">
        {title}
      </h2>
      <div className={prose}>{children}</div>
    </section>
  );
}

function SubHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-lead text-fg scroll-mt-24 pt-4 font-semibold">
      {children}
    </h3>
  );
}

function Contents({ idPrefix }: { idPrefix: string }) {
  return (
    <nav aria-labelledby={`${idPrefix}-title`} className="text-small">
      <h2
        id={`${idPrefix}-title`}
        className="text-caption text-fg-muted font-medium tracking-wide uppercase"
      >
        On this page
      </h2>
      <ol className="border-rule mt-3 flex flex-col gap-1 border-l">
        {TOC.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-fg-secondary hover:text-fg hover:border-accent focus-visible:outline-focus -ml-px block border-l border-transparent py-1 pl-3 focus-visible:outline-2"
            >
              {item.title}
            </a>
            {item.children ? (
              <ol className="flex flex-col">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <a
                      href={`#${child.id}`}
                      className="text-fg-muted hover:text-fg focus-visible:outline-focus block py-0.5 pl-6 focus-visible:outline-2"
                    >
                      {child.title}
                    </a>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function AboutPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6"
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
        <div className="min-w-0">
          <h1 className="text-title font-bold tracking-tight">About OS Visualizer</h1>
          <p className="text-fg-secondary text-lead measure mt-3">
            Operating system algorithms you can step through one tick or one step at a
            time, forwards and backwards, with the reason for every decision shown.
          </p>

          <div className="border-border bg-surface-raised mt-8 rounded-lg border p-4 lg:hidden">
            <Contents idPrefix="toc-inline" />
          </div>

          <div className="mt-12">
            <Section id="for-you" title="What this means for you">
              <p>
                <strong className="text-fg">
                  The numbers match your textbook, not your laptop.
                </strong>{' '}
                Every Gantt chart, waiting time, page fault and safe sequence here is the
                one you would work out by hand on a homework sheet, using the same rules
                as the course books. That is what makes it useful for checking an answer.
              </p>
              <p>Your laptop does more than the textbook model, for example:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  It has several cores, so several processes really run at once. Here
                  there is one CPU.
                </li>
                <li>
                  Its scheduler is none of FCFS, SJF, Round Robin or MLFQ as written.
                  Linux uses EEVDF and Windows uses priorities with temporary boosts; the
                  lessons describe both.
                </li>
                <li>
                  Interrupts, disks and networks take real, varying time. Here an I/O
                  burst is a fixed number of ticks and a context switch costs a fixed
                  number you choose.
                </li>
                <li>
                  Its page tables have four or five levels, its TLB keeps entries for
                  several processes, and its memory manager approximates LRU rather than
                  running it exactly.
                </li>
              </ul>
              <p>
                <strong className="text-fg">If your book differs by one tick,</strong>{' '}
                open the <strong className="text-fg">Rules used</strong> panel in the
                module. Textbooks disagree on small things such as which of two processes
                that arrive together runs first. Each module picks one rule, says so, and
                explains what would change under the other. The full list is under{' '}
                <a href="#conventions" className={inlineLink}>
                  Conventions
                </a>{' '}
                below.
              </p>
              <p>
                So use it to see how an algorithm decides, to check homework and to build
                intuition, not to predict how fast a real computer will be.
              </p>
            </Section>

            <Section id="model" title="The model">
              <p>
                Each module runs a textbook algorithm on the input you give it, one tick
                or one step at a time. The same input always gives the same run, so a
                shared link reproduces exactly what you saw.
              </p>
              <SubHeading id="left-out">What is left out</SubHeading>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  It models the textbook algorithms, not a real kernel. There are no
                  interrupts, no multicore and no real hardware timings. I/O is a fixed
                  wait with no device queue, and context switches cost a fixed,
                  configurable number of ticks.
                </li>
                <li>
                  Where textbooks disagree on a small rule (tie-breaks, when a preempted
                  process re-queues, the Clock hand after a load), one rule is chosen and
                  shown in each module&rsquo;s <strong>Rules used</strong> panel. Another
                  book&rsquo;s worked example may differ by that rule.
                </li>
                <li>
                  MLFQ follows the rules as OSTEP states them. Real schedulers (Linux
                  EEVDF, Windows) are described in lessons, not simulated.
                </li>
                <li>
                  The TLB is fully associative with no ASIDs, and belongs to one process.
                  Page faults stop the translation; loading the page is shown in the Page
                  Replacement module.
                </li>
                <li>
                  Banker&rsquo;s algorithm shows one safe sequence; there may be others.
                </li>
              </ul>

              <SubHeading id="conventions">Conventions</SubHeading>
              <p>
                Each module lists the rules it uses, including every tie-break, in its
                Rules used panel. Every rule has a test named after it. Here they are in
                one place.
              </p>
              {CONVENTIONS.map((group) => (
                <details
                  key={group.id}
                  id={group.id}
                  className="border-border bg-surface-raised rounded-lg border p-4"
                >
                  <summary className="text-fg cursor-pointer font-medium">
                    {group.title} ({group.rules.length} rules)
                  </summary>
                  <ul className="text-small mt-3 flex flex-col gap-3">
                    {group.rules.map((rule) => (
                      <li key={rule.id} className="border-border border-l-2 pl-3">
                        <span className="text-fg block">{rule.plain ?? rule.text}</span>
                        {rule.plain ? (
                          <span className="text-fg-secondary block">
                            Formally: {rule.text}
                          </span>
                        ) : null}
                        {rule.detail ? (
                          <span className="text-fg-muted block">{rule.detail}</span>
                        ) : null}
                        {rule.whyItMatters ? (
                          <span className="text-fg-muted block">
                            Why it matters: {rule.whyItMatters}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </Section>

            <Section id="accuracy" title="How accuracy is checked">
              <p>
                Every algorithm is pure TypeScript with no UI, and is checked three ways.
              </p>
              <dl className="space-y-3">
                <div>
                  <dt className="text-fg font-medium">Worked-example tests</dt>
                  <dd>
                    The numbers from the textbooks&rsquo; own worked examples, each
                    recorded with its book, edition, chapter and section (OSTEP v1.10;
                    Silberschatz, <cite>Operating System Concepts</cite>, 10th edition).
                  </dd>
                </div>
                <div>
                  <dt className="text-fg font-medium">Property tests</dt>
                  <dd>
                    Invariants checked over thousands of generated inputs with a fixed
                    seed: for example, total runtime equals CPU bursts plus idle ticks
                    plus context-switch ticks, and LRU and OPT never fault more with more
                    frames.
                  </dd>
                </div>
                <div>
                  <dt className="text-fg font-medium">Brute-force oracles</dt>
                  <dd>
                    Where exhaustive search is feasible it plays the reference
                    implementation: the minimum faults on short strings must equal OPT,
                    every ordering is tried to confirm Banker&rsquo;s safe sequence, and
                    address translation is redone with plain arithmetic.
                  </dd>
                </div>
                <div>
                  <dt className="text-fg font-medium">Determinism and citations</dt>
                  <dd>
                    Every preset runs twice and must give identical results, and every
                    step cites a source that resolves. The same input always gives the
                    same run, which is what makes a shared link reproduce exactly what you
                    saw.
                  </dd>
                </div>
              </dl>
              <p>
                The lessons&rsquo; checkpoints are computed the same way: each answer and
                its reason are read off a run of the real algorithm, never typed in by
                hand.
              </p>
            </Section>

            <Section id="sources" title="Sources">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau,{' '}
                  <cite>Operating Systems: Three Easy Pieces</cite>, version 1.10 (OSTEP).
                  The chapters are free at{' '}
                  <a
                    href="https://pages.cs.wisc.edu/~remzi/OSTEP/"
                    className={inlineLink}
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
                  className={inlineLink}
                >
                  docs/ACCURACY.md
                </a>
                .
              </p>
            </Section>

            <Section id="credits" title="Credits">
              <p>
                OS Visualizer is the third project in the Visualizer Series, after{' '}
                <a
                  href="https://github.com/zhongxuen/internet-visualizer"
                  className={inlineLink}
                >
                  Internet Visualizer
                </a>{' '}
                and{' '}
                <a
                  href="https://github.com/zhongxuen/crypto-visualizer"
                  className={inlineLink}
                >
                  Crypto Visualizer
                </a>
                , and shares their timeline and their way of checking every algorithm. The
                source is{' '}
                <a
                  href="https://github.com/zhongxuen/os-visualizer"
                  className={inlineLink}
                >
                  on GitHub
                </a>
                .
              </p>
              <p>
                The worked examples, and most of the presets, come from the two books
                under Sources. Their authors&rsquo; examples are what make a run
                checkable.
              </p>
              <p>
                Built with Next.js, React, Tailwind CSS, MDX, Zustand and Zod. The
                deadlock graph uses React Flow, the reordering animations use Motion, the
                icons are Lucide and the type is Geist.
              </p>
            </Section>
          </div>

          <p className="mt-12">
            <Link href="/" className="text-accent font-medium underline">
              Back to the modules
            </Link>
          </p>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Contents idPrefix="toc" />
          </div>
        </aside>
      </div>
    </main>
  );
}
