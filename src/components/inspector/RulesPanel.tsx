import { cn } from '@/lib/cn';

/**
 * "Rules used": the modelling conventions a module follows, where textbooks disagree or
 * leave a choice open (tie-breaks, what happens on the same tick, how a quantum is
 * counted). The list comes from the module's core, so what the panel says and what the
 * algorithm does are written in one place. Every rule shown has a test in the core.
 *
 * A native `<details>`: collapsible from the keyboard with no script.
 */

export interface Rule {
  /** Stable id, e.g. `'sched.tie.arrival'`. */
  id: string;
  /** The rule in one sentence. */
  text: string;
  /** Why this convention, or which textbook uses it. */
  detail?: string;
}

export interface RulesPanelProps {
  rules: readonly Rule[];
  title?: string;
  defaultOpen?: boolean;
  className?: string;
}

export function RulesPanel({
  rules,
  title = 'Rules used',
  defaultOpen = false,
  className,
}: RulesPanelProps) {
  return (
    <details
      open={defaultOpen}
      className={cn('border-border bg-surface-raised rounded-lg border p-4', className)}
    >
      <summary className="text-small cursor-pointer font-semibold">
        {title} ({rules.length})
      </summary>
      {rules.length === 0 ? (
        <p className="text-fg-muted text-small mt-2">No special rules.</p>
      ) : (
        <ul className="text-small mt-2 flex list-disc flex-col gap-2 pl-5">
          {rules.map((rule) => (
            <li key={rule.id} data-rule={rule.id}>
              <span>{rule.text}</span>
              {rule.detail ? (
                <span className="text-fg-muted block">{rule.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
