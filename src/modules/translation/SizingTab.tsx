'use client';

import { useLayoutEffect, useRef } from 'react';

import { Term } from '@/components/glossary';
import { DURATION, useReducedMotionSafe } from '@/components/motion';
import { PTE_BYTES, type Geometry } from '@/core/vm/config';
import { pageTableSizes, type SizingInput } from '@/core/vm/sizing';

import { formatBytes, SizingPanel, type SizingPanelProps } from './SizingPanel';
import { EASING } from './useStepMotion';

/**
 * "Why two levels?" (docs/UIUX.md T4): the page-table size calculator on its own tab,
 * opened by a sentence that ties it to the walk the student just stepped through, with
 * the linear and two-level sizes drawn as bars. The bars grow to their values when the
 * tab is shown (§7.2.3), instantly under reduced motion, and the saving is labelled.
 */

export interface SizingTabProps extends SizingPanelProps {
  g: Geometry;
  /** Pages the simulated page table maps. */
  mapped: number;
  /** The tab is on screen: the bars grow when it opens. */
  shown: boolean;
}

/** The two bars' lengths, as fractions of the longer one. */
export function barScale(sizing: SizingInput): { linear: number; twoLevel: number } {
  const r = pageTableSizes(sizing);
  const most = Math.max(r.linearBytes, r.twoLevelBytes, 1);
  return { linear: r.linearBytes / most, twoLevel: r.twoLevelBytes / most };
}

function SizeBars({ sizing, shown }: { sizing: SizingInput; shown: boolean }) {
  const r = pageTableSizes(sizing);
  const scale = barScale(sizing);
  const ref = useRef<HTMLDivElement>(null);
  const { scale: motion } = useReducedMotionSafe();

  useLayoutEffect(() => {
    const root = ref.current;
    const duration = motion(DURATION.enter);
    if (!shown || !root || duration <= 0) return;
    const bars = [...root.querySelectorAll<HTMLElement>('[data-bar]')];
    if (bars.some((bar) => typeof bar.animate !== 'function')) return;
    const animations = bars.map((bar) =>
      bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
        duration,
        easing: EASING,
      }),
    );
    return () => animations.forEach((a) => a.cancel());
  }, [shown, motion]);

  const rows = [
    { id: 'linear', label: 'Linear table', bytes: r.linearBytes, scale: scale.linear },
    {
      id: 'two-level',
      label: 'Two-level table',
      bytes: r.twoLevelBytes,
      scale: scale.twoLevel,
    },
  ];
  return (
    <figure ref={ref} className="flex flex-col gap-2">
      <figcaption className="text-small font-semibold">
        Page-table size for this address space
      </figcaption>
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[8rem_1fr] items-center gap-2">
          <span className="text-caption text-fg-muted">{row.label}</span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="bg-surface-overlay block h-3 w-full overflow-hidden rounded-sm">
              <span
                aria-hidden="true"
                data-bar={row.id}
                className="bg-accent block h-full origin-left rounded-sm"
                style={{ width: `${Math.max(row.scale * 100, 0.5)}%` }}
              />
            </span>
            <span className="text-caption font-mono">{formatBytes(row.bytes)}</span>
          </span>
        </div>
      ))}
      <p className="text-small" data-testid="sizing-saving-label">
        {r.savingBytes > 0
          ? `Two levels save ${formatBytes(r.savingBytes)}.`
          : r.savingBytes === 0
            ? 'Here the two cost the same.'
            : `Here two levels cost ${formatBytes(-r.savingBytes)} more: the address space is too full to gain.`}
      </p>
    </figure>
  );
}

export function SizingTab({ g, mapped, shown, ...panel }: SizingTabProps) {
  const linearBytes = g.pages * PTE_BYTES;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-fg-secondary max-w-prose" data-testid="sizing-intro">
        The walk you just stepped through reads a{' '}
        {g.levels === 2 ? 'two-level' : 'linear'} page table. For this {g.vaBits}-bit
        address space a linear table needs {g.pages}{' '}
        <Term id="pte">page-table entries</Term> × 4 bytes ={' '}
        {linearBytes.toLocaleString('en-US')} bytes, even though only {mapped}{' '}
        {mapped === 1 ? 'page is' : 'pages are'} mapped. Two levels keep only the pages of
        page table that are in use, and pay for it with one more memory reference on every
        TLB miss. Try a 32-bit address space below to see why real systems use them.
      </p>
      <SizeBars sizing={panel.sizing} shown={shown} />
      <SizingPanel {...panel} />
    </div>
  );
}
