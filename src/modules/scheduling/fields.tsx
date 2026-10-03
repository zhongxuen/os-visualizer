'use client';

import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Small form controls shared by the workload editor, the policy picker and Compare.
 * Native inputs with visible labels, so every control works from the keyboard and reads
 * correctly to a screen reader with no extra wiring.
 */

export const INPUT =
  'border-border bg-surface rounded border px-2 py-1 font-mono text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** A whole-number input. Keeps what you type until it is a valid number in range. */
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  hideLabel = false,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  const parsed = Number(text);
  const invalid =
    draft !== null &&
    (!Number.isInteger(parsed) || parsed < min || parsed > max || text === '');

  return (
    <span className={cn('inline-flex flex-col gap-1', className)}>
      <label
        htmlFor={id}
        className={cn('text-caption text-fg-muted', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = event.target.value;
          const n = Number(next);
          if (next !== '' && Number.isInteger(n) && n >= min && n <= max) {
            setDraft(null);
            onChange(n);
          } else {
            setDraft(next);
          }
        }}
        onBlur={() => setDraft(null)}
        className={cn(INPUT, 'w-16', invalid && 'border-state-error border-2')}
      />
      {invalid ? (
        <span className="text-caption text-state-error">
          {min} to {max}
        </span>
      ) : null}
    </span>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="text-small inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-accent size-4"
      />
      {label}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-caption text-fg-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(INPUT, 'font-sans')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** A titled panel for the inputs column. */
export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'border-border bg-surface-raised flex flex-col gap-3 rounded-lg border p-4',
        className,
      )}
    >
      <h2 id={id} className="text-small font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
