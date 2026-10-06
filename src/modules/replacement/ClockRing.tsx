'use client';

import { useState, type CSSProperties } from 'react';

import { DURATION } from '@/components/motion/tokens';
import { useStepTransition } from '@/components/motion/useStepTransition';
import type { ReplSnapshot } from '@/core/replace/events';

/**
 * Clock's frames drawn as a ring, with the hand (docs/UIUX.md §7.2.4). Frame 0 is at the
 * top and the frames go round clockwise, the way the hand moves.
 *
 * Everything is read from the step's snapshot: the hand points at `state.hand`, each
 * frame shows its page and use bit. On a forward step the hand turns to its new frame
 * (always clockwise, so a wrap from the last frame to frame 0 turns one place forward,
 * not all the way back), and a use bit that changed flips. Any other change lands at
 * once. The hand's resting position is always drawn, and the caption says it in words.
 */

export interface ClockRingProps {
  state: Pick<ReplSnapshot, 'frames' | 'useBits' | 'hand'>;
  /** The frame this step is about (scanned, chosen, loaded or hit), outlined. */
  focus?: number;
  className?: string;
}

const SIZE = 220;
const C = SIZE / 2;
const RING = 76;
const BOX_W = 44;
const BOX_H = 38;

/** Degrees clockwise from the top for frame `f` of `n`. */
export function frameAngle(f: number, n: number): number {
  return (f * 360) / n;
}

/**
 * The hand's angle after moving to `hand`, from `previous` (its last angle and frame).
 * A forward step turns clockwise by the frames passed; anything else jumps to the
 * frame's own angle.
 */
export function nextHandAngle(
  previous: { hand: number; angle: number },
  hand: number,
  n: number,
  forward: boolean,
): number {
  if (!forward) return frameAngle(hand, n);
  const passed = (((hand - previous.hand) % n) + n) % n;
  return previous.angle + frameAngle(passed, n);
}

export function ClockRing({ state, focus, className }: ClockRingProps) {
  const n = state.frames.length;
  const hand = state.hand ?? 0;
  const transition = useStepTransition();
  const forward = transition.direction === 'forward';
  const turn = transition.scale(DURATION.move);
  const flip = transition.scale(DURATION.highlight);

  // The hand's angle, kept across renders so a wrap still turns clockwise.
  const [dial, setDial] = useState({ hand, n, angle: frameAngle(hand, n) });
  let current = dial;
  if (dial.hand !== hand || dial.n !== n) {
    current = {
      hand,
      n,
      angle: dial.n === n ? nextHandAngle(dial, hand, n, forward) : frameAngle(hand, n),
    };
    setDial(current);
  }

  const bits = state.useBits ?? [];
  const summary = `Clock: hand at frame ${hand}. ${state.frames
    .map(
      (page, f) =>
        `Frame ${f}: ${page === null ? 'empty' : `page ${page}, use bit ${bits[f] ?? 0}`}`,
    )
    .join('. ')}.`;

  const handStyle: CSSProperties = {
    transform: `rotate(${current.angle}deg)`,
    transformOrigin: `${C}px ${C}px`,
    transformBox: 'view-box',
    transitionProperty: 'transform',
    transitionDuration: `${turn}ms`,
    transitionTimingFunction: 'var(--ease-inout)',
  };

  return (
    <figure className={className} data-clock-ring="">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full max-w-56"
      >
        <circle
          cx={C}
          cy={C}
          r={RING}
          fill="none"
          stroke="var(--border-strong)"
          strokeDasharray="3 4"
        />
        <g data-hand={hand} data-angle={current.angle} style={handStyle}>
          <line
            x1={C}
            y1={C}
            x2={C}
            y2={C - RING + BOX_H / 2 + 6}
            stroke="var(--accent)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d={`M${C} ${C - RING + BOX_H / 2 + 1} l-6 9 h12 Z`}
            fill="var(--accent)"
          />
        </g>
        <circle cx={C} cy={C} r={5} fill="var(--accent)" />
        {state.frames.map((page, f) => {
          const a = ((frameAngle(f, n) - 90) * Math.PI) / 180;
          const x = C + RING * Math.cos(a);
          const y = C + RING * Math.sin(a);
          const bit = bits[f] ?? 0;
          const isFocus = focus === f;
          return (
            <g key={f} data-frame={f} data-bit={bit}>
              <rect
                x={x - BOX_W / 2}
                y={y - BOX_H / 2}
                width={BOX_W}
                height={BOX_H}
                rx={6}
                fill="var(--bg-raised)"
                stroke={
                  isFocus
                    ? 'var(--accent)'
                    : hand === f
                      ? 'var(--text-secondary)'
                      : 'var(--border-strong)'
                }
                strokeWidth={isFocus ? 3 : 1.5}
              />
              <text
                x={x}
                y={y - 4}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                className="font-mono"
                fill="var(--text-primary)"
              >
                {page ?? '–'}
              </text>
              {page !== null ? (
                // Re-keyed per value, so a bit that changes flips over.
                <text
                  key={`bit-${bit}`}
                  x={x}
                  y={y + 12}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--text-muted)"
                  className="starting:scale-y-0"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transitionProperty: 'scale',
                    transitionDuration: `${flip}ms`,
                  }}
                >
                  u={bit}
                </text>
              ) : null}
              <text
                x={x}
                y={y + BOX_H / 2 + 11}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-muted)"
              >
                frame {f}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-caption text-fg-muted">
        <span aria-hidden="true">▶ </span>Hand at frame {hand}
        {state.frames[hand] !== null && state.frames[hand] !== undefined
          ? ` (page ${state.frames[hand]}, use bit ${bits[hand] ?? 0})`
          : ''}
        . A hit sets a page’s bit to 1; the hand clears 1s as it passes and evicts the
        first 0.
      </figcaption>
    </figure>
  );
}
