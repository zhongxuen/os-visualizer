import { cn } from '@/lib/cn';

import { processSlot } from './processPalette';

/**
 * A process, drawn the one way the product draws it: its patterned swatch and its PID
 * as text, inside the fill in `--proc-ink`, which every fill is measured against.
 *
 * `label` defaults to `P${pid}`. `detail` is extra text after it (remaining time, a
 * queue level), drawn beside the chip in the normal text colour.
 */

export interface ProcessChipProps {
  pid: number;
  label?: string;
  detail?: string;
  className?: string;
}

export function ProcessChip({ pid, label, detail, className }: ProcessChipProps) {
  const text = label ?? `P${pid}`;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className="proc-fill text-small inline-flex min-w-9 items-center justify-center rounded px-1.5 py-0.5 font-mono font-semibold"
        data-proc={processSlot(pid)}
      >
        {/*
          A plain backing in the slot's own fill (inherited from `data-proc`), so a
          pattern stroke never crosses a glyph and the ink keeps its measured contrast.
        */}
        <span className="rounded-sm [background-color:var(--proc-fill)] px-0.5">
          {text}
        </span>
      </span>
      {detail ? <span className="text-fg-secondary text-small">{detail}</span> : null}
    </span>
  );
}
