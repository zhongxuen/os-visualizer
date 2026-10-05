'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';

import { cn } from '@/lib/cn';

import { usePreference, type ThemeSetting } from './prefs';

/**
 * System, light or dark. A radio group of three labelled buttons rather than a cycling
 * icon: the current choice is visible, and "system" is a choice you can see you made.
 *
 * The pre-paint script sets `data-theme` on first load; this keeps it in step afterwards.
 *
 * Styled as the "Timing diagram" segmented well (docs/UIUX.md §5): the chosen option is
 * a raised panel with a heavier label and an accent bar under it, so which one is chosen
 * survives greyscale rather than resting on a filled accent alone.
 */

const OPTIONS: readonly { value: ThemeSetting; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = usePreference('theme');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        'border-border bg-surface-overlay inline-flex gap-0.5 rounded-md border p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            title={`${label} theme`}
            className={cn(
              'min-h-target-floor text-caption relative inline-flex items-center gap-1 rounded px-2 transition-colors',
              active
                ? 'bg-surface-raised text-fg font-semibold'
                : 'text-fg-secondary hover:bg-surface-raised hover:text-fg font-medium',
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            {label}
            {active ? (
              <span
                aria-hidden="true"
                className="bg-accent absolute inset-x-2 bottom-0.5 h-0.5 rounded-full"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
