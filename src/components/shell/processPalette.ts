/**
 * The ten process slots: a colour token and a named pattern each.
 *
 * A process's slot is `pid % 10` (`processSlot`). Three signals mark it, so no one of them
 * has to carry it alone: the fill colour (`--proc-N` in tokens.css), the pattern
 * (process.css for HTML, `ProcessPatternDefs` for SVG) and the PID printed as text.
 */

export type ProcessPattern =
  | 'solid'
  | 'diagonal'
  | 'back-diagonal'
  | 'horizontal'
  | 'vertical'
  | 'dots'
  | 'cross-hatch'
  | 'grid'
  | 'checker'
  | 'large-dots';

export interface ProcessSlot {
  slot: number;
  /** CSS variable holding the fill colour. */
  cssVar: `--proc-${number}`;
  /** Plain name of the colour, for a legend that must not rely on seeing it. */
  colour: string;
  pattern: ProcessPattern;
}

export const PROCESS_PALETTE: readonly ProcessSlot[] = [
  { slot: 0, cssVar: '--proc-0', colour: 'sky', pattern: 'solid' },
  { slot: 1, cssVar: '--proc-1', colour: 'orange', pattern: 'diagonal' },
  { slot: 2, cssVar: '--proc-2', colour: 'green', pattern: 'back-diagonal' },
  { slot: 3, cssVar: '--proc-3', colour: 'yellow', pattern: 'horizontal' },
  { slot: 4, cssVar: '--proc-4', colour: 'periwinkle', pattern: 'vertical' },
  { slot: 5, cssVar: '--proc-5', colour: 'coral', pattern: 'dots' },
  { slot: 6, cssVar: '--proc-6', colour: 'orchid', pattern: 'cross-hatch' },
  { slot: 7, cssVar: '--proc-7', colour: 'lime', pattern: 'grid' },
  { slot: 8, cssVar: '--proc-8', colour: 'tan', pattern: 'checker' },
  { slot: 9, cssVar: '--proc-9', colour: 'teal', pattern: 'large-dots' },
];

/** The palette slot for a PID. Non-integers and negatives are folded into range. */
export function processSlot(pid: number): number {
  const n = Math.trunc(Number.isFinite(pid) ? pid : 0);
  return ((n % 10) + 10) % 10;
}

/** The id of slot `slot`'s SVG `<pattern>`, as drawn by `ProcessPatternDefs`. */
export function processPatternId(slot: number): string {
  return `osv-proc-pattern-${processSlot(slot)}`;
}
