'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { FrameStrip } from '@/components/blocks/FrameStrip';
import { Button } from '@/components/timeline/ui/Button';
import { LIMITS, POLICIES, POLICY_NAMES, type Policy } from '@/core/replace/input';
import { replace, totals } from '@/core/replace/replace';

import { finalColumns } from './adapters';
import { INPUT, SelectField } from './fields';

/**
 * Two runs of one policy side by side, N frames and N + 1, on one cursor: step through
 * the references and both frame strips fill in together. With FIFO on the Belady string,
 * 3 frames fault 9 times and 4 frames 10. Switch to LRU to see that it cannot happen
 * there.
 *
 * The cursor has its own buttons and slider rather than a second playback store, so the
 * page's playback shortcuts keep driving the main run.
 */

export interface BeladyPanelProps {
  refString: readonly number[];
  /** The smaller frame count to start from (the larger is one more). */
  frames: number;
  policy?: Policy;
}

export function BeladyPanel({
  refString,
  frames,
  policy: initial = 'fifo',
}: BeladyPanelProps) {
  const [policy, setPolicy] = useState<Policy>(initial);
  const [small, setSmall] = useState(Math.min(Math.max(frames, 1), LIMITS.maxFrames - 1));
  const [cursor, setCursor] = useState(0);
  const sliderId = useId();
  const large = small + 1;
  const last = refString.length - 1;

  const runs = useMemo(
    () =>
      [small, large].map((n) => {
        const run = replace(refString, n, policy);
        return { frames: n, columns: finalColumns(run, refString), total: totals(run) };
      }),
    [refString, small, large, policy],
  );
  const [a, b] = runs as [(typeof runs)[0], (typeof runs)[0]];

  const faultsAt = (columns: typeof a.columns) =>
    columns.slice(0, cursor + 1).filter((c) => c.fault).length;
  const atEnd = cursor === last;
  const anomaly = b.total.faults > a.total.faults;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Policy to compare"
          value={policy}
          options={POLICIES.map((p) => ({ value: p, label: POLICY_NAMES[p] }))}
          onChange={setPolicy}
        />
        <SelectField
          label="Frame counts"
          value={String(small)}
          options={Array.from({ length: LIMITS.maxFrames - 1 }, (_, i) => ({
            value: String(i + 1),
            label: `${i + 1} vs ${i + 2}`,
          }))}
          onChange={(n) => setSmall(Number(n))}
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Belady cursor"
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCursor(0)}
          disabled={cursor === 0}
        >
          <ChevronsLeft aria-hidden="true" className="size-4" />
          First
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCursor((c) => Math.max(0, c - 1))}
          disabled={cursor === 0}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCursor((c) => Math.min(last, c + 1))}
          disabled={atEnd}
        >
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCursor(last)}
          disabled={atEnd}
        >
          Last
          <ChevronsRight aria-hidden="true" className="size-4" />
        </Button>
        <label htmlFor={sliderId} className="text-caption text-fg-muted ml-2">
          Reference
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={last}
          value={cursor}
          aria-valuetext={`Reference ${cursor + 1} of ${refString.length}`}
          onChange={(e) => setCursor(Number(e.target.value))}
          className={`${INPUT} min-w-32 flex-1 px-0`}
        />
        <span className="text-small font-mono" aria-hidden="true">
          {cursor + 1} / {refString.length}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[a, b].map((r, i) => (
          <div key={r.frames} className="flex min-w-0 flex-col gap-1">
            <h3 className="text-small font-semibold">
              {POLICY_NAMES[policy]}, {r.frames} frames:{' '}
              <span data-testid={i === 0 ? 'belady-faults-small' : 'belady-faults-large'}>
                {faultsAt(r.columns)}
              </span>{' '}
              faults so far
            </h3>
            <FrameStrip
              columns={r.columns}
              step={cursor}
              mode={policy === 'clock' ? 'clock' : 'plain'}
              caption={`${POLICY_NAMES[policy]} with ${r.frames} frames`}
            />
          </div>
        ))}
      </div>

      <p
        role="status"
        className={
          atEnd && anomaly
            ? 'text-small border-state-warn rounded-md border-l-4 py-1 pl-3'
            : 'text-small'
        }
      >
        {atEnd
          ? anomaly
            ? `Belady’s anomaly: with ${b.frames} frames ${POLICY_NAMES[policy]} faults ${b.total.faults} times, more than the ${a.total.faults} it takes with ${a.frames}. More memory, more faults.`
            : `No anomaly: ${b.frames} frames fault ${b.total.faults} times, ${a.frames} frames ${a.total.faults}. ${policy === 'lru' || policy === 'opt' ? `${POLICY_NAMES[policy]} is a stack algorithm, so a frame more can never hurt.` : 'Try the Belady preset with FIFO.'}`
          : 'Step to the last reference to compare the totals.'}
      </p>
    </div>
  );
}
