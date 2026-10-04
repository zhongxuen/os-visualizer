'use client';

import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Small form controls for the synchronisation inputs. Native inputs with visible labels,
 * so every control works from the keyboard and reads correctly to a screen reader.
 *
 * The same shapes as the other modules' fields; a module may not import another module
 * (boundary rule 3), so they are repeated here.
 */

export const INPUT =
  'border-border bg-surface rounded border px-2 py-1 font-mono text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

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
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
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

/**
 * A whole-number field that keeps what you type and reports a value only when it is a
 * whole number in range; anything else shows a message and changes nothing.
 */
export function IntField({
  label,
  value,
  min,
  max,
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  // Follow a value changed from outside (a preset, a link).
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  const n = /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
  const error =
    Number.isInteger(n) && n >= min && n <= max
      ? null
      : `Enter a whole number from ${min} to ${max}`;

  return (
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className="text-caption text-fg-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(INPUT, 'w-full min-w-0', error && 'border-state-error border-2')}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = /^\d+$/.test(next.trim()) ? Number(next.trim()) : Number.NaN;
          if (Number.isInteger(parsed) && parsed >= min && parsed <= max) {
            setShown(parsed);
            onChange(parsed);
          }
        }}
      />
      {error ? (
        <span id={`${id}-err`} className="text-caption text-state-error">
          {error}
        </span>
      ) : null}
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
