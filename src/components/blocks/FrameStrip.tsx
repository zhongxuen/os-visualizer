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
}

export interface FrameStripProps {
  columns: readonly FrameColumn[];
  /** Index of the current column; later columns are blank. */
  step: number;
  /** Draw use bits and the hand. */
  mode?: 'plain' | 'clock';
  caption?: string;
  className?: string;
}

export function faultCount(columns: readonly FrameColumn[], step: number): number {
  return columns.slice(0, step + 1).filter((column) => column.fault).length;
}

export function FrameStrip({
  columns,
  step,
  mode = 'plain',
  caption = 'Frames after each reference',
  className,
}: FrameStripProps) {
  const frameCount = columns.reduce(
    (max, column) => Math.max(max, column.frames.length),
    0,
  );
  const faults = faultCount(columns, step);
  const reached = Math.min(step, columns.length - 1) + 1;
  const hits = reached - faults;
  const clock = mode === 'clock';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${caption}, scrollable`}
        className="border-border bg-surface-raised overflow-x-auto rounded-lg border"
      >
        <table className="text-small border-collapse text-center font-mono">
          <caption className="text-fg-muted text-caption p-2 text-left font-sans">
            {caption}
            {clock ? ' (Clock: use bit after each page, ▶ marks the hand)' : ''}
          </caption>
          <thead>
            <tr>
              <th scope="row" className="text-fg-muted px-2 py-1 text-left font-sans">
                Reference
              </th>
              {columns.map((column, i) => (
                <th
                  key={i}
                  scope="col"
                  aria-current={i === step ? 'step' : undefined}
                  className={cn(
                    'min-w-12 px-2 py-1',
                    i === step && 'bg-surface-overlay border-accent border-b-2',
                    i > step && 'state-dim',
                  )}
                >
                  {column.ref}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: frameCount }, (_, f) => (
              <tr key={f} className="border-border border-t">
                <th scope="row" className="text-fg-muted px-2 py-1 text-left font-sans">
                  Frame {f}
                </th>
                {columns.map((column, i) => {
                  if (i > step) return <td key={i} />;
                  const page = column.frames[f] ?? null;
                  const loaded = column.fault && column.loaded === f;
                  const isHand = clock && column.hand === f;
                  const bit = column.useBits?.[f];
                  return (
                    <td
                      key={i}
                      data-loaded={loaded || undefined}
                      className={cn(
                        'px-2 py-1 align-top',
                        loaded && 'outline-accent outline-2 -outline-offset-2',
                        i === step && 'bg-surface-overlay',
                      )}
                    >
                      <span className="flex flex-col items-center leading-tight">
                        <span>
                          {isHand ? (
                            <span aria-hidden="true" className="text-accent mr-0.5">
                              ▶
                            </span>
                          ) : null}
                          {page ?? <span className="text-fg-muted">–</span>}
                        </span>
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
                        {clock && page !== null && bit !== undefined ? (
                          <span className="text-caption text-fg-muted">u={bit}</span>
                        ) : null}
                        {isHand ? <span className="sr-only">hand</span> : null}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border-strong border-t-2">
              <th scope="row" className="text-fg-muted px-2 py-1 text-left font-sans">
                Result
              </th>
              {columns.map((column, i) => (
                <td
                  key={i}
                  className={cn(
                    'text-caption px-2 py-1 font-sans font-semibold',
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
