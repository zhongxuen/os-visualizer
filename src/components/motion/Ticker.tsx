'use client';

import type { CSSProperties } from 'react';

import { cn } from '@/lib/cn';

import { DURATION } from './tokens';
import { useStepTransition } from './useStepTransition';

/**
 * A number that rolls to its new value: faults, hits, `t` (docs/UIUX.md §6.3).
 *
 * Each digit is a column of 0-9 behind a one-line window, moved with `translateY`; a
 * CSS transition does the rolling, so a digit that did not change does not move.
 * Columns are keyed from the right, so the units digit stays the units digit when the
 * number grows a place. On anything but a forward step (and under reduced motion, and
 * at speeds 4-5) the transition is `0ms`: the digits are simply in place.
 *
 * Set in Geist Mono with tabular figures (`num`) so the width never jitters. The
 * columns are `aria-hidden`; the value itself is read from a visually hidden copy, so a
 * screen reader never hears ten digits per place, or a half-way value.
 */

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface TickerProps {
  value: number | string;
  className?: string;
}

export function Ticker({ value, className }: TickerProps) {
  const text = String(value);
  const { scale } = useStepTransition();
  const duration = scale(DURATION.move);
  const chars = [...text];

  return (
    <span className={cn('num relative inline-flex', className)} data-ticker="">
      <span aria-hidden="true" className="inline-flex">
        {chars.map((char, i) => {
          const place = chars.length - i;
          const digit = DIGITS.indexOf(char);
          if (digit === -1) {
            return (
              <span key={`c${place}`} className="inline-block">
                {char}
              </span>
            );
          }
          return (
            <span
              key={`d${place}`}
              data-digit={char}
              className="inline-block h-[1lh] overflow-hidden"
            >
              <span
                className="flex flex-col"
                style={
                  {
                    transform: `translateY(-${digit * 10}%)`,
                    transitionProperty: 'transform',
                    transitionDuration: `${duration}ms`,
                    transitionTimingFunction: 'var(--ease-out)',
                  } as CSSProperties
                }
              >
                {DIGITS.map((d) => (
                  <span key={d} className="block h-[1lh]">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
