'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Small form controls for the translation editors. Native inputs with visible labels, so
 * every control works from the keyboard and reads correctly to a screen reader.
 *
 * The same shapes as the scheduling module's fields; a module may not import another
 * module (boundary rule 3), so they are repeated here.
 */

export const INPUT =
  'border-border bg-surface rounded border px-2 py-1 font-mono text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** `'0x3F80'` or `'100'` → a number; anything else (or empty) → `NaN`. */
export function parseNumber(text: string): number {
  const t = text.trim();
  if (t === '') return Number.NaN;
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^-?\d+$/.test(t)) return Number(t);
  return Number.NaN;
}

export function Messages({ id, messages }: { id: string; messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul id={id} className="text-caption text-state-error flex flex-col gap-0.5">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

/** A text input that keeps what you type; `messages` are the schema's complaints. */
export function TextField({
  label,
  value,
  onChange,
  messages = [],
  hint,
  hideLabel = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  messages?: readonly string[];
  hint?: string;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  const described = [messages.length > 0 ? `${id}-err` : '', hint ? `${id}-hint` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label
        htmlFor={id}
        className={cn('text-caption text-fg-muted', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={value}
        aria-invalid={messages.length > 0 || undefined}
        aria-describedby={described || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          INPUT,
          'w-full min-w-0',
          messages.length > 0 && 'border-state-error border-2',
        )}
      />
      {hint ? (
        <span id={`${id}-hint`} className="text-caption text-fg-muted">
          {hint}
        </span>
      ) : null}
      <Messages id={`${id}-err`} messages={messages} />
    </span>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label
        htmlFor={id}
        className={cn('text-caption text-fg-muted', hideLabel && 'sr-only')}
      >
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
