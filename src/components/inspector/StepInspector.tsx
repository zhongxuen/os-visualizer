'use client';

import { Scale } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

import type { EventBase } from '@/core/events/types';
import { cn } from '@/lib/cn';

import { useStepFade } from '../timeline/useStepFade';
import { CitationLink } from './CitationLink';
import { ruleAnchorId, type Rule } from './RulesPanel';

/**
 * The current event explained (docs/UIUX.md §4.2): **What happened** (the event's
 * one-line `label`), **Why** (its `detail`, when it has one), module extras
 * (`children`), the **Rule used** chip when a tie-break or convention decided the step
 * (G5), and the **Source** (its citation).
 *
 * The chip links to that rule in the `RulesPanel` on the page, opening the panel. A
 * module passes `rule` (see `ruleUsed()`), and the same id to `RulesPanel`'s
 * `currentRuleId`, so the rules only get read when they matter.
 *
 * A forward step cross-fades the text in; every other change is instant (§6.1).
 *
 * Not a live region: the timeline's `StepCaption` already announces phase changes, and
 * announcing every tick during playback would talk over it.
 */

/** The rule that decided a step, as the chip shows it. */
export interface RuleUsed {
  id: string;
  /** Short words for the chip: the rule's `plain` sentence, or its `text`. */
  label: string;
}

/** The chip for rule `id` out of a module's rules, or `null` when there is none. */
export function ruleUsed(
  rules: readonly Rule[],
  id: string | null | undefined,
): RuleUsed | null {
  const rule = id ? rules.find((r) => r.id === id) : undefined;
  return rule ? { id: rule.id, label: rule.plain ?? rule.text } : null;
}

export interface StepInspectorProps {
  event: Pick<EventBase, 'label' | 'detail' | 'citation'> | undefined;
  /** e.g. "This tick" or "This step". */
  heading?: string;
  /** The rule that decided this step, if one did (G5). */
  rule?: RuleUsed | null;
  children?: ReactNode;
  className?: string;
}

/** Open the rules panel at `id` and move focus there. */
function goToRule(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(ruleAnchorId(id));
  if (!target) return;
  event.preventDefault();
  const details = target.closest('details');
  if (details) details.open = true;
  target.scrollIntoView?.({ block: 'nearest' });
  target.focus({ preventScroll: true });
}

const TERM = 'text-fg-muted text-caption font-semibold tracking-wide uppercase';

export function StepInspector({
  event,
  heading = 'This step',
  rule,
  children,
  className,
}: StepInspectorProps) {
  const fadeRef = useStepFade<HTMLDivElement>(event?.label);

  return (
    <section
      aria-label={heading}
      className={cn(
        'border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-4',
        className,
      )}
    >
      <h2 className="text-small text-fg-muted font-semibold">{heading}</h2>
      {event ? (
        <div ref={fadeRef} className="flex flex-col gap-2">
          <dl className="flex flex-col gap-2">
            <div>
              <dt className={TERM}>What happened</dt>
              <dd className="text-fg">{event.label}</dd>
            </div>
            {event.detail ? (
              <div>
                <dt className={TERM}>Why</dt>
                <dd className="text-fg-secondary text-small leading-relaxed">
                  {event.detail}
                </dd>
              </div>
            ) : null}
          </dl>
          {rule ? (
            <p>
              <a
                href={`#${ruleAnchorId(rule.id)}`}
                onClick={(e) => goToRule(e, rule.id)}
                data-rule-chip={rule.id}
                className="border-accent text-fg hover:bg-surface-overlay focus-visible:outline-focus text-small inline-flex max-w-full items-start gap-1.5 rounded-md border px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Scale
                  aria-hidden="true"
                  className="text-accent mt-0.5 size-4 shrink-0"
                />
                <span>
                  <span className="font-semibold">Rule used: </span>
                  {rule.label}
                </span>
              </a>
            </p>
          ) : null}
          {children}
          <p className="mt-1">
            <span className={cn(TERM, 'mr-1.5')}>Source</span>
            <CitationLink id={event.citation} />
          </p>
        </div>
      ) : (
        <p className="text-fg-muted text-small">Nothing has happened yet.</p>
      )}
    </section>
  );
}
