'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * "Rules used": the modelling conventions a module follows, where textbooks disagree or
 * leave a choice open (tie-breaks, what happens on the same tick, how a quantum is
 * counted). The list comes from the module's core, so what the panel says and what the
 * algorithm does are written in one place. Every rule shown has a test in the core.
 *
 * Each rule reads three ways (docs/UIUX.md G4): a **plain** sentence for a beginner, the
 * **formal** rule (`text`, with `detail`), and **why it matters** (what changes if your
 * book uses the other convention). `plain` and `whyItMatters` are optional; a rule
 * without them shows its formal text alone, as before.
 *
 * The rule that decided the current step (`currentRuleId`, G5) is marked "Used on this
 * step" and opens the panel. `StepInspector`'s "Rule used" chip links here through
 * `ruleAnchorId`.
 *
 * A native `<details>`: collapsible from the keyboard with no script.
 */

export interface Rule {
  /** Stable id, e.g. `'sched.tie.arrival'`. */
  id: string;
  /** The formal rule, in one sentence. */
  text: string;
  /** Why this convention, or which textbook uses it. */
  detail?: string;
  /** The rule in plain words, for someone meeting it for the first time. */
  plain?: string;
  /** What would change if a textbook used the other convention. */
  whyItMatters?: string;
}

export interface RulesPanelProps {
  rules: readonly Rule[];
  /** The rule that decided the current step, if one did. Highlighted and opened. */
  currentRuleId?: string | null;
  title?: string;
  defaultOpen?: boolean;
  className?: string;
}

/** The DOM id of a rule's entry, so a "Rule used" chip can link to it. */
export function ruleAnchorId(ruleId: string): string {
  return `rule-${ruleId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

export function RulesPanel({
  rules,
  currentRuleId,
  title = 'Rules used',
  defaultOpen = false,
  className,
}: RulesPanelProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const hasCurrent = currentRuleId != null && rules.some((r) => r.id === currentRuleId);

  // Opening, never closing: a reader who closed the panel and then reaches a step a rule
  // decided wants to see it; a reader who opened it keeps it open.
  useEffect(() => {
    if (hasCurrent && detailsRef.current) detailsRef.current.open = true;
  }, [hasCurrent, currentRuleId]);

  return (
    <details
      ref={detailsRef}
      open={defaultOpen}
      data-rules-panel=""
      className={cn('border-border bg-surface-raised rounded-lg border p-4', className)}
    >
      <summary className="text-small cursor-pointer font-semibold">
        {title} ({rules.length})
      </summary>
      {rules.length === 0 ? (
        <p className="text-fg-muted text-small mt-2">No special rules.</p>
      ) : (
        <ul className="text-small mt-2 flex flex-col gap-2">
          {rules.map((rule) => {
            const current = rule.id === currentRuleId;
            return (
              <li
                key={rule.id}
                id={ruleAnchorId(rule.id)}
                data-rule={rule.id}
                data-current={current ? '' : undefined}
                aria-current={current ? 'true' : undefined}
                tabIndex={-1}
                className={cn(
                  'focus-visible:outline-focus rounded-md border-l-4 py-1 pr-1 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2',
                  current ? 'border-accent bg-surface-overlay' : 'border-border',
                )}
              >
                {current ? (
                  <span className="text-accent text-caption mb-0.5 block font-semibold">
                    Used on this step
                  </span>
                ) : null}
                {rule.plain ? (
                  <>
                    <span className="text-fg block">{rule.plain}</span>
                    <span className="text-fg-secondary mt-1 block">
                      <span className="font-semibold">Formally: </span>
                      {rule.text}
                    </span>
                  </>
                ) : (
                  <span className="text-fg block">{rule.text}</span>
                )}
                {rule.detail ? (
                  <span className="text-fg-muted block">{rule.detail}</span>
                ) : null}
                {rule.whyItMatters ? (
                  <span className="text-fg-secondary mt-1 block">
                    <span className="font-semibold">Why it matters: </span>
                    {rule.whyItMatters}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
