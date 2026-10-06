'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import { Flash } from '@/components/motion/Flash';
import { DURATION } from '@/components/motion/tokens';
import { useStepTransition } from '@/components/motion/useStepTransition';
import { cn } from '@/lib/cn';

/**
 * The page-replacement grid: one column per reference, one row per frame, and a hit or
 * fault row underneath. It is tabular data, so it is drawn as a real `<table>` and needs
 * no separate table view.
 *
 * In each column the loaded cell is marked "in" and the evicted page "out", in text as
 * well as with the border. Columns after `step` are left blank, so the grid fills in as
 * the run plays. In Clock mode each cell also shows its use bit, and the frame the hand
 * points at is marked with an arrow and the word "hand".
 *
 * Optional extras (U3.4, docs/UIUX.md §7.2.4 and R4), all off by default, so a caller
 * that passes none of them gets the grid above unchanged:
 *
 * - `animate`: step motion through `useStepTransition` (§6.1). A new column slides in
 *   from the right; a hit's cell pulses; a leaving page drops out and a loaded page
 *   drops in. Only a forward step moves; everything else lands at once. Every movement
 *   ends on a static mark ("H", "in", "out", the ring), so a paused frame says the same.
 * - `fit`: for long strings on a phone. Narrower columns, row labels that stay put while
 *   the strip scrolls, and the current column kept in view.
 * - `refMarks`: past references marked H or F under the page number.
 * - Per column: `hitFrame` (marked H), `victim` (a ring and the reason, "loaded first"),
 *   `leaving` (the page on its way out), `notes` (a label under each frame, such as
 *   OPT's "next in 4").
 */

export interface FrameColumn {
  /** The page referenced. */
  ref: number;
  /** Frame contents after the reference: `null` is an empty frame. */
  frames: readonly (number | null)[];
  fault: boolean;
  /** Frame the referenced page was loaded into, on a fault. */
  loaded?: number;
  /** The page evicted to make room, if any. */
  evicted?: number;
  /** Clock: the use bit per frame after the reference. */
  useBits?: readonly (0 | 1)[];
  /** Clock: the frame the hand points at after the reference. */
  hand?: number;
  /** On a hit: the frame that held the page, marked "H". */
  hitFrame?: number;
  /** The frame chosen to empty, ringed, with the reason ("loaded first"). */
  victim?: { frame: number; reason: string };
  /** A page leaving its frame on this step: it drops out of that cell. */
  leaving?: { frame: number; page: number };
  /** A short label under each frame's cell (`null` for none), e.g. "next in 4". */
  notes?: readonly (string | null)[];
}

export interface FrameStripProps {
  columns: readonly FrameColumn[];
  /** Index of the current column; later columns are blank. */
  step: number;
  /** Draw use bits and the hand. */
  mode?: 'plain' | 'clock';
  caption?: string;
  className?: string;
  /** Step motion: columns slide in, hits pulse, pages drop out and in. Default off. */
  animate?: boolean;
  /** Narrow columns on phones, sticky row labels, current column kept in view. */
  fit?: boolean;
  /** Mark past references H (hit) or F (fault) in the reference row. */
  refMarks?: boolean;
}

export function faultCount(columns: readonly FrameColumn[], step: number): number {
  return columns.slice(0, step + 1).filter((column) => column.fault).length;
}

/** A transition of `ms` (0 = none) on the given properties, for `@starting-style`. */
function moveStyle(ms: number, properties = 'translate, opacity'): CSSProperties {
  return {
    transitionProperty: properties,
    transitionDuration: `${ms}ms`,
    transitionTimingFunction: 'var(--ease-out)',
  };
}

/** Keep the current column in view inside the strip's own scroller. */
function useFollowStep(enabled: boolean, step: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = ref.current;
    if (!enabled || !scroller) return;
    const cell = scroller.querySelector<HTMLElement>('th[aria-current="step"]');
    if (!cell) return;
    const label = scroller.querySelector<HTMLElement>('thead th[scope="row"]');
    const labelWidth = label?.offsetWidth ?? 0;
    const left = cell.offsetLeft - labelWidth;
    const right = cell.offsetLeft + cell.offsetWidth;
    if (left < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left);
    else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = right - scroller.clientWidth;
    }
  }, [enabled, step]);
  return ref;
}

export function FrameStrip({
  columns,
  step,
  mode = 'plain',
  caption = 'Frames after each reference',
  className,
  animate = false,
  fit = false,
  refMarks = false,
}: FrameStripProps) {
  const frameCount = columns.reduce(
    (max, column) => Math.max(max, column.frames.length),
    0,
  );
  const faults = faultCount(columns, step);
  const reached = Math.min(step, columns.length - 1) + 1;
  const hits = reached - faults;
  const clock = mode === 'clock';
  const transition = useStepTransition();
  const moving = animate && transition.animate;
  const enter = moving ? transition.scale(DURATION.enter) : 0;
  const move = moving ? transition.scale(DURATION.move) : 0;
  const scroller = useFollowStep(fit, step);

  /** A row label: sticky on the left edge in `fit` mode. */
  const rowLabel = cn(
    'text-fg-muted px-2 py-1 text-left font-sans',
    fit && 'bg-surface-raised sticky left-0 z-10',
  );
  const cellPad = fit ? 'px-1 sm:px-2' : 'px-2';

  /** A cell's content; with `animate`, it slides in as its column first appears. */
  const cellBody = (i: number, content: ReactNode) =>
    animate ? (
      <span
        className="flex flex-col items-center leading-tight starting:translate-x-3 starting:opacity-0"
        style={moveStyle(i === step ? enter : 0)}
      >
        {content}
      </span>
    ) : (
      <span className="flex flex-col items-center leading-tight">{content}</span>
    );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={scroller}
        tabIndex={0}
        role="group"
        aria-label={`${caption}, scrollable`}
        className={cn(
          'border-border bg-surface-raised overflow-x-auto rounded-lg border',
          // The scroller holds its own absolute children (the sr-only words), so they
          // can never stick out past the page edge.
          fit && 'relative',
        )}
      >
        <table className="text-small border-collapse text-center font-mono">
          <caption className="text-fg-muted text-caption p-2 text-left font-sans">
            {caption}
            {clock ? ' (Clock: use bit after each page, ▶ marks the hand)' : ''}
          </caption>
          <thead>
            <tr>
              <th scope="row" className={rowLabel}>
                Reference
              </th>
              {columns.map((column, i) => (
                <th
                  key={i}
                  scope="col"
                  aria-current={i === step ? 'step' : undefined}
                  className={cn(
                    fit ? 'min-w-8 sm:min-w-12' : 'min-w-12',
                    cellPad,
                    'py-1',
                    i === step && 'bg-surface-overlay border-accent border-b-2',
                    i > step && 'state-dim',
                  )}
                >
                  {animate ? (
                    // The current reference lifts (and is underlined by the border).
                    <span
                      className={cn('inline-block', i === step && '-translate-y-0.5')}
                      style={moveStyle(move, 'translate')}
                    >
                      {column.ref}
                    </span>
                  ) : (
                    column.ref
                  )}
                  {refMarks && i < step ? (
                    <span
                      className={cn(
                        'text-caption block font-sans font-semibold',
                        column.fault ? 'text-state-error' : 'text-state-ok',
                      )}
                    >
                      <span aria-hidden="true">{column.fault ? 'F' : 'H'}</span>
                      <span className="sr-only">{column.fault ? 'fault' : 'hit'}</span>
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: frameCount }, (_, f) => (
              <tr key={f} className="border-border border-t">
                <th scope="row" className={rowLabel}>
                  Frame {f}
                </th>
                {columns.map((column, i) => {
                  if (i > step) return <td key={i} />;
                  const page = column.frames[f] ?? null;
                  const loaded = column.fault && column.loaded === f;
                  const isHand = clock && column.hand === f;
                  const bit = column.useBits?.[f];
                  const hit = column.hitFrame === f;
                  const victim = column.victim?.frame === f ? column.victim : undefined;
                  const leaving =
                    column.leaving?.frame === f ? column.leaving.page : undefined;
                  const note = column.notes?.[f] ?? null;
                  const current = i === step;
                  const pageText = page ?? <span className="text-fg-muted">–</span>;
                  let shown: ReactNode = pageText;
                  if (animate && current && loaded && page !== null) {
                    // Re-keyed per page, so a load drops the new page in.
                    shown = (
                      <span
                        key={`in-${page}`}
                        className="inline-block starting:-translate-y-2 starting:opacity-0"
                        style={moveStyle(enter)}
                      >
                        {page}
                      </span>
                    );
                  } else if (animate && hit) {
                    shown = (
                      <Flash trigger={`${i}-${f}`} active={current} tone="ok">
                        {pageText}
                      </Flash>
                    );
                  }
                  return (
                    <td
                      key={i}
                      data-loaded={loaded || undefined}
                      data-hit={hit || undefined}
                      data-victim={victim ? '' : undefined}
                      className={cn(
                        cellPad,
                        'py-1 align-top',
                        loaded && 'outline-accent outline-2 -outline-offset-2',
                        current && 'bg-surface-overlay',
                      )}
                    >
                      {cellBody(
                        i,
                        <>
                          <span
                            className={cn(
                              (victim || leaving !== undefined) && 'relative',
                              victim &&
                                'ring-state-warn inline-block rounded-full px-1 ring-2',
                            )}
                          >
                            {isHand ? (
                              <span aria-hidden="true" className="text-accent mr-0.5">
                                ▶
                              </span>
                            ) : null}
                            {shown}
                            {current && leaving !== undefined && enter > 0 ? (
                              // The page on its way out: it falls and fades from the cell.
                              <span
                                key={`out-${leaving}`}
                                aria-hidden="true"
                                className="text-fg-muted absolute inset-x-0 top-0 translate-y-2 opacity-0 starting:translate-y-0 starting:opacity-100"
                                style={moveStyle(enter)}
                              >
                                {leaving}
                              </span>
                            ) : null}
                          </span>
                          {hit ? (
                            <span className="text-caption text-state-ok font-sans font-semibold">
                              <span aria-hidden="true">H</span>
                              <span className="sr-only">hit</span>
                            </span>
                          ) : null}
                          {loaded ? (
                            <span className="text-caption text-accent font-sans">
                              in
                              {column.evicted !== undefined ? (
                                <span className="text-fg-muted">
                                  , {column.evicted} out
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                          {leaving !== undefined ? (
                            <span className="text-caption text-fg-muted font-sans">
                              {leaving} out
                            </span>
                          ) : null}
                          {victim ? (
                            <span className="text-caption text-state-warn max-w-28 font-sans leading-tight font-semibold whitespace-normal">
                              victim: {victim.reason}
                            </span>
                          ) : null}
                          {clock && page !== null && bit !== undefined ? (
                            <span className="text-caption text-fg-muted">u={bit}</span>
                          ) : null}
                          {note !== null ? (
                            <span className="text-caption text-fg-muted font-sans whitespace-nowrap">
                              {note}
                            </span>
                          ) : null}
                          {isHand ? <span className="sr-only">hand</span> : null}
                        </>,
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border-strong border-t-2">
              <th scope="row" className={rowLabel}>
                Result
              </th>
              {columns.map((column, i) => (
                <td
                  key={i}
                  className={cn(
                    'text-caption py-1 font-sans font-semibold',
                    cellPad,
                    column.fault ? 'text-state-error' : 'text-state-ok',
                  )}
                >
                  {i > step ? '' : column.fault ? 'fault' : 'hit'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-small">
        After {reached} {reached === 1 ? 'reference' : 'references'}: {faults}{' '}
        {faults === 1 ? 'fault' : 'faults'}, {hits} {hits === 1 ? 'hit' : 'hits'}.
      </p>
    </div>
  );
}
