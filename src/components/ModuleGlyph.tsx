import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * A small picture of each module (docs/UIUX.md §7.1, P5): a Gantt strip, an address
 * splitting into fields, a frame column, a wait-for loop, two threads taking turns.
 *
 * Decorative and `aria-hidden`: the card's heading and blurb say the same thing in words.
 * Pure CSS (the idle keyframes in src/styles/motion.css), so it renders in a Server
 * Component and ships no JS. Each animated part plays once on load and loops while an
 * ancestor with the `group` class is hovered or holds focus. Every keyframe starts and
 * ends on the resting picture, which is also what reduced motion shows.
 */

export type GlyphSlug =
  'scheduling' | 'compare' | 'translation' | 'replacement' | 'deadlock' | 'sync';

/** Once by default; on a loop while the card is hovered or focused. */
const PLAY =
  '[&_[data-anim]]:[animation-iteration-count:1] group-hover:[&_[data-anim]]:[animation-iteration-count:infinite] group-focus-within:[&_[data-anim]]:[animation-iteration-count:infinite]';

/** Scale from the shape's own left or bottom edge, not the SVG's origin. */
const FROM_LEFT = '[transform-box:fill-box] origin-left';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

function Bar({
  x,
  y,
  w,
  h = 9,
  slot,
  anim,
  delay,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  slot: number;
  anim?: string | undefined;
  delay?: string | undefined;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1.5}
      data-anim={anim ? '' : undefined}
      className={cn(anim, anim && FROM_LEFT)}
      style={{
        fill: `var(--proc-${slot})`,
        stroke: `var(--proc-edge-${slot})`,
        strokeWidth: 1,
        ...(delay ? { animationDelay: delay } : {}),
      }}
    />
  );
}

const ink = { fill: 'var(--fg)' } as const;
const mono = 'num text-[8px]';

function Scheduling() {
  return (
    <>
      <line x1={4} y1={44} x2={92} y2={44} style={{ stroke: 'var(--rule)' }} />
      <Bar x={4} y={6} w={28} slot={1} anim="animate-idle-gantt" />
      <Bar x={32} y={19} w={32} slot={2} anim="animate-idle-gantt" delay="0.5s" />
      <Bar x={64} y={32} w={28} slot={3} anim="animate-idle-gantt" delay="1s" />
    </>
  );
}

function Compare() {
  return (
    <>
      <Bar x={4} y={8} w={30} slot={1} anim="animate-idle-gantt" />
      <Bar x={34} y={8} w={26} slot={2} anim="animate-idle-gantt" delay="0.4s" />
      <Bar x={60} y={8} w={32} slot={3} anim="animate-idle-gantt" delay="0.8s" />
      <Bar x={4} y={28} w={14} slot={2} anim="animate-idle-gantt" delay="0.2s" />
      <Bar x={18} y={28} w={18} slot={3} anim="animate-idle-gantt" delay="0.6s" />
      <Bar x={36} y={28} w={30} slot={1} anim="animate-idle-gantt" delay="1s" />
      <line x1={66} y1={24} x2={66} y2={42} style={{ stroke: 'var(--accent)' }} />
    </>
  );
}

function Translation() {
  return (
    <>
      <rect
        x={4}
        y={4}
        width={40}
        height={16}
        rx={2}
        style={{ fill: 'var(--proc-4)', stroke: 'var(--proc-edge-4)' }}
      />
      <rect
        x={46}
        y={4}
        width={46}
        height={16}
        rx={2}
        style={{ fill: 'var(--proc-2)', stroke: 'var(--proc-edge-2)' }}
      />
      <text x={24} y={15} textAnchor="middle" className={mono} style={ink}>
        1011
      </text>
      <text x={69} y={15} textAnchor="middle" className={mono} style={ink}>
        0110
      </text>
      <line
        x1={24}
        y1={20}
        x2={24}
        y2={36}
        style={{ stroke: 'var(--border)', strokeDasharray: '2 2' }}
      />
      <rect
        x={66}
        y={28}
        width={26}
        height={16}
        rx={2}
        style={{ fill: 'var(--surface-2)', stroke: 'var(--border)' }}
      />
      <rect
        x={18}
        y={32}
        width={12}
        height={8}
        rx={1.5}
        data-anim=""
        className="animate-idle-shuttle"
        style={{
          ...vars({ '--idle-distance': '48px' }),
          fill: 'var(--accent)',
        }}
      />
    </>
  );
}

function Replacement() {
  const frames = ['7', '0', '1'];
  return (
    <>
      {frames.map((_, i) => (
        <rect
          key={`f${i}`}
          x={34}
          y={3 + i * 14}
          width={28}
          height={12}
          rx={1.5}
          style={{ fill: 'var(--surface-2)', stroke: 'var(--border)' }}
        />
      ))}
      {frames.map((page, i) => (
        <g
          key={page}
          data-anim={i === 1 ? '' : undefined}
          className={i === 1 ? 'animate-idle-slide' : undefined}
          style={vars({ '--idle-distance': '-10px' })}
        >
          <rect
            x={37}
            y={5 + i * 14}
            width={22}
            height={8}
            rx={1}
            style={{
              fill: `var(--proc-${(Number(page) + 3) % 10})`,
              stroke: `var(--proc-edge-${(Number(page) + 3) % 10})`,
            }}
          />
          <text x={48} y={11.5 + i * 14} textAnchor="middle" className={mono} style={ink}>
            {page}
          </text>
        </g>
      ))}
      <path
        d="M12 23 h16 m-4 -4 l4 4 l-4 4"
        style={{ stroke: 'var(--fg-muted)', fill: 'none' }}
      />
      <path
        d="M68 23 h16 m-4 -4 l4 4 l-4 4"
        style={{ stroke: 'var(--danger)', fill: 'none' }}
      />
    </>
  );
}

function Deadlock() {
  const arc = {
    fill: 'none',
    stroke: 'var(--danger)',
    strokeWidth: 1.5,
    strokeDasharray: '4 2',
    ...vars({ '--idle-dashoffset': -12 }),
  };
  return (
    <>
      <path
        d="M28 16 C 40 4, 56 4, 68 16"
        data-anim=""
        className="animate-idle-cycle"
        style={arc}
      />
      <path
        d="M68 32 C 56 44, 40 44, 28 32"
        data-anim=""
        className="animate-idle-cycle"
        style={arc}
      />
      <path
        d="M63 12 l5 4 l-6 1"
        style={{ fill: 'none', stroke: 'var(--danger)', strokeWidth: 1.5 }}
      />
      <path
        d="M33 36 l-5 -4 l6 -1"
        style={{ fill: 'none', stroke: 'var(--danger)', strokeWidth: 1.5 }}
      />
      {[
        { x: 12, label: 'T0', slot: 0 },
        { x: 68, label: 'T1', slot: 5 },
      ].map((t) => (
        <g key={t.label}>
          <rect
            x={t.x}
            y={14}
            width={16}
            height={20}
            rx={4}
            style={{
              fill: `var(--proc-${t.slot})`,
              stroke: `var(--proc-edge-${t.slot})`,
            }}
          />
          <text x={t.x + 8} y={27} textAnchor="middle" className={mono} style={ink}>
            {t.label}
          </text>
        </g>
      ))}
    </>
  );
}

function Sync() {
  return (
    <>
      {[0, 1].map((i) => (
        <g key={i}>
          <text
            x={4}
            y={14 + i * 18}
            className={mono}
            style={{ fill: 'var(--fg-muted)' }}
          >
            T{i}
          </text>
          <Bar
            x={18}
            y={6 + i * 18}
            w={40}
            h={10}
            slot={i === 0 ? 0 : 5}
            anim="animate-idle-turns"
            delay={i === 1 ? '-1.6s' : undefined}
          />
        </g>
      ))}
      <text x={68} y={22} className="num text-[11px]" style={{ fill: 'var(--danger)' }}>
        2
      </text>
      <line
        x1={66}
        y1={18}
        x2={76}
        y2={18}
        style={{ stroke: 'var(--danger)', strokeWidth: 1.5 }}
      />
      <text x={80} y={22} className="num text-[11px]" style={ink}>
        1
      </text>
    </>
  );
}

const GLYPHS: Record<GlyphSlug, () => ReactNode> = {
  scheduling: Scheduling,
  compare: Compare,
  translation: Translation,
  replacement: Replacement,
  deadlock: Deadlock,
  sync: Sync,
};

export function isGlyphSlug(slug: string): slug is GlyphSlug {
  return slug in GLYPHS;
}

export interface ModuleGlyphProps {
  slug: GlyphSlug;
  className?: string;
}

export function ModuleGlyph({ slug, className }: ModuleGlyphProps) {
  const Glyph = GLYPHS[slug];
  return (
    <svg
      viewBox="0 0 96 48"
      aria-hidden="true"
      focusable="false"
      data-glyph={slug}
      className={cn('h-12 w-24 shrink-0 overflow-visible', PLAY, className)}
    >
      <Glyph />
    </svg>
  );
}
