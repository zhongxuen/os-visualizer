'use client';

import { useId } from 'react';

import type { NumberBase } from '@/components/blocks/BitField';
import { cn } from '@/lib/cn';

/**
 * Binary / Hex / Decimal (T1): one number base at a time, binary first. Native radio
 * buttons in a fieldset, like the workspace's mode switch: one tab stop, the arrow keys
 * move the choice, and the playback keys leave a focused radio alone. `B` cycles it
 * from anywhere (`shortcuts.ts`).
 */

export const BASES: readonly { value: NumberBase; label: string }[] = [
  { value: 'binary', label: 'Binary' },
  { value: 'hex', label: 'Hex' },
  { value: 'decimal', label: 'Decimal' },
];

/** The base after `base`, for the `B` key. */
export function nextBase(base: NumberBase): NumberBase {
  const i = BASES.findIndex((b) => b.value === base);
  return BASES[(i + 1) % BASES.length]!.value;
}

export function BaseSwitch({
  value,
  onChange,
}: {
  value: NumberBase;
  onChange: (base: NumberBase) => void;
}) {
  const name = useId();
  return (
    <fieldset className="border-border inline-flex rounded-md border p-0.5">
      <legend className="sr-only">Number base (key B)</legend>
      {BASES.map((base) => (
        <label
          key={base.value}
          className={cn(
            'min-h-target-floor text-small inline-flex cursor-pointer items-center rounded px-2.5 font-medium transition-colors',
            'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
            value === base.value
              ? 'bg-accent text-accent-ink'
              : 'text-fg-secondary hover:bg-surface-overlay hover:text-fg',
          )}
        >
          <input
            type="radio"
            name={name}
            value={base.value}
            checked={value === base.value}
            onChange={() => onChange(base.value)}
            className="sr-only"
          />
          {base.label}
        </label>
      ))}
    </fieldset>
  );
}
