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
      className={cn('border-border inline-flex rounded-md border p-0.5', className)}
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
              'min-h-target-floor text-caption inline-flex items-center gap-1 rounded px-2 font-medium transition-colors',
              active
                ? 'bg-accent text-accent-ink'
                : 'text-fg-secondary hover:bg-surface-overlay hover:text-fg',
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
