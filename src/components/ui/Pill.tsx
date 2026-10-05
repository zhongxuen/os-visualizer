import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * A short status label: "Ready", "Coming soon", "Hit", "Fault", "Deadlock"
 * (docs/UIUX.md §4.1, §4.2).
 *
 * Text in the tone's colour on the surface it sits on, with an edge in the same colour.
 * That is a pairing `tokens.test.ts` already proves (every state colour is >= 4.5:1 as
 * text and so >= 3:1 as an edge, on every surface, in both themes), which a tinted fill
 * would not be. The word carries the meaning; `icon` is a second signal, never the only
 * one.
 */

export type PillTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

const TONES: Record<PillTone, string> = {
  neutral: 'border-border text-fg-secondary',
  accent: 'border-accent text-accent',
  ok: 'border-state-ok text-state-ok',
  warn: 'border-state-warn text-state-warn',
  danger: 'border-state-error text-state-error',
};

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  /** Decorative leading glyph (lucide, 16px). The text still has to say it. */
  icon?: ReactNode;
}

export function Pill({
  tone = 'neutral',
  icon,
  className,
  children,
  ...props
}: PillProps) {
  return (
    <span
      // Exempt from `.state-dim`: the pill states its meaning in its own colour and word.
      data-no-dim=""
      data-tone={tone}
      className={cn(
        'text-caption inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
