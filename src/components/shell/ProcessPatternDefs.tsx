import { PROCESS_PALETTE, processPatternId, type ProcessPattern } from './processPalette';

/**
 * The ten process patterns as SVG `<pattern>`s, for charts: fill a bar with
 * `url(#${processPatternId(slot)})`. Render once per page inside an `<svg>` (it draws
 * nothing itself). Same patterns as process.css, which serves HTML elements.
 *
 * Each pattern paints the slot's fill first and the strokes over it, so a bar needs only
 * this one `fill`. Strokes use `--proc-stroke`, which is decoration, never text: the PID
 * on a bar is drawn in `--proc-ink` on a plain backing.
 */

const STROKE = 'var(--proc-stroke)';

function marks(pattern: ProcessPattern) {
  switch (pattern) {
    case 'solid':
      return null;
    case 'diagonal':
      return (
        <path d="M-1 1 l2 -2 M0 8 l8 -8 M7 9 l2 -2" stroke={STROKE} strokeWidth={2} />
      );
    case 'back-diagonal':
      return <path d="M-1 7 l2 2 M0 0 l8 8 M7 -1 l2 2" stroke={STROKE} strokeWidth={2} />;
    case 'horizontal':
      return <rect x={0} y={0} width={8} height={2} fill={STROKE} />;
    case 'vertical':
      return <rect x={0} y={0} width={2} height={8} fill={STROKE} />;
    case 'dots':
      return <circle cx={4} cy={4} r={1.4} fill={STROKE} />;
    case 'cross-hatch':
      return (
        <path
          d="M-1 1 l2 -2 M0 8 l8 -8 M7 9 l2 -2 M-1 7 l2 2 M0 0 l8 8 M7 -1 l2 2"
          stroke={STROKE}
          strokeWidth={1.5}
        />
      );
    case 'grid':
      return <path d="M0 0.75 H8 M0.75 0 V8" stroke={STROKE} strokeWidth={1.5} />;
    case 'checker':
      return (
        <>
          <rect x={0} y={0} width={4} height={4} fill={STROKE} />
          <rect x={4} y={4} width={4} height={4} fill={STROKE} />
        </>
      );
    case 'large-dots':
      return <circle cx={4} cy={4} r={2.5} fill={STROKE} />;
  }
}

export function ProcessPatternDefs() {
  return (
    <defs>
      {PROCESS_PALETTE.map(({ slot, cssVar, pattern }) => (
        <pattern
          key={slot}
          id={processPatternId(slot)}
          data-pattern={pattern}
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
        >
          <rect width={8} height={8} fill={`var(${cssVar})`} />
          {marks(pattern)}
        </pattern>
      ))}
    </defs>
  );
}
