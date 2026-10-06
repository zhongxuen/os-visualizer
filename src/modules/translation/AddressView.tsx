'use client';

import { BitField, inBase, type NumberBase } from '@/components/blocks/BitField';
import { Term } from '@/components/glossary';
import { DURATION } from '@/components/motion';
import type { Geometry } from '@/core/vm/config';
import type { VmEvent } from '@/core/vm/events';

import { paParts, vaHighlight, vaParts } from './adapters';
import { EASING, useStepMotion } from './useStepMotion';

/**
 * The address panel (docs/UIUX.md T1, §7.2.3): the virtual address split into its
 * fields, one number base at a time, the split explained with derived numbers, and the
 * physical address once it is formed.
 *
 * Motion, forward steps only: on the split the fields move apart from one block into
 * their places; when the physical address is formed, the PFN and the offset slide
 * together into it. Both end on the resting layout, which shows the same thing.
 */

export interface AddressViewProps {
  event: VmEvent | undefined;
  g: Geometry;
  base: NumberBase;
  position: number;
}

/** The split in words (T1). Its text is `splitExplainer(g)`, with glossary terms. */
export function SplitExplainer({ g }: { g: Geometry }) {
  return (
    <p className="text-small text-fg-secondary" data-testid="split-explainer">
      {g.pageSize}-byte <Term id="page">pages</Term> → {g.offsetBits}{' '}
      <Term id="offset">offset</Term> bits; {g.vaBits}-bit address − {g.offsetBits} ={' '}
      {g.vpnBits} <Term id="vpn">VPN</Term> bits → {g.pages} pages.
      {g.levels === 2 ? (
        <>
          {' '}
          Two levels: {g.ptesPerPage} four-byte entries fill a page → {g.ptIndexBits}{' '}
          table-index bits; the other {g.pdIndexBits} VPN bits index the directory.
        </>
      ) : null}
    </p>
  );
}

/**
 * Slide each part from `from(i, mid)` to its resting place. The split starts from the
 * fields closed up into one block; the physical address from its two parts held apart.
 */
function slideIn(
  parts: HTMLElement[],
  duration: number,
  from: (i: number, mid: number) => Keyframe,
): Animation[] {
  const mid = (parts.length - 1) / 2;
  return parts.map((part, i) =>
    part.animate([from(i, mid), { transform: 'none', opacity: 1 }], {
      duration,
      easing: EASING,
    }),
  );
}

const closedUp = (i: number, mid: number): Keyframe => ({
  transform: `translateX(${(mid - i) * 0.5}rem)`,
  opacity: 1,
});
const heldApart = (i: number, mid: number): Keyframe => ({
  transform: `translateX(${(i - mid) * 1.5}rem)`,
  opacity: 0.4,
});

export function AddressView({ event, g, base, position }: AddressViewProps) {
  const split = event?.kind === 'vm.split' ? position : null;
  const vaRef = useStepMotion<HTMLDivElement>(
    split,
    (root, duration) =>
      split === null
        ? null
        : slideIn(
            [...root.querySelectorAll<HTMLElement>('[data-field]')],
            duration,
            closedUp,
          ),
    DURATION.enter,
  );
  const formed = event?.kind === 'vm.physical' ? position : null;
  const paRef = useStepMotion<HTMLDivElement>(
    formed,
    (root, duration) =>
      formed === null
        ? null
        : slideIn(
            [...root.querySelectorAll<HTMLElement>('[data-part]')],
            duration,
            heldApart,
          ),
    DURATION.enter,
  );

  if (!event) return null;
  const pa = event.pa;
  const offset = event.state.fields.offset;
  return (
    <div className="flex flex-col gap-3">
      <SplitExplainer g={g} />
      <div ref={vaRef}>
        <BitField
          label="Virtual address"
          value={event.va}
          fields={vaParts(g)}
          highlight={vaHighlight(event, g)}
          base={base}
          tinted
        />
      </div>
      {pa !== undefined && event.pfn !== undefined ? (
        <div className="flex flex-col gap-2">
          <div
            ref={paRef}
            className="text-small flex flex-wrap items-center gap-2"
            data-testid="pa-readout"
          >
            <span data-part="pfn" className="border-border rounded-md border px-2 py-1">
              <Term id="pfn">PFN</Term>{' '}
              <span className="font-mono">{inBase(event.pfn, g.pfnBits, base)}</span>
            </span>
            <span
              data-part="offset"
              className="border-border rounded-md border px-2 py-1"
            >
              offset{' '}
              <span className="font-mono">{inBase(offset, g.offsetBits, base)}</span>
            </span>
            <span aria-hidden="true">→</span>
            <span className="sr-only">make</span>
            <span className="border-accent rounded-md border-2 px-2 py-1 font-semibold">
              <Term id="physical-address">physical address</Term>{' '}
              <span className="font-mono">{inBase(pa, g.paBits, base)}</span>
            </span>
          </div>
          <BitField
            label="Physical address"
            value={pa}
            fields={paParts(g)}
            highlight={event.kind === 'vm.physical' ? 'pfn' : undefined}
            base={base}
            tinted
          />
        </div>
      ) : (
        <p className="text-small text-fg-muted">
          The physical address is formed at step 6, once the translation is known.
        </p>
      )}
    </div>
  );
}
